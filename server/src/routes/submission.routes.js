const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadFields } = require('../middleware/upload');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/submissions
 * @desc    Get submissions (filtered by role)
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, assignmentId, status, studentId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get academic session from header
    const sessionId = req.headers['x-academic-session'];

    let where = {};

    // Students can only see their own submissions
    if (req.user.role === 'student') {
        where.studentId = req.user.id;
    } else {
        // Instructors see submissions for their assignments
        if (req.user.role === 'instructor' || req.user.role === 'lab_assistant') {
            where.assignment = {
                createdById: req.user.id
            };
        }

        // Filter by specific student
        if (studentId) {
            where.studentId = studentId;
        }
    }

    if (assignmentId) {
        where.assignmentId = assignmentId;
    }

    if (status) {
        where.status = status;
    }

    // Filter by academic year/session via assignment
    if (sessionId) {
        where.assignment = {
            ...where.assignment,
            academicYearId: sessionId
        };
    }

    const [submissions, total] = await Promise.all([
        prisma.submission.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: { submittedAt: 'desc' },
            include: {
                assignment: {
                    select: {
                        id: true,
                        title: true,
                        titleHindi: true,
                        experimentNumber: true,
                        maxMarks: true,
                        dueDate: true
                    }
                },
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        admissionNumber: true
                    }
                },
                grade: {
                    select: {
                        finalMarks: true,
                        gradeLetter: true,
                        isPublished: true
                    }
                }
            }
        }),
        prisma.submission.count({ where })
    ]);

    res.json({
        success: true,
        data: {
            submissions,
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
 * @route   GET /api/submissions/my
 * @desc    Get current student's submissions
 * @access  Private (Student)
 */
router.get('/my', authenticate, authorize('student'), asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, assignmentId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = { studentId: req.user.id };
    if (status) where.status = status;
    if (assignmentId) where.assignmentId = assignmentId;

    const [submissions, total] = await Promise.all([
        prisma.submission.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: { submittedAt: 'desc' },
            include: {
                assignment: {
                    select: {
                        id: true,
                        title: true,
                        titleHindi: true,
                        experimentNumber: true,
                        maxMarks: true,
                        dueDate: true
                    }
                },
                grade: {
                    select: {
                        finalMarks: true,
                        maxMarks: true,
                        gradeLetter: true,
                        isPublished: true
                    }
                }
            }
        }),
        prisma.submission.count({ where })
    ]);

    res.json({
        success: true,
        data: {
            submissions,
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
 * @route   GET /api/submissions/pending
 * @desc    Get pending submissions for review (Instructors)
 * @access  Private (Instructor)
 */
router.get('/pending', authenticate, authorize('instructor', 'lab_assistant', 'admin'), asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {
        assignment: {
            createdById: req.user.id
        }
    };

    if (status) {
        where.status = status;
    } else {
        where.status = { in: ['submitted', 'under_review'] };
    }

    const [submissions, total] = await Promise.all([
        prisma.submission.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: { submittedAt: 'desc' },
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
                },
                grade: {
                    select: {
                        finalMarks: true,
                        gradeLetter: true,
                        isPublished: true
                    }
                }
            }
        }),
        prisma.submission.count({ where })
    ]);

    res.json({
        success: true,
        data: {
            submissions,
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
 * @route   GET /api/submissions/:id
 * @desc    Get single submission by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const submission = await prisma.submission.findUnique({
        where: { id: req.params.id },
        include: {
            assignment: {
                include: {
                    subject: true,
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            },
            student: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    firstNameHindi: true,
                    lastNameHindi: true,
                    email: true,
                    admissionNumber: true
                }
            },
            group: true,
            files: true,
            revisions: {
                orderBy: { revisionNumber: 'desc' }
            },
            vivaSessions: {
                include: {
                    examiner: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            },
            grade: true
        }
    });

    if (!submission) {
        return res.status(404).json({
            success: false,
            message: 'Submission not found',
            messageHindi: 'सबमिशन नहीं मिला'
        });
    }

    // Check access
    if (req.user.role === 'student' && submission.studentId !== req.user.id) {
        return res.status(403).json({
            success: false,
            message: 'Not authorized to view this submission'
        });
    }

    res.json({
        success: true,
        data: { submission }
    });
}));

/**
 * @route   POST /api/submissions
 * @desc    Create a new submission
 * @access  Private (Student)
 */
router.post('/', authenticate, authorize('student'), uploadFields, [
    body('assignmentId').isUUID().withMessage('Valid assignment ID is required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const {
        assignmentId, groupId,
        codeContent, outputContent,
        observations, observationsHindi,
        conclusion, conclusionHindi
    } = req.body;

    // Get assignment to check due date
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId }
    });

    if (!assignment) {
        return res.status(404).json({
            success: false,
            message: 'Assignment not found'
        });
    }

    if (assignment.status !== 'published') {
        return res.status(400).json({
            success: false,
            message: 'Assignment is not open for submission'
        });
    }

    // Check if student is assigned to this assignment
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

    const assignmentTarget = await prisma.assignmentTarget.findFirst({
        where: {
            assignmentId,
            OR: [
                { targetType: 'student', targetStudentId: req.user.id },
                { targetType: 'class', targetClassId: { in: classIds } },
                { targetType: 'group', targetGroupId: { in: groupIds } }
            ]
        }
    });

    if (!assignmentTarget) {
        return res.status(403).json({
            success: false,
            message: 'You are not assigned to this assignment',
            messageHindi: 'आपको इस असाइनमेंट तक पहुंच नहीं है'
        });
    }


    // Check for existing submission
    const existingSubmission = await prisma.submission.findFirst({
        where: {
            assignmentId,
            studentId: req.user.id
        },
        orderBy: { submissionNumber: 'desc' }
    });

    // Calculate late submission
    let isLate = false;
    let lateDays = 0;
    if (assignment.dueDate) {
        const now = new Date();
        const dueDate = new Date(assignment.dueDate);
        if (now > dueDate) {
            if (!assignment.lateSubmissionAllowed) {
                return res.status(400).json({
                    success: false,
                    message: 'Late submission is not allowed for this assignment',
                    messageHindi: 'इस असाइनमेंट के लिए देर से सबमिशन की अनुमति नहीं है'
                });
            }
            isLate = true;
            lateDays = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));
        }
    }

    const submissionNumber = existingSubmission ? existingSubmission.submissionNumber + 1 : 1;

    // Create submission
    const submission = await prisma.submission.create({
        data: {
            assignmentId,
            studentId: req.user.id,
            groupId,
            codeContent,
            outputContent,
            observations,
            observationsHindi,
            conclusion,
            conclusionHindi,
            submissionNumber,
            isLate,
            lateDays,
            status: 'submitted'
        }
    });

    // Handle file uploads
    if (req.files) {
        const filePromises = [];

        // Code files
        if (req.files.code) {
            req.files.code.forEach(file => {
                filePromises.push(prisma.submissionFile.create({
                    data: {
                        submissionId: submission.id,
                        fileName: file.originalname,
                        fileType: file.mimetype,
                        fileSize: file.size,
                        fileUrl: `/uploads/submissions/${file.filename}`,
                        isOutput: false
                    }
                }));
            });
        }

        // Output files
        if (req.files.output) {
            req.files.output.forEach(file => {
                filePromises.push(prisma.submissionFile.create({
                    data: {
                        submissionId: submission.id,
                        fileName: file.originalname,
                        fileType: file.mimetype,
                        fileSize: file.size,
                        fileUrl: `/uploads/submissions/${file.filename}`,
                        isOutput: true
                    }
                }));
            });
        }

        // Attachments
        if (req.files.attachments) {
            req.files.attachments.forEach(file => {
                filePromises.push(prisma.submissionFile.create({
                    data: {
                        submissionId: submission.id,
                        fileName: file.originalname,
                        fileType: file.mimetype,
                        fileSize: file.size,
                        fileUrl: `/uploads/submissions/${file.filename}`,
                        isOutput: false
                    }
                }));
            });
        }

        await Promise.all(filePromises);
    }

    // Log activity
    await prisma.activityLog.create({
        data: {
            userId: req.user.id,
            schoolId: req.user.schoolId,
            actionType: 'submission',
            entityType: 'submission',
            entityId: submission.id,
            description: `Submitted assignment: ${assignment.title}`
        }
    });

    // Get full submission with files
    const fullSubmission = await prisma.submission.findUnique({
        where: { id: submission.id },
        include: {
            files: true,
            assignment: {
                select: { title: true, titleHindi: true }
            }
        }
    });

    res.status(201).json({
        success: true,
        message: isLate
            ? `Submission received (${lateDays} days late)`
            : 'Submission received successfully',
        messageHindi: isLate
            ? `सबमिशन प्राप्त (${lateDays} दिन देरी से)`
            : 'सबमिशन सफलतापूर्वक प्राप्त',
        data: { submission: fullSubmission }
    });
}));

/**
 * @route   PUT /api/submissions/:id
 * @desc    Update a submission (resubmit)
 * @access  Private (Student - owner only)
 */
router.put('/:id', authenticate, authorize('student'), uploadFields, asyncHandler(async (req, res) => {
    const submission = await prisma.submission.findUnique({
        where: { id: req.params.id },
        include: { assignment: true }
    });

    if (!submission) {
        return res.status(404).json({
            success: false,
            message: 'Submission not found'
        });
    }

    if (submission.studentId !== req.user.id) {
        return res.status(403).json({
            success: false,
            message: 'Not authorized to update this submission'
        });
    }

    // Check if status allows resubmission
    if (!['submitted', 'needs_revision', 'returned'].includes(submission.status)) {
        return res.status(400).json({
            success: false,
            message: 'Submission cannot be modified in current status',
            messageHindi: 'वर्तमान स्थिति में सबमिशन को संशोधित नहीं किया जा सकता'
        });
    }

    // Save revision
    await prisma.submissionRevision.create({
        data: {
            submissionId: submission.id,
            revisionNumber: submission.submissionNumber,
            codeContent: submission.codeContent,
            outputContent: submission.outputContent,
            revisionNote: 'Auto-saved before update'
        }
    });

    const {
        codeContent, outputContent,
        observations, observationsHindi,
        conclusion, conclusionHindi
    } = req.body;

    const updatedSubmission = await prisma.submission.update({
        where: { id: req.params.id },
        data: {
            codeContent,
            outputContent,
            observations,
            observationsHindi,
            conclusion,
            conclusionHindi,
            status: 'submitted',
            lastModified: new Date()
        },
        include: { files: true }
    });

    res.json({
        success: true,
        message: 'Submission updated successfully',
        messageHindi: 'सबमिशन सफलतापूर्वक अपडेट किया गया',
        data: { submission: updatedSubmission }
    });
}));

/**
 * @route   PUT /api/submissions/:id/status
 * @desc    Update submission status (for instructors)
 * @access  Private (Instructor)
 */
router.put('/:id/status', authenticate, authorize('instructor', 'lab_assistant', 'admin'), [
    body('status').isIn(['under_review', 'needs_revision', 'viva_scheduled', 'viva_completed', 'graded', 'returned'])
        .withMessage('Valid status required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const { status, remarks } = req.body;

    const submission = await prisma.submission.update({
        where: { id: req.params.id },
        data: { status }
    });

    // TODO: Send notification to student about status change

    res.json({
        success: true,
        message: 'Status updated successfully',
        data: { submission }
    });
}));

module.exports = router;
