const cron = require('node-cron');
const prisma = require('../config/database');
const logger = console; // Use console as logger fallback

let ioInstance = null;

const setSocketIO = (io) => {
    ioInstance = io;
};

/**
 * Ensure every school has a current academic session.
 * If no session covers today's date, auto-create one (Apr 1 → Mar 31).
 * Also rotates the isCurrent flag when a new academic year starts.
 */
const ensureCurrentSession = async () => {
    try {
        const schools = await prisma.school.findMany({ select: { id: true, name: true, academicYearStart: true } });

        for (const school of schools) {
            const now = new Date();
            const startMonth = school.academicYearStart || 4; // Default April

            // Calculate current academic year boundaries
            let yearStart, yearEnd;
            if (now.getMonth() + 1 >= startMonth) {
                // We are in the academic year that started this calendar year
                yearStart = new Date(now.getFullYear(), startMonth - 1, 1);
                yearEnd = new Date(now.getFullYear() + 1, startMonth - 1, 0); // Last day of month before startMonth next year
            } else {
                // We are in the academic year that started last calendar year
                yearStart = new Date(now.getFullYear() - 1, startMonth - 1, 1);
                yearEnd = new Date(now.getFullYear(), startMonth - 1, 0);
            }

            // Generate year label (e.g., "2026-27")
            const startYear = yearStart.getFullYear();
            const endYear = yearEnd.getFullYear();
            const yearLabel = `${startYear}-${String(endYear).slice(-2)}`;

            // Check if this session already exists
            const existingSession = await prisma.academicYear.findFirst({
                where: {
                    schoolId: school.id,
                    yearLabel
                }
            });

            if (!existingSession) {
                // Create the session
                await prisma.academicYear.create({
                    data: {
                        schoolId: school.id,
                        yearLabel,
                        startDate: yearStart,
                        endDate: yearEnd,
                        isCurrent: true
                    }
                });
                logger.info(`[Session] Auto-created session ${yearLabel} for school "${school.name}"`);
            }

            // Ensure only the correct session is marked as current
            // First, find the session that covers today
            const currentSession = await prisma.academicYear.findFirst({
                where: {
                    schoolId: school.id,
                    startDate: { lte: now },
                    endDate: { gte: now }
                }
            });

            if (currentSession) {
                // Set all others to not current
                await prisma.academicYear.updateMany({
                    where: { schoolId: school.id, id: { not: currentSession.id }, isCurrent: true },
                    data: { isCurrent: false }
                });
                // Ensure this one is current
                if (!currentSession.isCurrent) {
                    await prisma.academicYear.update({
                        where: { id: currentSession.id },
                        data: { isCurrent: true }
                    });
                    logger.info(`[Session] Rotated current session to ${currentSession.yearLabel} for school "${school.name}"`);
                }
            }
        }
    } catch (error) {
        logger.error('[Session] Error in ensureCurrentSession:', error.message);
    }
};

const checkTrainingDelays = async () => {
    try {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const delayedProgress = await prisma.studentTrainingProgress.findMany({
            where: {
                overallProgress: { lt: 100 },
                lastActiveAt: { lt: threeDaysAgo },
            },
            include: {
                student: { include: { enrollments: true } },
                module: true
            }
        });

        if (delayedProgress.length === 0) return;

        // Group by classId to notify instructors efficiently
        const classDelays = {}; 

        for (const progress of delayedProgress) {
            // Notify student
            await prisma.notification.create({
                data: {
                    userId: progress.studentId,
                    title: 'Training Module Delayed',
                    message: `You haven't worked on "${progress.module.title}" for over 3 days. Pick up right where you left off!`,
                    type: 'training_alert',
                    action_url: `/training/${progress.moduleId}`
                }
            });

            // Add to instructor aggregation
            for (const enrollment of progress.student.enrollments) {
                if (enrollment.status === 'active') {
                    if (!classDelays[enrollment.classId]) {
                        classDelays[enrollment.classId] = [];
                    }
                    classDelays[enrollment.classId].push({
                        studentName: `${progress.student.firstName} ${progress.student.lastName}`,
                        moduleTitle: progress.module.title
                    });
                }
            }
        }

        // Notify instructors of those classes
        for (const [classId, delays] of Object.entries(classDelays)) {
            const classData = await prisma.class.findUnique({
                where: { id: classId },
            });
            if (classData && classData.classTeacherId) {
                // Formatting delay list to not overwhelm the UI
                const delayList = delays.slice(0, 3).map(d => `${d.studentName} (${d.moduleTitle})`).join(', ');
                const moreText = delays.length > 3 ? ` and ${delays.length - 3} others` : '';
                await prisma.notification.create({
                    data: {
                        userId: classData.classTeacherId,
                        title: 'Students Falling Behind',
                        message: `${delays.length} student(s) in ${classData.name} are delayed in their training: ${delayList}${moreText}.`,
                        type: 'training_alert',
                        action_url: `/classes/${classId}`
                    }
                });
            }
        }
        logger.info(`[Training Cron] Processed ${delayedProgress.length} training delays.`);
    } catch (error) {
        logger.error('[Training Cron] Error processing delays:', error.message);
    }
};

const initCronJobs = () => {
    // Run session check on startup
    ensureCurrentSession();
    // Run every day at midnight
    cron.schedule('0 0 * * *', async () => {
        logger.info('Running cron job: Cleaning up trash items & checking training delays');
        
        // 1. Check training delays Daily
        await checkTrainingDelays();

        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Find documents to delete
            const documentsToDelete = await prisma.document.findMany({
                where: {
                    deletedAt: {
                        lt: thirtyDaysAgo
                    }
                }
            });

            if (documentsToDelete.length > 0) {
                // Determine unique users to update storage
                const userStorageUpdates = {};
                for (const doc of documentsToDelete) {
                    if (doc.updatedById) { // Assuming uploadedById is the owner, or we use createdBy. Document model has uploadedById ? 
                        // Let's check schema. It has `uploadedById`.
                        // But wait, the previous code for permanent delete used `uploadedBy`.
                        // Let's assume `uploadedById` is the field.
                        if (!userStorageUpdates[doc.uploadedById]) {
                            userStorageUpdates[doc.uploadedById] = 0n;
                        }
                        userStorageUpdates[doc.uploadedById] += BigInt(doc.fileSize);
                    }
                }

                // Delete documents
                const deleteResult = await prisma.document.deleteMany({
                    where: {
                        deletedAt: {
                            lt: thirtyDaysAgo
                        }
                    }
                });

                logger.info(`Deleted ${deleteResult.count} old documents from trash`);

                // Update storage for users
                for (const [userId, bytesToRemove] of Object.entries(userStorageUpdates)) {
                    await prisma.user.update({
                        where: { id: userId },
                        data: {
                            storageUsedBytes: {
                                decrement: bytesToRemove
                            }
                        }
                    }).catch(err => logger.error(`Failed to update storage for user ${userId} in cron: ${err.message}`));
                }
            } else {
                logger.info('No documents to clean up');
            }
        } catch (error) {
            logger.error('Error running trash cleanup cron job:', error);
        }

        // Also check/rotate academic sessions at midnight
        await ensureCurrentSession();
    });

    // Keep-alive ping every 4 minutes to prevent Neon DB cold starts
    cron.schedule('*/4 * * * *', async () => {
        try {
            await prisma.$queryRaw`SELECT 1`;
            logger.info('DB keep-alive ping OK');
        } catch (error) {
            logger.error('DB keep-alive ping failed:', error.message);
        }
    });

    // ===========================================
    // TIMETABLE: 5-minute-before notification
    // Runs every minute, checks for periods starting within 5 minutes
    // ===========================================
    cron.schedule('* * * * *', async () => {
        if (!ioInstance) return;

        try {
            const now = new Date();
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayOfWeek = days[now.getDay()];

            // Skip weekday check — just skip Sunday
            if (dayOfWeek === 'sunday') return;

            // Check if today is a holiday for any school
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const holidays = await prisma.schoolCalendar.findMany({
                where: { date: todayStart, isHoliday: true },
                select: { schoolId: true }
            });
            const holidaySchoolIds = new Set(holidays.map(h => h.schoolId));

            // Current time + 5 minutes
            const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);
            const targetTime = `${String(fiveMinLater.getHours()).padStart(2, '0')}:${String(fiveMinLater.getMinutes()).padStart(2, '0')}`;

            // Find slots that start at exactly targetTime today
            const upcomingSlots = await prisma.timetableSlot.findMany({
                where: {
                    dayOfWeek,
                    startTime: targetTime,
                    timetable: { isActive: true },
                    slotType: { in: ['lecture', 'lab'] } // Only notify for real periods, not breaks
                },
                include: {
                    subject: { select: { name: true, nameHindi: true, code: true } },
                    instructor: { select: { id: true, firstName: true, lastName: true } },
                    timetable: {
                        select: {
                            schoolId: true,
                            class: {
                                select: {
                                    id: true, name: true,
                                    classEnrollments: {
                                        where: { status: 'active' },
                                        select: { studentId: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (upcomingSlots.length === 0) return;

            for (const slot of upcomingSlots) {
                const schoolId = slot.timetable.schoolId;

                // Skip if school is on holiday
                if (holidaySchoolIds.has(schoolId)) continue;

                const notification = {
                    type: 'timetable:period-starting',
                    periodNumber: slot.periodNumber,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    subject: slot.subject?.name || 'Period',
                    subjectHindi: slot.subject?.nameHindi || null,
                    subjectCode: slot.subject?.code || null,
                    roomNumber: slot.roomNumber,
                    instructor: slot.instructor ? `${slot.instructor.firstName} ${slot.instructor.lastName}` : null,
                    className: slot.timetable.class?.name || '',
                    minutesUntil: 5,
                    message: `${slot.subject?.name || 'Next period'} starts in 5 minutes`,
                    messageHindi: `${slot.subject?.nameHindi || 'अगली कक्षा'} 5 मिनट में शुरू होगी`
                };

                // Notify the instructor
                if (slot.instructor?.id) {
                    ioInstance.to(`user-${slot.instructor.id}`).emit('timetable:period-starting', notification);
                }

                // Notify all enrolled students
                const studentIds = slot.timetable.class?.classEnrollments?.map(e => e.studentId) || [];
                for (const studentId of studentIds) {
                    ioInstance.to(`user-${studentId}`).emit('timetable:period-starting', notification);
                }
            }

            if (upcomingSlots.length > 0) {
                logger.info(`[Timetable Cron] Sent ${upcomingSlots.length} period notifications for ${targetTime}`);
            }
        } catch (error) {
            // Quiet fail — don't crash the server
            logger.error('[Timetable Cron] Error:', error.message);
        }
    });

    logger.info('Cron jobs initialized (with DB keep-alive + timetable notifications)');
};

module.exports = { initCronJobs, setSocketIO, ensureCurrentSession };
