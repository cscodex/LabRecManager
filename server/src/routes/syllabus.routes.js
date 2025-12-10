const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/syllabus
 * @desc    Get all syllabi for school
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { subjectId, classId, academicYearId } = req.query;

    let where = { schoolId: req.user.schoolId };
    if (subjectId) where.subjectId = subjectId;
    if (classId) where.classId = classId;
    if (academicYearId) where.academicYearId = academicYearId;

    const syllabi = await prisma.syllabus.findMany({
        where,
        include: {
            subject: { select: { id: true, name: true, nameHindi: true, code: true } },
            class: { select: { id: true, name: true, gradeLevel: true, section: true } },
            academicYear: { select: { yearLabel: true } },
            _count: { select: { units: true } }
        }
    });

    res.json({ success: true, data: { syllabi } });
}));

/**
 * @route   GET /api/syllabus/:id
 * @desc    Get syllabus with units and topics
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const syllabus = await prisma.syllabus.findUnique({
        where: { id: req.params.id },
        include: {
            subject: true,
            class: true,
            units: {
                orderBy: { sequenceOrder: 'asc' },
                include: {
                    topics: {
                        orderBy: { sequenceOrder: 'asc' },
                        include: {
                            assignmentMappings: {
                                include: {
                                    assignment: { select: { id: true, title: true, titleHindi: true, status: true } }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!syllabus) {
        return res.status(404).json({ success: false, message: 'Syllabus not found' });
    }

    res.json({ success: true, data: { syllabus } });
}));

/**
 * @route   POST /api/syllabus
 * @desc    Create new syllabus
 * @access  Private (Admin, Instructor)
 */
router.post('/', authenticate, authorize('admin', 'principal', 'instructor'), [
    body('name').trim().notEmpty(),
    body('subjectId').isUUID(),
    body('classId').isUUID(),
    body('academicYearId').isUUID()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, nameHindi, subjectId, classId, academicYearId, boardReference, totalHours } = req.body;

    const syllabus = await prisma.syllabus.create({
        data: {
            schoolId: req.user.schoolId,
            name,
            nameHindi,
            subjectId,
            classId,
            academicYearId,
            boardReference,
            totalHours,
            createdById: req.user.id
        }
    });

    res.status(201).json({
        success: true,
        message: 'Syllabus created',
        messageHindi: 'पाठ्यक्रम बनाया गया',
        data: { syllabus }
    });
}));

/**
 * @route   POST /api/syllabus/:id/units
 * @desc    Add unit to syllabus
 * @access  Private (Admin, Instructor)
 */
router.post('/:id/units', authenticate, authorize('admin', 'instructor'), asyncHandler(async (req, res) => {
    const { unitNumber, name, nameHindi, description, expectedHours, weightagePercent, sequenceOrder } = req.body;

    const unit = await prisma.syllabusUnit.create({
        data: {
            syllabusId: req.params.id,
            unitNumber,
            name,
            nameHindi,
            description,
            expectedHours,
            weightagePercent,
            sequenceOrder
        }
    });

    res.status(201).json({ success: true, data: { unit } });
}));

/**
 * @route   POST /api/syllabus/units/:unitId/topics
 * @desc    Add topic to unit
 * @access  Private (Admin, Instructor)
 */
router.post('/units/:unitId/topics', authenticate, authorize('admin', 'instructor'), asyncHandler(async (req, res) => {
    const { topicNumber, name, nameHindi, learningObjectives, learningObjectivesHindi, expectedHours, isPractical, sequenceOrder } = req.body;

    const topic = await prisma.syllabusTopic.create({
        data: {
            unitId: req.params.unitId,
            topicNumber,
            name,
            nameHindi,
            learningObjectives,
            learningObjectivesHindi,
            expectedHours,
            isPractical,
            sequenceOrder
        }
    });

    res.status(201).json({ success: true, data: { topic } });
}));

/**
 * @route   POST /api/syllabus/topics/:topicId/map-assignment
 * @desc    Map assignment to topic
 * @access  Private (Instructor)
 */
router.post('/topics/:topicId/map-assignment', authenticate, authorize('admin', 'instructor'), asyncHandler(async (req, res) => {
    const { assignmentId, coveragePercent } = req.body;

    const mapping = await prisma.assignmentTopicMapping.create({
        data: {
            topicId: req.params.topicId,
            assignmentId,
            coveragePercent: coveragePercent || 100
        }
    });

    res.status(201).json({ success: true, data: { mapping } });
}));

/**
 * @route   GET /api/syllabus/:id/student-progress/:studentId
 * @desc    Get student's progress for a syllabus
 * @access  Private
 */
router.get('/:id/student-progress/:studentId', authenticate, asyncHandler(async (req, res) => {
    const { id: syllabusId, studentId } = req.params;

    // Authorization: students can only view their own progress
    if (req.user.role === 'student' && req.user.id !== studentId) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Get syllabus with topics
    const syllabus = await prisma.syllabus.findUnique({
        where: { id: syllabusId },
        include: {
            units: {
                include: {
                    topics: {
                        include: {
                            progress: { where: { studentId } },
                            assignmentMappings: {
                                include: {
                                    assignment: {
                                        include: {
                                            submissions: {
                                                where: { studentId },
                                                include: { grade: true },
                                                take: 1,
                                                orderBy: { submissionNumber: 'desc' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    // Calculate completion stats
    let totalTopics = 0;
    let completedTopics = 0;
    let inProgressTopics = 0;

    syllabus.units.forEach(unit => {
        unit.topics.forEach(topic => {
            totalTopics++;
            const progress = topic.progress[0];
            if (progress?.status === 'completed' || progress?.status === 'verified') {
                completedTopics++;
            } else if (progress?.status === 'in_progress') {
                inProgressTopics++;
            }
        });
    });

    const completionPercent = totalTopics > 0 ? ((completedTopics / totalTopics) * 100).toFixed(2) : 0;

    res.json({
        success: true,
        data: {
            syllabus,
            stats: { totalTopics, completedTopics, inProgressTopics, completionPercent }
        }
    });
}));

/**
 * @route   PUT /api/syllabus/topics/:topicId/progress
 * @desc    Update student's topic progress
 * @access  Private
 */
router.put('/topics/:topicId/progress', authenticate, asyncHandler(async (req, res) => {
    const { topicId } = req.params;
    const { studentId, status, completionPercent, remarks } = req.body;

    // Determine student ID (self for students, specified for instructors)
    const targetStudentId = req.user.role === 'student' ? req.user.id : studentId;

    const progress = await prisma.studentTopicProgress.upsert({
        where: {
            studentId_topicId: { studentId: targetStudentId, topicId }
        },
        create: {
            studentId: targetStudentId,
            topicId,
            status,
            completionPercent,
            completedAt: status === 'completed' ? new Date() : null,
            verifiedBy: status === 'verified' ? req.user.id : null,
            verifiedAt: status === 'verified' ? new Date() : null,
            remarks
        },
        update: {
            status,
            completionPercent,
            completedAt: status === 'completed' ? new Date() : undefined,
            verifiedBy: status === 'verified' ? req.user.id : undefined,
            verifiedAt: status === 'verified' ? new Date() : undefined,
            remarks,
            updatedAt: new Date()
        }
    });

    res.json({
        success: true,
        message: 'Progress updated',
        messageHindi: 'प्रगति अपडेट की गई',
        data: { progress }
    });
}));

/**
 * @route   GET /api/syllabus/:id/class-progress
 * @desc    Get class-level syllabus progress (for instructors)
 * @access  Private (Instructor, Admin)
 */
router.get('/:id/class-progress', authenticate, authorize('instructor', 'lab_assistant', 'admin', 'principal'), asyncHandler(async (req, res) => {
    const { id: syllabusId } = req.params;

    const syllabus = await prisma.syllabus.findUnique({
        where: { id: syllabusId },
        include: {
            class: {
                include: {
                    enrollments: {
                        where: { status: 'active' },
                        include: {
                            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } }
                        }
                    }
                }
            },
            units: { include: { topics: true } }
        }
    });

    // Count total topics
    const totalTopics = syllabus.units.reduce((sum, unit) => sum + unit.topics.length, 0);
    const topicIds = syllabus.units.flatMap(u => u.topics.map(t => t.id));

    // Get progress for all students
    const studentProgress = await Promise.all(
        syllabus.class.enrollments.map(async (enrollment) => {
            const progress = await prisma.studentTopicProgress.findMany({
                where: { studentId: enrollment.studentId, topicId: { in: topicIds } }
            });

            const completed = progress.filter(p => p.status === 'completed' || p.status === 'verified').length;
            const percent = totalTopics > 0 ? ((completed / totalTopics) * 100).toFixed(2) : 0;

            return {
                student: enrollment.student,
                rollNumber: enrollment.rollNumber,
                completedTopics: completed,
                totalTopics,
                completionPercent: parseFloat(percent)
            };
        })
    );

    // Sort by completion
    studentProgress.sort((a, b) => b.completionPercent - a.completionPercent);

    // Class stats
    const avgCompletion = studentProgress.length > 0
        ? (studentProgress.reduce((sum, s) => sum + s.completionPercent, 0) / studentProgress.length).toFixed(2)
        : 0;

    res.json({
        success: true,
        data: {
            syllabus: { id: syllabus.id, name: syllabus.name, nameHindi: syllabus.nameHindi },
            totalTopics,
            studentProgress,
            classStats: {
                totalStudents: studentProgress.length,
                avgCompletionPercent: parseFloat(avgCompletion),
                studentsAt100: studentProgress.filter(s => s.completionPercent === 100).length,
                studentsBelow50: studentProgress.filter(s => s.completionPercent < 50).length
            }
        }
    });
}));

/**
 * @route   GET /api/syllabus/department/:departmentId/dashboard
 * @desc    Department-level syllabus progress dashboard
 * @access  Private (Admin, Principal, Department Head)
 */
router.get('/department/:departmentId/dashboard', authenticate, authorize('admin', 'principal', 'instructor'), asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const { academicYearId } = req.query;

    // Get department with subjects
    const department = await prisma.department.findUnique({
        where: { id: departmentId },
        include: {
            head: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    // Get all syllabi for this department's subjects in the academic year
    const syllabi = await prisma.syllabus.findMany({
        where: {
            schoolId: req.user.schoolId,
            academicYearId,
            subject: { code: { startsWith: department.code?.split('-')[0] || '' } }
        },
        include: {
            subject: { select: { name: true, nameHindi: true } },
            class: { select: { name: true, gradeLevel: true, section: true } },
            units: { include: { topics: true } }
        }
    });

    // Calculate progress for each syllabus
    const syllabusProgress = await Promise.all(
        syllabi.map(async (syl) => {
            const topicIds = syl.units.flatMap(u => u.topics.map(t => t.id));
            const totalTopics = topicIds.length;

            // Get all student progress
            const allProgress = await prisma.studentTopicProgress.findMany({
                where: { topicId: { in: topicIds }, status: { in: ['completed', 'verified'] } }
            });

            // Get enrolled students count
            const enrolledCount = await prisma.classEnrollment.count({
                where: { classId: syl.classId, status: 'active' }
            });

            const avgCompletion = enrolledCount > 0 && totalTopics > 0
                ? ((allProgress.length / (enrolledCount * totalTopics)) * 100).toFixed(2)
                : 0;

            return {
                syllabusId: syl.id,
                syllabusName: syl.name,
                subject: syl.subject,
                class: syl.class,
                totalTopics,
                enrolledStudents: enrolledCount,
                avgCompletionPercent: parseFloat(avgCompletion)
            };
        })
    );

    // Overall department stats
    const overallAvg = syllabusProgress.length > 0
        ? (syllabusProgress.reduce((sum, s) => sum + s.avgCompletionPercent, 0) / syllabusProgress.length).toFixed(2)
        : 0;

    res.json({
        success: true,
        data: {
            department,
            syllabusProgress,
            overallStats: {
                totalSyllabi: syllabusProgress.length,
                avgDepartmentCompletion: parseFloat(overallAvg)
            }
        }
    });
}));

module.exports = router;
