const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { grading } = require('../config/constants');

/**
 * Calculate grade letter from percentage
 */
const calculateGradeLetter = (percentage) => {
    for (const grade of grading.gradeScale) {
        if (percentage >= grade.minPercent) {
            return { letter: grade.letter, points: grade.points };
        }
    }
    return { letter: 'F', points: 0 };
};

/**
 * @route   GET /api/grades
 * @desc    Get grades (filtered by role)
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, submissionId, studentId, isPublished } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};

    // Students can only see their published grades
    if (req.user.role === 'student') {
        where.submission = {
            studentId: req.user.id
        };
        where.isPublished = true;
    } else {
        // Filter by published status
        if (isPublished !== undefined) {
            where.isPublished = isPublished === 'true';
        }

        if (studentId) {
            where.studentId = studentId;
        }
    }

    if (submissionId) {
        where.submissionId = submissionId;
    }

    const [grades, total] = await Promise.all([
        prisma.grade.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: { gradedAt: 'desc' },
            include: {
                submission: {
                    include: {
                        assignment: {
                            select: {
                                id: true,
                                title: true,
                                titleHindi: true,
                                experimentNumber: true,
                                maxMarks: true
                            }
                        },
                        student: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                admissionNumber: true
                            }
                        }
                    }
                },
                gradedBy: {
                    select: { id: true, firstName: true, lastName: true }
                }
            }
        }),
        prisma.grade.count({ where })
    ]);

    res.json({
        success: true,
        data: {
            grades,
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
 * @route   POST /api/grades
 * @desc    Grade a submission
 * @access  Private (Instructor)
 */
router.post('/', authenticate, authorize('instructor', 'lab_assistant', 'admin'), [
    body('submissionId').isUUID().withMessage('Valid submission ID required'),
    body('practicalMarks').isFloat({ min: 0 }).withMessage('Valid practical marks required'),
    body('outputMarks').isFloat({ min: 0 }).withMessage('Valid output marks required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const {
        submissionId,
        practicalMarks, outputMarks, vivaMarks,
        codeFeedback, codeFeedbackHindi,
        outputFeedback,
        generalRemarks, generalRemarksHindi,
        isPublished
    } = req.body;

    // Get submission with assignment
    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
            assignment: true,
            vivaSessions: {
                where: { status: 'completed' },
                orderBy: { actualEndTime: 'desc' },
                take: 1
            }
        }
    });

    if (!submission) {
        return res.status(404).json({
            success: false,
            message: 'Submission not found'
        });
    }

    // Check if already graded
    const existingGrade = await prisma.grade.findUnique({
        where: { submissionId }
    });

    if (existingGrade) {
        return res.status(400).json({
            success: false,
            message: 'Submission already graded. Use PUT to update.',
            messageHindi: 'सबमिशन पहले से ग्रेड किया गया है। अपडेट करने के लिए PUT का उपयोग करें।'
        });
    }

    // Get viva marks from completed session if available
    let finalVivaMarks = vivaMarks || 0;
    if (submission.vivaSessions.length > 0 && !vivaMarks) {
        finalVivaMarks = parseFloat(submission.vivaSessions[0].marksObtained) || 0;
    }

    // Calculate totals
    const totalMarks = parseFloat(practicalMarks) + parseFloat(outputMarks) + finalVivaMarks;
    const maxMarks = submission.assignment.maxMarks;

    // Calculate late penalty
    let latePenaltyMarks = 0;
    if (submission.isLate && submission.lateDays > 0) {
        const penaltyPercent = submission.assignment.latePenaltyPercent * submission.lateDays;
        latePenaltyMarks = (totalMarks * Math.min(penaltyPercent, 100)) / 100;
    }

    // Get current academic year
    let academicYearId = req.body.academicYearId;
    if (!academicYearId) {
        const currentYear = await prisma.academicYear.findFirst({
            where: { schoolId: req.user.schoolId, isCurrent: true }
        });
        academicYearId = currentYear?.id;
    }

    const finalMarks = Math.max(0, totalMarks - latePenaltyMarks);
    const percentage = (finalMarks / maxMarks) * 100;
    const { letter: gradeLetter } = calculateGradeLetter(percentage);

    const grade = await prisma.grade.create({
        data: {
            submissionId,
            studentId: submission.studentId,
            gradedById: req.user.id,
            academicYearId,
            practicalMarks,
            outputMarks,
            vivaMarks: finalVivaMarks,
            totalMarks,
            maxMarks,
            latePenaltyMarks,
            finalMarks,
            percentage,
            gradeLetter,
            codeFeedback,
            codeFeedbackHindi,
            outputFeedback,
            generalRemarks,
            generalRemarksHindi,
            isPublished: isPublished || false,
            publishedAt: isPublished ? new Date() : null
        },
        include: {
            submission: {
                include: {
                    assignment: {
                        select: { title: true, titleHindi: true }
                    },
                    student: {
                        select: { firstName: true, lastName: true, email: true }
                    }
                }
            }
        }
    });

    // Update submission status
    await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'graded' }
    });

    // Log activity
    await prisma.activityLog.create({
        data: {
            userId: req.user.id,
            schoolId: req.user.schoolId,
            actionType: 'grade',
            entityType: 'grade',
            entityId: grade.id,
            description: `Graded submission for ${grade.submission.assignment.title}`,
            metadata: { finalMarks, gradeLetter }
        }
    });

    // TODO: Send notification to student if published

    res.status(201).json({
        success: true,
        message: 'Submission graded successfully',
        messageHindi: 'सबमिशन को सफलतापूर्वक ग्रेड किया गया',
        data: { grade }
    });
}));

/**
 * @route   PUT /api/grades/:id
 * @desc    Update a grade
 * @access  Private (Original grader or Admin)
 */
router.put('/:id', authenticate, authorize('instructor', 'lab_assistant', 'admin'), asyncHandler(async (req, res) => {
    const grade = await prisma.grade.findUnique({
        where: { id: req.params.id },
        include: { submission: { include: { assignment: true } } }
    });

    if (!grade) {
        return res.status(404).json({
            success: false,
            message: 'Grade not found'
        });
    }

    // Get current academic year if not specified
    let academicYearId = req.body.academicYearId || grade.academicYearId;
    if (!academicYearId) {
        const currentYear = await prisma.academicYear.findFirst({
            where: { schoolId: req.user.schoolId, isCurrent: true }
        });
        academicYearId = currentYear?.id;
    }

    // Calculate new totals for the history
    const newPracticalMarks = req.body.practicalMarks ?? parseFloat(grade.practicalMarks);
    const newOutputMarks = req.body.outputMarks ?? parseFloat(grade.outputMarks);
    const newVivaMarks = req.body.vivaMarks ?? parseFloat(grade.vivaMarks);
    const newTotalMarks = parseFloat(newPracticalMarks) + parseFloat(newOutputMarks) + parseFloat(newVivaMarks);
    const newFinalMarksForHistory = Math.max(0, newTotalMarks - parseFloat(grade.latePenaltyMarks));
    const newPercentageForHistory = (newFinalMarksForHistory / grade.submission.assignment.maxMarks) * 100;
    const { letter: newGradeLetterForHistory } = calculateGradeLetter(newPercentageForHistory);

    // Save history with modification details including grade letters
    await prisma.gradeHistory.create({
        data: {
            gradeId: grade.id,
            previousMarks: {
                practicalMarks: parseFloat(grade.practicalMarks),
                outputMarks: parseFloat(grade.outputMarks),
                vivaMarks: parseFloat(grade.vivaMarks),
                finalMarks: parseFloat(grade.finalMarks || 0),
                percentage: parseFloat(grade.percentage || 0),
                gradeLetter: grade.gradeLetter || 'N/A',
                maxMarks: parseFloat(grade.maxMarks || 100),
                modifiedAt: grade.modifiedAt,
                modifiedBy: grade.modifiedById
            },
            newMarks: {
                practicalMarks: newPracticalMarks,
                outputMarks: newOutputMarks,
                vivaMarks: newVivaMarks,
                finalMarks: newFinalMarksForHistory,
                percentage: newPercentageForHistory,
                gradeLetter: newGradeLetterForHistory,
                maxMarks: parseFloat(grade.maxMarks || 100),
                modifiedAt: new Date().toISOString(),
                modifiedBy: req.user.id
            },
            reason: req.body.modificationReason || 'Grade updated',
            modifiedById: req.user.id
        }
    });

    const {
        practicalMarks, outputMarks, vivaMarks,
        codeFeedback, codeFeedbackHindi,
        outputFeedback,
        generalRemarks, generalRemarksHindi,
        isPublished
    } = req.body;

    // Recalculate totals
    const totalMarks = parseFloat(practicalMarks ?? grade.practicalMarks) +
        parseFloat(outputMarks ?? grade.outputMarks) +
        parseFloat(vivaMarks ?? grade.vivaMarks);
    const maxMarks = grade.submission.assignment.maxMarks;

    let latePenaltyMarks = parseFloat(grade.latePenaltyMarks);
    const finalMarks = Math.max(0, totalMarks - latePenaltyMarks);
    const percentage = (finalMarks / maxMarks) * 100;
    const { letter: gradeLetter } = calculateGradeLetter(percentage);

    const updatedGrade = await prisma.grade.update({
        where: { id: req.params.id },
        data: {
            practicalMarks: practicalMarks !== undefined ? practicalMarks : undefined,
            outputMarks: outputMarks !== undefined ? outputMarks : undefined,
            vivaMarks: vivaMarks !== undefined ? vivaMarks : undefined,
            totalMarks,
            finalMarks,
            percentage,
            gradeLetter,
            codeFeedback,
            codeFeedbackHindi,
            outputFeedback,
            generalRemarks,
            generalRemarksHindi,
            isPublished: isPublished !== undefined ? isPublished : undefined,
            publishedAt: isPublished && !grade.isPublished ? new Date() : undefined,
            modifiedAt: new Date(),
            modifiedById: req.user.id,
            academicYearId
        },
        include: {
            gradedBy: { select: { id: true, firstName: true, lastName: true } },
            modifiedBy: { select: { id: true, firstName: true, lastName: true } },
            academicYear: { select: { id: true, yearLabel: true } },
            history: {
                orderBy: { modifiedAt: 'desc' },
                take: 5,
                include: {
                    grade: false
                }
            }
        }
    });

    // Log activity
    await prisma.activityLog.create({
        data: {
            userId: req.user.id,
            schoolId: req.user.schoolId,
            actionType: 'update',
            entityType: 'grade',
            entityId: grade.id,
            description: `Grade modified: ${grade.finalMarks} → ${finalMarks}`,
            metadata: { reason: req.body.modificationReason }
        }
    });

    res.json({
        success: true,
        message: 'Grade updated successfully',
        messageHindi: 'ग्रेड सफलतापूर्वक अपडेट किया गया',
        data: { grade: updatedGrade }
    });
}));

/**
 * @route   POST /api/grades/:id/publish
 * @desc    Publish grade to student
 * @access  Private (Instructor)
 */
router.post('/:id/publish', authenticate, authorize('instructor', 'lab_assistant', 'admin'), asyncHandler(async (req, res) => {
    const grade = await prisma.grade.update({
        where: { id: req.params.id },
        data: {
            isPublished: true,
            publishedAt: new Date()
        },
        include: {
            submission: {
                include: {
                    student: {
                        select: { id: true, email: true, firstName: true }
                    },
                    assignment: {
                        select: { title: true, titleHindi: true }
                    }
                }
            }
        }
    });

    // Send notification to student
    const io = req.app.get('io');
    io.to(`user-${grade.submission.student.id}`).emit('grade-published', {
        assignmentTitle: grade.submission.assignment.title,
        finalMarks: grade.finalMarks,
        gradeLetter: grade.gradeLetter
    });

    // TODO: Send email notification

    res.json({
        success: true,
        message: 'Grade published to student',
        messageHindi: 'छात्र को ग्रेड प्रकाशित किया गया',
        data: { grade }
    });
}));

/**
 * @route   GET /api/grades/:id/history
 * @desc    Get grade modification history
 * @access  Private (All authenticated users - students can view their own)
 */
router.get('/:id/history', authenticate, asyncHandler(async (req, res) => {
    const gradeId = req.params.id;

    const grade = await prisma.grade.findUnique({
        where: { id: gradeId },
        include: {
            gradedBy: { select: { id: true, firstName: true, lastName: true } },
            modifiedBy: { select: { id: true, firstName: true, lastName: true } },
            academicYear: { select: { id: true, yearLabel: true } },
            submission: {
                include: {
                    student: { select: { firstName: true, lastName: true, email: true } },
                    assignment: { select: { title: true } }
                }
            }
        }
    });

    if (!grade) {
        return res.status(404).json({
            success: false,
            message: 'Grade not found'
        });
    }

    const history = await prisma.gradeHistory.findMany({
        where: { gradeId },
        orderBy: { modifiedAt: 'desc' },
        take: 50
    });

    // Get modifier details for each history entry
    const modifierIds = [...new Set(history.map(h => h.modifiedById))];
    const modifiers = await prisma.user.findMany({
        where: { id: { in: modifierIds } },
        select: { id: true, firstName: true, lastName: true }
    });
    const modifierMap = Object.fromEntries(modifiers.map(m => [m.id, m]));

    const enrichedHistory = history.map(h => ({
        ...h,
        modifiedBy: modifierMap[h.modifiedById] || { firstName: 'Unknown', lastName: 'User' }
    }));

    res.json({
        success: true,
        data: {
            grade: {
                id: grade.id,
                studentName: `${grade.submission.student.firstName} ${grade.submission.student.lastName}`,
                assignmentTitle: grade.submission.assignment.title,
                currentMarks: {
                    practical: parseFloat(grade.practicalMarks),
                    output: parseFloat(grade.outputMarks),
                    viva: parseFloat(grade.vivaMarks),
                    final: parseFloat(grade.finalMarks || 0)
                },
                gradedAt: grade.gradedAt,
                gradedBy: grade.gradedBy,
                modifiedAt: grade.modifiedAt,
                modifiedBy: grade.modifiedBy,
                academicYear: grade.academicYear
            },
            history: enrichedHistory,
            totalModifications: history.length
        }
    });
}));

/**
 * @route   GET /api/grades/final-marks
 * @desc    Get final lab marks summary
 * @access  Private
 */
router.get('/final-marks', authenticate, asyncHandler(async (req, res) => {
    const { subjectId, classId, academicYearId, studentId } = req.query;

    let where = {};

    if (req.user.role === 'student') {
        where.studentId = req.user.id;
    } else if (studentId) {
        where.studentId = studentId;
    }

    if (subjectId) where.subjectId = subjectId;
    if (classId) where.classId = classId;
    if (academicYearId) where.academicYearId = academicYearId;

    const finalMarks = await prisma.finalLabMarks.findMany({
        where,
        include: {
            subject: {
                select: { id: true, name: true, nameHindi: true, code: true }
            },
            class: {
                select: { id: true, name: true, gradeLevel: true, section: true }
            },
            academicYear: {
                select: { yearLabel: true }
            },
            student: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    admissionNumber: true
                }
            }
        }
    });

    res.json({
        success: true,
        data: { finalMarks }
    });
}));

/**
 * @route   POST /api/grades/final-marks/calculate
 * @desc    Calculate and save final lab marks for a student
 * @access  Private (Instructor, Admin)
 */
router.post('/final-marks/calculate', authenticate, authorize('instructor', 'admin', 'principal'), [
    body('studentId').isUUID(),
    body('subjectId').isUUID(),
    body('classId').isUUID(),
    body('academicYearId').isUUID()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const { studentId, subjectId, classId, academicYearId, practicalExamMarks } = req.body;

    // Get all graded submissions for this student/subject
    const submissions = await prisma.submission.findMany({
        where: {
            studentId,
            assignment: {
                subjectId,
                status: 'published'
            },
            status: 'graded'
        },
        include: {
            grade: true,
            vivaSessions: {
                where: { status: 'completed' }
            }
        }
    });

    // Get total assignments
    const totalAssignments = await prisma.assignment.count({
        where: {
            subjectId,
            status: 'published',
            targets: {
                some: {
                    OR: [
                        { targetType: 'student', targetStudentId: studentId },
                        { targetType: 'class', targetClassId: classId }
                    ]
                }
            }
        }
    });

    // Calculate aggregates
    const completedAssignments = submissions.length;
    let totalGradedMarks = 0;
    let totalMaxMarks = 0;
    let totalVivaMarks = 0;
    let vivaCount = 0;

    submissions.forEach(sub => {
        if (sub.grade) {
            totalGradedMarks += parseFloat(sub.grade.finalMarks || 0);
            totalMaxMarks += parseFloat(sub.grade.maxMarks || 0);
        }
        sub.vivaSessions.forEach(viva => {
            totalVivaMarks += parseFloat(viva.marksObtained || 0);
            vivaCount++;
        });
    });

    const internalMarks = totalMaxMarks > 0
        ? (totalGradedMarks / totalMaxMarks) * 70 // 70% weightage for internal
        : 0;
    const vivaAverage = vivaCount > 0 ? totalVivaMarks / vivaCount : 0;

    const totalMarks = internalMarks + (practicalExamMarks || 0);
    const maxMarks = 100;
    const percentage = (totalMarks / maxMarks) * 100;
    const { letter: gradeLetter, points: gradePoints } = calculateGradeLetter(percentage);
    const isPass = percentage >= 33;

    const finalMark = await prisma.finalLabMarks.upsert({
        where: {
            studentId_subjectId_academicYearId: {
                studentId,
                subjectId,
                academicYearId
            }
        },
        create: {
            studentId,
            subjectId,
            classId,
            academicYearId,
            totalAssignments,
            completedAssignments,
            internalMarks,
            vivaAverage,
            practicalExamMarks: practicalExamMarks || 0,
            totalMarks,
            maxMarks,
            percentage,
            gradeLetter,
            gradePoints,
            isPass,
            finalizedById: req.user.id,
            finalizedAt: new Date()
        },
        update: {
            totalAssignments,
            completedAssignments,
            internalMarks,
            vivaAverage,
            practicalExamMarks: practicalExamMarks || 0,
            totalMarks,
            percentage,
            gradeLetter,
            gradePoints,
            isPass,
            finalizedById: req.user.id,
            finalizedAt: new Date()
        }
    });

    res.json({
        success: true,
        message: 'Final marks calculated and saved',
        messageHindi: 'अंतिम अंक की गणना और सहेजा गया',
        data: { finalMark }
    });
}));

module.exports = router;
