const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body, query, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');
const { asyncHandler } = require('../middleware/errorHandler');
const cloudinary = require('../services/cloudinary');
const notificationService = require('../services/notificationService');

// Configure multer for memory storage (for PDF uploads to Cloudinary)
const pdfUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

/**
 * @route   GET /api/assignments
 * @desc    Get all assignments (filtered by role and session)
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, subjectId, classId, search, includeTargets, academicYearId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Use X-Academic-Session header for session filtering
    const sessionId = academicYearId || req.headers['x-academic-session'];

    let where = { schoolId: req.user.schoolId };

    // Filter by academic session
    if (sessionId) {
        where.academicYearId = sessionId;
    }

    // Filter by status
    if (status) {
        where.status = status;
    }

    // Filter by subject
    if (subjectId) {
        where.subjectId = subjectId;
    }

    // Search in title
    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { titleHindi: { contains: search, mode: 'insensitive' } },
            { experimentNumber: { contains: search, mode: 'insensitive' } }
        ];
    }

    // For students, only show published assignments assigned to them
    if (req.user.role === 'student') {
        where.status = 'published';

        // Get student's class and groups
        const enrollments = await prisma.classEnrollment.findMany({
            where: { studentId: req.user.id, status: 'active' },
            select: { classId: true }
        });

        const groupMemberships = await prisma.groupMember.findMany({
            where: { studentId: req.user.id },
            select: { groupId: true }
        });

        const classIds = enrollments.map(e => e.classId);
        const groupIds = groupMemberships.map(g => g.groupId);

        // Build OR conditions for targets - only include conditions where IDs exist
        const orConditions = [
            { targetType: 'student', targetStudentId: req.user.id }
        ];

        if (classIds.length > 0) {
            orConditions.push({ targetType: 'class', targetClassId: { in: classIds } });
        }

        if (groupIds.length > 0) {
            orConditions.push({ targetType: 'group', targetGroupId: { in: groupIds } });
        }

        where.targets = {
            some: {
                OR: orConditions
            }
        };
    }

    // For instructors, show their assignments
    if (req.user.role === 'instructor' || req.user.role === 'lab_assistant') {
        where.createdById = req.user.id;
    }

    // Build include object
    const include = {
        subject: {
            select: { id: true, name: true, nameHindi: true, code: true }
        },
        lab: {
            select: { id: true, name: true, nameHindi: true }
        },
        createdBy: {
            select: { id: true, firstName: true, lastName: true }
        },
        _count: {
            select: { submissions: true, targets: true }
        }
    };

    // Include targets with details if requested
    if (includeTargets === 'true') {
        include.targets = {
            include: {
                targetGroup: {
                    select: { id: true, name: true }
                },
                assignedBy: {
                    select: { id: true, firstName: true, lastName: true }
                }
            }
        };
    }

    const [assignments, total] = await Promise.all([
        prisma.assignment.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: { createdAt: 'desc' },
            include
        }),
        prisma.assignment.count({ where })
    ]);

    res.json({
        success: true,
        data: {
            assignments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        }
    });
}));

/**
 * @route   GET /api/assignments/my-assigned
 * @desc    Get all assignments assigned to the current user (with target type info)
 * @access  Private (Student)
 */
router.get('/my-assigned', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get student's class IDs
    const enrollments = await prisma.classEnrollment.findMany({
        where: { studentId: userId, status: 'active' },
        select: { classId: true }
    });
    const classIds = enrollments.map(e => e.classId);

    // Get student's group IDs
    const groupMemberships = await prisma.groupMember.findMany({
        where: { studentId: userId },
        select: { groupId: true }
    });
    const groupIds = groupMemberships.map(g => g.groupId);

    // Build OR conditions - only include conditions where IDs exist
    const orConditions = [
        { targetType: 'student', targetStudentId: userId }
    ];

    if (classIds.length > 0) {
        orConditions.push({ targetType: 'class', targetClassId: { in: classIds } });
    }

    if (groupIds.length > 0) {
        orConditions.push({ targetType: 'group', targetGroupId: { in: groupIds } });
    }

    // Get all assignment targets for this student
    const targets = await prisma.assignmentTarget.findMany({
        where: {
            OR: orConditions
        },
        include: {
            assignment: {
                include: {
                    subject: {
                        select: { id: true, name: true, nameHindi: true, code: true }
                    },
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            }
        }
    });

    // Get unique assignments with their target type
    const assignmentMap = new Map();
    for (const target of targets) {
        if (target.assignment && target.assignment.status === 'published') {
            if (!assignmentMap.has(target.assignment.id)) {
                assignmentMap.set(target.assignment.id, {
                    ...target.assignment,
                    targetType: target.targetType,
                    targetId: target.targetClassId || target.targetGroupId || target.targetStudentId,
                    // Use target-specific dueDate if available, otherwise use assignment's due_date
                    dueDate: target.dueDate || target.assignment.due_date || null,
                    specialInstructions: target.specialInstructions,
                    extendedDueDate: target.extendedDueDate
                });
            }
        }
    }

    // Get submissions for these assignments
    const assignmentIds = Array.from(assignmentMap.keys());
    const submissions = await prisma.submission.findMany({
        where: {
            assignmentId: { in: assignmentIds },
            studentId: userId
        },
        include: {
            grade: {
                select: {
                    id: true,
                    totalMarks: true,
                    percentage: true,
                    gradeLetter: true,
                    isPublished: true,
                    generalRemarks: true,
                    gradedAt: true,
                    gradedBy: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            }
        }
    });

    // Create submission map
    const submissionMap = new Map();
    for (const sub of submissions) {
        submissionMap.set(sub.assignmentId, sub);
    }

    // Merge assignment data with submission info
    const assignments = Array.from(assignmentMap.values()).map(assignment => {
        const submission = submissionMap.get(assignment.id);
        const grade = submission?.grade;

        return {
            ...assignment,
            hasSubmitted: !!submission,
            submittedAt: submission?.submittedAt || null,
            submissionStatus: submission?.status || null,
            needsRevision: submission?.status === 'revision_requested',
            isGraded: !!(grade && grade.isPublished),
            grade: grade || null,
            gradeId: grade?.id || null
        };
    });

    // Sort by due date (urgent first)
    assignments.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    res.json({
        success: true,
        data: { assignments }
    });
}));

/**
 * @route   GET /api/assignments/:id
 * @desc    Get single assignment by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    // First, check access for students before fetching full assignment
    if (req.user.role === 'student') {
        // Get student's class and groups
        const enrollments = await prisma.classEnrollment.findMany({
            where: { studentId: req.user.id, status: 'active' },
            select: { classId: true }
        });

        const groupMemberships = await prisma.groupMember.findMany({
            where: { studentId: req.user.id },
            select: { groupId: true }
        });

        const classIds = enrollments.map(e => e.classId);
        const groupIds = groupMemberships.map(g => g.groupId);

        // Build OR conditions - only include conditions where IDs exist
        const orConditions = [
            { targetType: 'student', targetStudentId: req.user.id }
        ];

        if (classIds.length > 0) {
            orConditions.push({ targetType: 'class', targetClassId: { in: classIds } });
        }

        if (groupIds.length > 0) {
            orConditions.push({ targetType: 'group', targetGroupId: { in: groupIds } });
        }

        // Check if assignment is assigned to this student
        const assignmentTarget = await prisma.assignmentTarget.findFirst({
            where: {
                assignmentId: req.params.id,
                OR: orConditions
            }
        });

        if (!assignmentTarget) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to this assignment',
                messageHindi: 'आपको इस असाइनमेंट तक पहुंच नहीं है'
            });
        }
    }

    const assignment = await prisma.assignment.findUnique({
        where: { id: req.params.id },
        include: {
            subject: true,
            lab: true,
            createdBy: {
                select: { id: true, firstName: true, lastName: true, email: true }
            },
            files: true,
            targets: {
                include: {
                    targetGroup: {
                        select: { id: true, name: true, nameHindi: true }
                    }
                }
            },
            _count: {
                select: { submissions: true }
            }
        }
    });

    if (!assignment) {
        return res.status(404).json({
            success: false,
            message: 'Assignment not found',
            messageHindi: 'असाइनमेंट नहीं मिला'
        });
    }

    // Check access for students (draft assignments)
    if (req.user.role === 'student' && assignment.status !== 'published') {
        return res.status(403).json({
            success: false,
            message: 'Assignment not accessible',
            messageHindi: 'असाइनमेंट पहुंच योग्य नहीं है'
        });
    }

    // For instructors/admins, enrich targets with class/student info
    if (req.user.role !== 'student' && assignment.targets?.length > 0) {
        // Collect class and student IDs that need lookup
        const classIds = assignment.targets.filter(t => t.targetType === 'class' && t.targetClassId).map(t => t.targetClassId);
        const studentIds = assignment.targets.filter(t => t.targetType === 'student' && t.targetStudentId).map(t => t.targetStudentId);

        // Batch lookup
        const [classes, students] = await Promise.all([
            classIds.length > 0 ? prisma.class.findMany({
                where: { id: { in: classIds } },
                select: { id: true, name: true, gradeLevel: true, section: true }
            }) : [],
            studentIds.length > 0 ? prisma.user.findMany({
                where: { id: { in: studentIds } },
                select: { id: true, firstName: true, lastName: true, admissionNumber: true }
            }) : []
        ]);

        // Create lookup maps
        const classMap = {};
        classes.forEach(c => { classMap[c.id] = c; });
        const studentMap = {};
        students.forEach(s => { studentMap[s.id] = s; });

        // Enrich targets
        assignment.targets = assignment.targets.map(target => ({
            ...target,
            targetClass: target.targetClassId ? classMap[target.targetClassId] : null,
            targetStudent: target.targetStudentId ? studentMap[target.targetStudentId] : null
        }));
    }

    // Get student's submission if exists
    let userSubmission = null;
    if (req.user.role === 'student') {
        userSubmission = await prisma.submission.findFirst({
            where: {
                assignmentId: assignment.id,
                studentId: req.user.id
            },
            include: {
                files: true,
                grade: true
            },
            orderBy: { submissionNumber: 'desc' }
        });
    }

    res.json({
        success: true,
        data: {
            assignment,
            userSubmission
        }
    });
}));

/**
 * @route   POST /api/assignments
 * @desc    Create a new assignment
 * @access  Private (Instructor, Admin)
 */
router.post('/', authenticate, authorize('instructor', 'lab_assistant', 'admin', 'principal'), [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('subjectId').isUUID().withMessage('Valid subject ID is required'),
    body('assignmentType').isIn(['program', 'experiment', 'project', 'observation', 'viva_only'])
        .withMessage('Valid assignment type is required'),
    body('maxMarks').optional().isInt({ min: 1 }).withMessage('Max marks must be positive')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }

    const {
        title, titleHindi, titleRegional,
        description, descriptionHindi, descriptionRegional,
        subjectId, labId, academicYearId, experimentNumber, assignmentType,
        programmingLanguage, aim, aimHindi, theory, theoryHindi,
        procedure, procedureHindi, expectedOutput, referenceCode,
        maxMarks, passingMarks, vivaMarks, practicalMarks, outputMarks,
        lateSubmissionAllowed, latePenaltyPercent,
        status
    } = req.body;

    // Use X-Academic-Session header as fallback for academicYearId
    const sessionId = academicYearId || req.headers['x-academic-session'];

    const assignment = await prisma.assignment.create({
        data: {
            schoolId: req.user.schoolId,
            createdById: req.user.id,
            subjectId,
            labId,
            academicYearId: sessionId,
            title,
            titleHindi,
            titleRegional,
            description,
            descriptionHindi,
            descriptionRegional,
            experimentNumber,
            assignmentType,
            programmingLanguage,
            aim,
            aimHindi,
            theory,
            theoryHindi,
            procedure,
            procedureHindi,
            expectedOutput,
            referenceCode,
            maxMarks: maxMarks || 100,
            passingMarks: passingMarks || 35,
            vivaMarks: vivaMarks || 20,
            practicalMarks: practicalMarks || 60,
            outputMarks: outputMarks || 20,
            lateSubmissionAllowed: lateSubmissionAllowed !== false,
            latePenaltyPercent: latePenaltyPercent || 10,
            status: status || 'draft'
        },
        include: {
            subject: true,
            lab: true,
            createdBy: {
                select: { id: true, firstName: true, lastName: true }
            }
        }
    });

    // Log activity
    await prisma.activityLog.create({
        data: {
            userId: req.user.id,
            schoolId: req.user.schoolId,
            actionType: 'assignment',
            entityType: 'assignment',
            entityId: assignment.id,
            description: `Created assignment: ${title}`
        }
    });

    res.status(201).json({
        success: true,
        message: 'Assignment created successfully',
        messageHindi: 'असाइनमेंट सफलतापूर्वक बनाया गया',
        data: { assignment }
    });
}));

/**
 * @route   PUT /api/assignments/:id
 * @desc    Update an assignment
 * @access  Private (Owner or Admin)
 */
router.put('/:id', authenticate, authorize('instructor', 'lab_assistant', 'admin', 'principal'), asyncHandler(async (req, res) => {
    console.log('[PUT /assignments/:id] id:', req.params.id);
    console.log('[PUT /assignments/:id] body keys:', Object.keys(req.body));

    try {
        const assignment = await prisma.assignment.findUnique({
            where: { id: req.params.id }
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        // Check ownership (unless admin)
        if (req.user.role !== 'admin' && req.user.role !== 'principal' && assignment.createdById !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this assignment'
            });
        }

        // Filter out undefined values and handle dates
        const updateData = {};
        const allowedFields = [
            'title', 'titleHindi', 'description', 'descriptionHindi',
            'experimentNumber', 'assignmentType',
            'aim', 'aimHindi', 'theory', 'theoryHindi', 'procedure', 'procedureHindi',
            'expectedOutput', 'referenceCode', 'programmingLanguage',
            'maxMarks', 'passingMarks', 'vivaMarks', 'practicalMarks', 'outputMarks',
            'lateSubmissionAllowed', 'latePenaltyPercent', 'status'
        ];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Handle relation field (subjectId connects to subject relation)
        if (req.body.subjectId) {
            updateData.subject = { connect: { id: req.body.subjectId } };
        }
        if (req.body.labId) {
            updateData.lab = { connect: { id: req.body.labId } };
        }

        // Handle date fields - use snake_case as per schema
        if (req.body.publishDate) {
            updateData.publish_date = new Date(req.body.publishDate);
        }
        if (req.body.dueDate) {
            updateData.due_date = new Date(req.body.dueDate);
        }
        updateData.updatedAt = new Date();

        console.log('[PUT /assignments/:id] updateData keys:', Object.keys(updateData));

        const updatedAssignment = await prisma.assignment.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                subject: true,
                lab: true,
                files: true
            }
        });

        res.json({
            success: true,
            message: 'Assignment updated successfully',
            messageHindi: 'असाइनमेंट सफलतापूर्वक अपडेट किया गया',
            data: { assignment: updatedAssignment }
        });
    } catch (error) {
        console.error('[PUT /assignments/:id] ERROR:', error.message);
        console.error('[PUT /assignments/:id] STACK:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to update assignment: ' + error.message
        });
    }
}));

/**
 * @route   POST /api/assignments/:id/publish
 * @desc    Publish an assignment
 * @access  Private (Owner or Admin)
 */
router.post('/:id/publish', authenticate, authorize('instructor', 'lab_assistant', 'admin', 'principal'), asyncHandler(async (req, res) => {
    console.log('[POST /assignments/:id/publish] id:', req.params.id);

    try {
        const assignment = await prisma.assignment.findUnique({
            where: { id: req.params.id }
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        const updatedAssignment = await prisma.assignment.update({
            where: { id: req.params.id },
            data: {
                status: 'published',
                publish_date: new Date()
            }
        });

        // TODO: Send notifications to assigned students

        res.json({
            success: true,
            message: 'Assignment published successfully',
            messageHindi: 'असाइनमेंट सफलतापूर्वक प्रकाशित किया गया',
            data: { assignment: updatedAssignment }
        });
    } catch (error) {
        console.error('[POST /assignments/:id/publish] ERROR:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to publish: ' + error.message
        });
    }
}));

/**
 * @route   POST /api/assignments/:id/targets
 * @desc    Assign assignment to class/group/student
 * @access  Private (Instructor, Admin)
 */
router.post('/:id/targets', authenticate, authorize('instructor', 'lab_assistant', 'admin', 'principal'), [
    body('targetType').isIn(['class', 'group', 'student']).withMessage('Valid target type required'),
    body('targetId').isUUID().withMessage('Valid target ID required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const { targetType, targetId, specialInstructions, extendedDueDate, publishDate, dueDate } = req.body;

    // Get assignment details for logging
    const assignment = await prisma.assignment.findUnique({
        where: { id: req.params.id },
        select: { id: true, title: true, schoolId: true }
    });

    if (!assignment) {
        return res.status(404).json({
            success: false,
            message: 'Assignment not found'
        });
    }

    const targetData = {
        assignmentId: req.params.id,
        targetType,
        assignedById: req.user.id,
        publishDate: publishDate ? new Date(publishDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        specialInstructions,
        extendedDueDate: extendedDueDate ? new Date(extendedDueDate) : null
    };

    // Set the appropriate target ID field and get target name for logging
    let targetName = '';
    if (targetType === 'class') {
        targetData.targetClassId = targetId;
        const cls = await prisma.class.findUnique({ where: { id: targetId } });
        targetName = cls ? (cls.name || `Grade ${cls.gradeLevel}-${cls.section}`) : 'Class';
    } else if (targetType === 'group') {
        targetData.targetGroupId = targetId;
        const group = await prisma.studentGroup.findUnique({ where: { id: targetId } });
        targetName = group?.name || 'Group';
    } else if (targetType === 'student') {
        targetData.targetStudentId = targetId;
        const student = await prisma.user.findUnique({ where: { id: targetId } });
        targetName = student ? `${student.firstName} ${student.lastName}` : 'Student';
    }

    const target = await prisma.assignmentTarget.create({
        data: targetData,
        include: {
            targetGroup: {
                select: { id: true, name: true }
            }
        }
    });

    // Log the assignment action (wrapped in try-catch)
    try {
        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                schoolId: assignment.schoolId,
                actionType: 'assignment',
                entityType: 'assignment_target',
                entityId: target.id,
                description: `Assigned "${assignment.title}" to ${targetType}: ${targetName}`
            }
        });
    } catch (logError) {
        console.warn('Failed to log activity:', logError.message);
    }

    // Send notification to assigned students
    try {
        const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No deadline';
        const notificationData = {
            title: `New Work Assigned: ${assignment.title}`,
            message: `You have been assigned new work. Due: ${dueDateStr}`,
            type: 'work_assigned',
            referenceType: 'assignment',
            referenceId: assignment.id,
            actionUrl: '/my-work'
        };

        if (targetType === 'class') {
            await notificationService.notifyClass({ classId: targetId, ...notificationData });
        } else if (targetType === 'group') {
            await notificationService.notifyGroup({ groupId: targetId, ...notificationData });
        } else if (targetType === 'student') {
            await notificationService.createNotification({ userId: targetId, ...notificationData });
        }
    } catch (notifyError) {
        console.warn('Failed to send work assignment notification:', notifyError.message);
    }

    res.status(201).json({
        success: true,
        message: 'Assignment target added',
        messageHindi: 'असाइनमेंट लक्ष्य जोड़ा गया',
        data: { target }
    });
}));

/**
 * @route   PUT /api/assignments/targets/:targetId
 * @desc    Update an assignment target (reassign, change due date, lock/unlock)
 * @access  Private (Instructor, Admin)
 */
router.put('/targets/:targetId', authenticate, authorize('instructor', 'lab_assistant', 'admin', 'principal'), asyncHandler(async (req, res) => {
    try {
        const { targetId } = req.params;
        const { targetType, targetClassId, targetGroupId, targetStudentId, dueDate, isLocked, specialInstructions } = req.body;

        console.log('=== PUT /assignments/targets/:targetId ===');
        console.log('targetId:', targetId);
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('User:', req.user?.email, 'Role:', req.user?.role);

        // Validate UUID format
        if (!targetId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
            console.log('ERROR: Invalid target ID format:', targetId);
            return res.status(400).json({
                success: false,
                message: 'Invalid target ID format'
            });
        }

        const existingTarget = await prisma.assignmentTarget.findUnique({
            where: { id: targetId },
            include: { assignment: true }
        });

        console.log('Existing target found:', existingTarget ? 'Yes' : 'No');

        if (!existingTarget) {
            console.log('ERROR: Target not found with ID:', targetId);
            return res.status(404).json({
                success: false,
                message: 'Target not found'
            });
        }

        // Check ownership unless admin
        if (req.user.role !== 'admin' && req.user.role !== 'principal' && existingTarget.assignment.createdById !== req.user.id) {
            console.log('ERROR: Not authorized. Assignment createdBy:', existingTarget.assignment.createdById, 'User ID:', req.user.id);
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this target'
            });
        }

        // Build update data
        const updateData = {};

        // Handle dueDate
        if (dueDate !== undefined) {
            console.log('Setting dueDate:', dueDate);
            updateData.dueDate = dueDate ? new Date(dueDate) : null;
        }

        // Handle specialInstructions
        if (specialInstructions !== undefined) {
            console.log('Setting specialInstructions:', specialInstructions);
            updateData.specialInstructions = specialInstructions || null;
        }

        // Handle isLocked (only if column exists)
        if (typeof isLocked === 'boolean') {
            console.log('Setting isLocked:', isLocked);
            // Note: This will fail if column doesn't exist - that's expected until migration
            updateData.isLocked = isLocked;
        }

        // Handle target type changes
        if (targetType) {
            console.log('Setting targetType:', targetType);
            updateData.targetType = targetType;
        }

        // Handle target IDs based on type
        if (targetType === 'class' || targetClassId !== undefined) {
            console.log('Setting targetClassId:', targetClassId);
            updateData.targetClassId = targetClassId || null;
            updateData.targetGroupId = null;
            updateData.targetStudentId = null;
        }

        if (targetType === 'group' || targetGroupId !== undefined) {
            console.log('Setting targetGroupId:', targetGroupId);
            updateData.targetGroupId = targetGroupId || null;
            if (targetType === 'group') {
                updateData.targetClassId = null;
                updateData.targetStudentId = null;
            }
        }

        if (targetType === 'student' || targetStudentId !== undefined) {
            console.log('Setting targetStudentId:', targetStudentId);
            updateData.targetStudentId = targetStudentId || null;
            if (targetType === 'student') {
                updateData.targetClassId = null;
                updateData.targetGroupId = null;
            }
        }

        console.log('Final updateData:', JSON.stringify(updateData, null, 2));

        // Remove isLocked if it's causing issues (column might not exist)
        let safeUpdateData = { ...updateData };
        try {
            const updatedTarget = await prisma.assignmentTarget.update({
                where: { id: targetId },
                data: safeUpdateData,
                include: {
                    targetGroup: { select: { id: true, name: true } },
                    assignment: { select: { id: true, title: true } }
                }
            });

            console.log('Update successful. Updated target:', updatedTarget.id);

            res.json({
                success: true,
                message: 'Target updated successfully',
                data: { target: updatedTarget }
            });
        } catch (prismaError) {
            console.error('Prisma update error:', prismaError.message);
            console.error('Prisma error code:', prismaError.code);

            // If error is about isLocked column not existing, retry without it
            if (prismaError.message.includes('is_locked') || prismaError.code === 'P2025') {
                console.log('Retrying without isLocked field...');
                delete safeUpdateData.isLocked;

                const updatedTarget = await prisma.assignmentTarget.update({
                    where: { id: targetId },
                    data: safeUpdateData,
                    include: {
                        targetGroup: { select: { id: true, name: true } },
                        assignment: { select: { id: true, title: true } }
                    }
                });

                console.log('Retry successful without isLocked');
                return res.json({
                    success: true,
                    message: 'Target updated successfully',
                    data: { target: updatedTarget }
                });
            }

            throw prismaError;
        }
    } catch (error) {
        console.error('=== ERROR in PUT /assignments/targets/:targetId ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        res.status(500).json({
            success: false,
            message: 'Failed to update target: ' + error.message
        });
    }
}));

/**
 * @route   DELETE /api/assignments/targets/:targetId
 * @desc    Remove an assignment target
 * @access  Private (Instructor, Admin)
 */
router.delete('/targets/:targetId', authenticate, authorize('instructor', 'lab_assistant', 'admin', 'principal'), asyncHandler(async (req, res) => {
    const { targetId } = req.params;

    const target = await prisma.assignmentTarget.findUnique({
        where: { id: targetId },
        include: {
            assignment: true,
            targetGroup: { select: { name: true } }
        }
    });

    if (!target) {
        return res.status(404).json({
            success: false,
            message: 'Target not found'
        });
    }

    // Check ownership unless admin
    if (req.user.role !== 'admin' && req.user.role !== 'principal' && target.assignment.createdById !== req.user.id) {
        return res.status(403).json({
            success: false,
            message: 'Not authorized to remove this target'
        });
    }

    // Get target name for logging
    let targetName = '';
    if (target.targetType === 'class' && target.targetClassId) {
        const cls = await prisma.class.findUnique({ where: { id: target.targetClassId } });
        targetName = cls ? (cls.name || `Grade ${cls.gradeLevel}-${cls.section}`) : 'Class';
    } else if (target.targetType === 'group') {
        targetName = target.targetGroup?.name || 'Group';
    } else if (target.targetType === 'student' && target.targetStudentId) {
        const student = await prisma.user.findUnique({ where: { id: target.targetStudentId } });
        targetName = student ? `${student.firstName} ${student.lastName}` : 'Student';
    }

    await prisma.assignmentTarget.delete({
        where: { id: targetId }
    });

    // Log the removal (wrapped in try-catch to not break delete)
    try {
        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                schoolId: target.assignment.schoolId,
                actionType: 'assignment',
                entityType: 'assignment_target',
                entityId: targetId,
                description: `Removed "${target.assignment.title}" from ${target.targetType}: ${targetName}`
            }
        });
    } catch (logError) {
        console.warn('Failed to log activity:', logError.message);
    }

    res.json({
        success: true,
        message: 'Target removed',
        messageHindi: 'लक्ष्य हटाया गया'
    });
}));

/**
 * @route   POST /api/assignments/:id/files
 * @desc    Upload files to assignment
 * @access  Private (Owner)
 */
router.post('/:id/files', authenticate, authorize('instructor', 'lab_assistant', 'admin'), uploadMultiple, asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No files uploaded'
        });
    }

    const files = await Promise.all(req.files.map(file =>
        prisma.assignmentFile.create({
            data: {
                assignmentId: req.params.id,
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
                fileUrl: `/uploads/assignments/${file.filename}`,
                uploadedById: req.user.id
            }
        })
    ));

    res.status(201).json({
        success: true,
        message: 'Files uploaded successfully',
        messageHindi: 'फ़ाइलें सफलतापूर्वक अपलोड की गईं',
        data: { files }
    });
}));

/**
 * @route   POST /api/assignments/:id/pdf
 * @desc    Upload PDF attachment to assignment
 * @access  Private (Owner or Admin)
 */
router.post('/:id/pdf', authenticate, authorize('instructor', 'lab_assistant', 'admin', 'principal'), pdfUpload.single('pdf'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No PDF file uploaded' });
    }

    const assignment = await prisma.assignment.findUnique({
        where: { id: req.params.id }
    });

    if (!assignment) {
        return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Check ownership unless admin
    if (req.user.role !== 'admin' && req.user.role !== 'principal' && assignment.createdById !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this assignment' });
    }

    // Delete old PDF from Cloudinary if exists
    if (assignment.pdfCloudinaryId) {
        try {
            await cloudinary.deleteFile(assignment.pdfCloudinaryId, 'raw');
        } catch (err) {
            console.error('Failed to delete old PDF:', err.message);
        }
    }

    // Upload to Cloudinary
    if (!cloudinary.isConfigured()) {
        return res.status(503).json({ success: false, message: 'File storage not configured' });
    }

    const result = await cloudinary.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
    );

    // Update assignment with PDF info
    const updated = await prisma.assignment.update({
        where: { id: req.params.id },
        data: {
            pdfAttachmentUrl: result.secureUrl,
            pdfAttachmentName: req.file.originalname,
            pdfCloudinaryId: result.publicId
        }
    });

    res.json({
        success: true,
        message: 'PDF uploaded successfully',
        data: {
            pdfAttachmentUrl: updated.pdfAttachmentUrl,
            pdfAttachmentName: updated.pdfAttachmentName
        }
    });
}));

/**
 * @route   DELETE /api/assignments/:id/pdf
 * @desc    Remove PDF attachment from assignment
 * @access  Private (Owner or Admin)
 */
router.delete('/:id/pdf', authenticate, authorize('instructor', 'lab_assistant', 'admin', 'principal'), asyncHandler(async (req, res) => {
    const assignment = await prisma.assignment.findUnique({
        where: { id: req.params.id }
    });

    if (!assignment) {
        return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Check ownership unless admin
    if (req.user.role !== 'admin' && req.user.role !== 'principal' && assignment.createdById !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this assignment' });
    }

    // Delete from Cloudinary if exists
    if (assignment.pdfCloudinaryId) {
        try {
            await cloudinary.deleteFile(assignment.pdfCloudinaryId, 'raw');
        } catch (err) {
            console.error('Failed to delete PDF:', err.message);
        }
    }

    // Clear PDF fields
    await prisma.assignment.update({
        where: { id: req.params.id },
        data: {
            pdfAttachmentUrl: null,
            pdfAttachmentName: null,
            pdfCloudinaryId: null
        }
    });

    res.json({
        success: true,
        message: 'PDF removed successfully'
    });
}));

/**
 * @route   DELETE /api/assignments/:id
 * @desc    Delete an assignment
 * @access  Private (Owner or Admin)
 */
router.delete('/:id', authenticate, authorize('instructor', 'admin', 'principal'), asyncHandler(async (req, res) => {
    const assignment = await prisma.assignment.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { submissions: true } } }
    });

    if (!assignment) {
        return res.status(404).json({
            success: false,
            message: 'Assignment not found'
        });
    }

    // Check if assignment has submissions
    if (assignment._count.submissions > 0) {
        return res.status(400).json({
            success: false,
            message: 'Cannot delete assignment with existing submissions. Archive it instead.',
            messageHindi: 'मौजूदा सबमिशन वाले असाइनमेंट को हटाया नहीं जा सकता। इसे संग्रहित करें।'
        });
    }

    // Delete PDF from Cloudinary if exists
    if (assignment.pdfCloudinaryId) {
        try {
            await cloudinary.deleteFile(assignment.pdfCloudinaryId, 'raw');
        } catch (err) {
            console.error('Failed to delete PDF:', err.message);
        }
    }

    await prisma.assignment.delete({
        where: { id: req.params.id }
    });

    res.json({
        success: true,
        message: 'Assignment deleted successfully',
        messageHindi: 'असाइनमेंट सफलतापूर्वक हटाया गया'
    });
}));

module.exports = router;
