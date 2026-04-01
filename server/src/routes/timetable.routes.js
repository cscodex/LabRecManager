const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// ===================================================================
// TIMETABLE ROUTES
// ===================================================================

/**
 * @route   GET /api/timetable
 * @desc    Get timetable for a class (with all slots)
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { classId, dayOfWeek } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId) {
        return res.status(400).json({ success: false, message: 'classId is required' });
    }

    const where = { schoolId, classId, isActive: true };

    const timetable = await prisma.timetable.findFirst({
        where,
        include: {
            class: { select: { id: true, name: true, gradeLevel: true, section: true } },
            academicYear: { select: { id: true, yearLabel: true } },
            slots: {
                where: dayOfWeek ? { dayOfWeek } : {},
                orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
                include: {
                    subject: { select: { id: true, name: true, nameHindi: true, code: true } },
                    instructor: { select: { id: true, firstName: true, lastName: true, email: true } }
                }
            }
        }
    });

    if (!timetable) {
        return res.json({ success: true, data: { timetable: null, message: 'No timetable found for this class' } });
    }

    res.json({ success: true, data: { timetable } });
}));

/**
 * @route   POST /api/timetable
 * @desc    Create timetable for a class
 * @access  Private (Admin, Principal)
 */
router.post('/', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { classId, academicYearId, name, effectiveFrom, effectiveTo } = req.body;
    const schoolId = req.user.schoolId;

    if (!classId || !academicYearId || !name || !effectiveFrom) {
        return res.status(400).json({ success: false, message: 'classId, academicYearId, name, and effectiveFrom are required' });
    }

    // Deactivate any existing active timetable for this class
    await prisma.timetable.updateMany({
        where: { classId, academicYearId, isActive: true },
        data: { isActive: false }
    });

    const timetable = await prisma.timetable.create({
        data: {
            schoolId,
            classId,
            academicYearId,
            name,
            effectiveFrom: new Date(effectiveFrom),
            effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
            isActive: true
        },
        include: {
            class: { select: { id: true, name: true, gradeLevel: true, section: true } },
            academicYear: { select: { id: true, yearLabel: true } }
        }
    });

    res.status(201).json({
        success: true,
        message: 'Timetable created',
        messageHindi: 'समय सारणी बनाई गई',
        data: { timetable }
    });
}));

/**
 * @route   PUT /api/timetable/:id
 * @desc    Update timetable metadata
 * @access  Private (Admin, Principal)
 */
router.put('/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { name, effectiveFrom, effectiveTo, isActive } = req.body;

    const timetable = await prisma.timetable.update({
        where: { id: req.params.id },
        data: {
            ...(name && { name }),
            ...(effectiveFrom && { effectiveFrom: new Date(effectiveFrom) }),
            ...(effectiveTo !== undefined && { effectiveTo: effectiveTo ? new Date(effectiveTo) : null }),
            ...(isActive !== undefined && { isActive })
        }
    });

    res.json({ success: true, message: 'Timetable updated', data: { timetable } });
}));

/**
 * @route   POST /api/timetable/:id/slots
 * @desc    Add a period slot to timetable
 * @access  Private (Admin, Principal)
 */
router.post('/:id/slots', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { dayOfWeek, periodNumber, startTime, endTime, subjectId, instructorId, roomNumber, slotType } = req.body;

    if (!dayOfWeek || !periodNumber || !startTime || !endTime) {
        return res.status(400).json({ success: false, message: 'dayOfWeek, periodNumber, startTime, and endTime are required' });
    }

    const slot = await prisma.timetableSlot.create({
        data: {
            timetableId: req.params.id,
            dayOfWeek,
            periodNumber,
            startTime,
            endTime,
            subjectId: subjectId || null,
            instructorId: instructorId || null,
            roomNumber: roomNumber || null,
            slotType: slotType || 'lecture'
        },
        include: {
            subject: { select: { id: true, name: true, nameHindi: true, code: true } },
            instructor: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.status(201).json({ success: true, message: 'Slot added', data: { slot } });
}));

/**
 * @route   POST /api/timetable/:id/slots/bulk
 * @desc    Add multiple slots at once (for building entire day/week)
 * @access  Private (Admin, Principal)
 */
router.post('/:id/slots/bulk', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { slots } = req.body; // Array of slot objects

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({ success: false, message: 'slots array is required' });
    }

    const createdSlots = await prisma.timetableSlot.createMany({
        data: slots.map(s => ({
            timetableId: req.params.id,
            dayOfWeek: s.dayOfWeek,
            periodNumber: s.periodNumber,
            startTime: s.startTime,
            endTime: s.endTime,
            subjectId: s.subjectId || null,
            instructorId: s.instructorId || null,
            roomNumber: s.roomNumber || null,
            slotType: s.slotType || 'lecture'
        })),
        skipDuplicates: true
    });

    res.status(201).json({
        success: true,
        message: `${createdSlots.count} slots added`,
        data: { count: createdSlots.count }
    });
}));

/**
 * @route   PUT /api/timetable/slots/:slotId
 * @desc    Update a slot (change teacher/subject/time)
 * @access  Private (Admin, Principal)
 */
router.put('/slots/:slotId', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { subjectId, instructorId, startTime, endTime, roomNumber, slotType } = req.body;

    const slot = await prisma.timetableSlot.update({
        where: { id: req.params.slotId },
        data: {
            ...(subjectId !== undefined && { subjectId }),
            ...(instructorId !== undefined && { instructorId }),
            ...(startTime && { startTime }),
            ...(endTime && { endTime }),
            ...(roomNumber !== undefined && { roomNumber }),
            ...(slotType && { slotType })
        },
        include: {
            subject: { select: { id: true, name: true, nameHindi: true, code: true } },
            instructor: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.json({ success: true, message: 'Slot updated', data: { slot } });
}));

/**
 * @route   DELETE /api/timetable/slots/:slotId
 * @desc    Remove a slot
 * @access  Private (Admin, Principal)
 */
router.delete('/slots/:slotId', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    await prisma.timetableSlot.delete({ where: { id: req.params.slotId } });
    res.json({ success: true, message: 'Slot removed' });
}));

/**
 * @route   GET /api/timetable/live
 * @desc    Get the current running period + next period for the logged-in user
 * @access  Private
 */
router.get('/live', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    const userRole = req.user.role;
    const now = new Date();

    // Check if today is a holiday
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const holiday = await prisma.schoolCalendar.findFirst({
        where: {
            schoolId,
            date: todayStart,
            isHoliday: true
        }
    });

    if (holiday) {
        return res.json({
            success: true,
            data: {
                isHoliday: true,
                holiday: { title: holiday.title, titleHindi: holiday.titleHindi, type: holiday.type },
                currentPeriod: null,
                nextPeriod: null
            }
        });
    }

    // Get day of week
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = days[now.getDay()];

    // Get current time as HH:MM
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Build slot query based on role
    let slotWhere = {};
    if (userRole === 'instructor' || userRole === 'lab_assistant') {
        slotWhere = { instructorId: userId, dayOfWeek };
    } else if (userRole === 'student') {
        // Get student's enrolled class
        const enrollment = await prisma.classEnrollment.findFirst({
            where: { studentId: userId, status: 'active' },
            select: { classId: true }
        });
        if (!enrollment) {
            return res.json({ success: true, data: { currentPeriod: null, nextPeriod: null, message: 'No active enrollment' } });
        }
        slotWhere = {
            timetable: { classId: enrollment.classId, isActive: true },
            dayOfWeek
        };
    } else {
        // Admin/principal — show nothing specific
        return res.json({ success: true, data: { isHoliday: false, currentPeriod: null, nextPeriod: null } });
    }

    // Fetch today's slots for this user
    const todaySlots = await prisma.timetableSlot.findMany({
        where: slotWhere,
        orderBy: { periodNumber: 'asc' },
        include: {
            subject: { select: { id: true, name: true, nameHindi: true, code: true } },
            instructor: { select: { id: true, firstName: true, lastName: true } },
            timetable: {
                select: {
                    class: { select: { id: true, name: true, gradeLevel: true, section: true } }
                }
            }
        }
    });

    if (todaySlots.length === 0) {
        return res.json({ success: true, data: { isHoliday: false, currentPeriod: null, nextPeriod: null, message: 'No periods today' } });
    }

    // Find current and next period
    let currentPeriod = null;
    let nextPeriod = null;

    for (let i = 0; i < todaySlots.length; i++) {
        const slot = todaySlots[i];
        if (currentTime >= slot.startTime && currentTime < slot.endTime) {
            // Calculate progress
            const startMinutes = parseInt(slot.startTime.split(':')[0]) * 60 + parseInt(slot.startTime.split(':')[1]);
            const endMinutes = parseInt(slot.endTime.split(':')[0]) * 60 + parseInt(slot.endTime.split(':')[1]);
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const totalDuration = endMinutes - startMinutes;
            const elapsed = currentMinutes - startMinutes;
            const remaining = endMinutes - currentMinutes;
            const progressPercent = Math.round((elapsed / totalDuration) * 100);

            currentPeriod = {
                ...slot,
                elapsed,
                remaining,
                totalDuration,
                progressPercent
            };

            // Next period
            if (i + 1 < todaySlots.length) {
                nextPeriod = todaySlots[i + 1];
            }
            break;
        } else if (currentTime < slot.startTime) {
            // This is the next upcoming period
            nextPeriod = slot;

            // Calculate minutes until start
            const slotStartMinutes = parseInt(slot.startTime.split(':')[0]) * 60 + parseInt(slot.startTime.split(':')[1]);
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            nextPeriod = { ...slot, minutesUntilStart: slotStartMinutes - currentMinutes };
            break;
        }
    }

    res.json({
        success: true,
        data: {
            isHoliday: false,
            dayOfWeek,
            currentTime,
            currentPeriod,
            nextPeriod,
            totalPeriodsToday: todaySlots.length,
            allSlots: todaySlots
        }
    });
}));

/**
 * @route   GET /api/timetable/teacher/:teacherId
 * @desc    Get a teacher's full weekly schedule
 * @access  Private (Admin, Principal, or self)
 */
router.get('/teacher/:teacherId', authenticate, asyncHandler(async (req, res) => {
    const { teacherId } = req.params;

    // Authorization check
    if (req.user.role === 'student' || (req.user.role === 'instructor' && req.user.id !== teacherId)) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const slots = await prisma.timetableSlot.findMany({
        where: { instructorId: teacherId },
        orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
        include: {
            subject: { select: { id: true, name: true, nameHindi: true, code: true } },
            timetable: {
                select: {
                    class: { select: { id: true, name: true, gradeLevel: true, section: true } },
                    isActive: true
                }
            }
        }
    });

    // Group by day
    const schedule = {};
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    dayOrder.forEach(day => { schedule[day] = []; });
    slots.filter(s => s.timetable.isActive).forEach(slot => {
        schedule[slot.dayOfWeek].push(slot);
    });

    res.json({ success: true, data: { teacherId, schedule } });
}));

// ===================================================================
// CALENDAR ROUTES
// ===================================================================

/**
 * @route   GET /api/calendar
 * @desc    Get holidays/events for a month or date range
 * @access  Private
 */
router.get('/calendar', authenticate, asyncHandler(async (req, res) => {
    const { month, year, academicYearId } = req.query;
    const schoolId = req.user.schoolId;

    let where = { schoolId };

    if (academicYearId) {
        where.academicYearId = academicYearId;
    }

    if (month && year) {
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0);
        where.date = { gte: startDate, lte: endDate };
    }

    const events = await prisma.schoolCalendar.findMany({
        where,
        orderBy: { date: 'asc' },
        include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.json({ success: true, data: { events } });
}));

/**
 * @route   POST /api/calendar
 * @desc    Add a holiday/event
 * @access  Private (Admin, Principal)
 */
router.post('/calendar', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { date, title, titleHindi, type, isHoliday, source, academicYearId } = req.body;
    const schoolId = req.user.schoolId;

    if (!date || !title || !academicYearId) {
        return res.status(400).json({ success: false, message: 'date, title, and academicYearId are required' });
    }

    const event = await prisma.schoolCalendar.create({
        data: {
            schoolId,
            academicYearId,
            date: new Date(date),
            title,
            titleHindi: titleHindi || null,
            type: type || 'custom',
            isHoliday: isHoliday !== undefined ? isHoliday : true,
            source: source || 'admin_custom',
            createdById: req.user.id
        }
    });

    res.status(201).json({
        success: true,
        message: 'Calendar event added',
        messageHindi: 'कैलेंडर इवेंट जोड़ा गया',
        data: { event }
    });
}));

/**
 * @route   PUT /api/calendar/:id
 * @desc    Edit a holiday/event
 * @access  Private (Admin, Principal)
 */
router.put('/calendar/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { title, titleHindi, type, isHoliday, date } = req.body;

    const event = await prisma.schoolCalendar.update({
        where: { id: req.params.id },
        data: {
            ...(title && { title }),
            ...(titleHindi !== undefined && { titleHindi }),
            ...(type && { type }),
            ...(isHoliday !== undefined && { isHoliday }),
            ...(date && { date: new Date(date) })
        }
    });

    res.json({ success: true, message: 'Event updated', data: { event } });
}));

/**
 * @route   DELETE /api/calendar/:id
 * @desc    Remove a holiday/event
 * @access  Private (Admin, Principal)
 */
router.delete('/calendar/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    await prisma.schoolCalendar.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Event removed' });
}));

/**
 * @route   POST /api/calendar/seed-punjab
 * @desc    Seed Punjab gazetted holidays for a given academic year
 * @access  Private (Admin)
 */
router.post('/calendar/seed-punjab', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const { academicYearId, year } = req.body;
    const schoolId = req.user.schoolId;
    const baseYear = parseInt(year) || new Date().getFullYear();

    if (!academicYearId) {
        return res.status(400).json({ success: false, message: 'academicYearId is required' });
    }

    // Punjab state gazetted holidays
    const punjabHolidays = [
        { date: `${baseYear}-01-26`, title: 'Republic Day', titleHindi: 'गणतंत्र दिवस' },
        { date: `${baseYear}-02-19`, title: 'Shri Guru Ravidas Birthday', titleHindi: 'श्री गुरु रविदास जयंती' },
        { date: `${baseYear}-03-14`, title: 'Holi', titleHindi: 'होली' },
        { date: `${baseYear}-03-31`, title: 'Idul Fitr', titleHindi: 'ईद-उल-फ़ित्र' },
        { date: `${baseYear}-04-13`, title: 'Baisakhi', titleHindi: 'बैसाखी' },
        { date: `${baseYear}-04-14`, title: 'Dr. B.R. Ambedkar Birthday', titleHindi: 'डॉ. बी.आर. अम्बेडकर जयंती' },
        { date: `${baseYear}-05-01`, title: 'May Day', titleHindi: 'मई दिवस' },
        { date: `${baseYear}-06-07`, title: 'Idul Zuha', titleHindi: 'ईद-उल-जुहा' },
        { date: `${baseYear}-07-06`, title: 'Muharram', titleHindi: 'मुहर्रम' },
        { date: `${baseYear}-08-15`, title: 'Independence Day', titleHindi: 'स्वतंत्रता दिवस' },
        { date: `${baseYear}-09-05`, title: 'Milad-un-Nabi', titleHindi: 'मिलाद-उन-नबी' },
        { date: `${baseYear}-10-02`, title: 'Gandhi Jayanti', titleHindi: 'गांधी जयंती' },
        { date: `${baseYear}-10-20`, title: 'Dussehra', titleHindi: 'दशहरा' },
        { date: `${baseYear}-10-21`, title: 'Dussehra Holiday', titleHindi: 'दशहरा अवकाश' },
        { date: `${baseYear}-10-22`, title: 'Dussehra Holiday', titleHindi: 'दशहरा अवकाश' },
        { date: `${baseYear}-10-23`, title: 'Dussehra Holiday', titleHindi: 'दशहरा अवकाश' },
        { date: `${baseYear}-10-24`, title: 'Dussehra Holiday', titleHindi: 'दशहरा अवकाश' },
        { date: `${baseYear}-11-01`, title: 'Diwali', titleHindi: 'दीवाली' },
        { date: `${baseYear}-11-15`, title: 'Guru Nanak Dev Birthday', titleHindi: 'गुरु नानक देव जयंती' },
        { date: `${baseYear}-12-25`, title: 'Christmas', titleHindi: 'क्रिसमस' },
    ];

    let seededCount = 0;
    for (const h of punjabHolidays) {
        try {
            await prisma.schoolCalendar.upsert({
                where: {
                    unique_calendar_date_per_school: {
                        schoolId,
                        date: new Date(h.date)
                    }
                },
                create: {
                    schoolId,
                    academicYearId,
                    date: new Date(h.date),
                    title: h.title,
                    titleHindi: h.titleHindi,
                    type: 'gazetted_holiday',
                    isHoliday: true,
                    source: 'punjab_govt',
                    createdById: req.user.id
                },
                update: {} // Don't update if already exists
            });
            seededCount++;
        } catch (e) {
            console.warn(`Skipping holiday ${h.title}: ${e.message}`);
        }
    }

    res.json({
        success: true,
        message: `${seededCount} Punjab holidays seeded for ${baseYear}`,
        messageHindi: `${seededCount} पंजाब छुट्टियां ${baseYear} के लिए जोड़ी गईं`,
        data: { seededCount, year: baseYear }
    });
}));

module.exports = router;
