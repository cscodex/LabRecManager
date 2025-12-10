const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/viva/sessions
 * @desc    Get viva sessions
 * @access  Private
 */
router.get('/sessions', authenticate, asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, submissionId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};

    if (req.user.role === 'student') {
        where.studentId = req.user.id;
    } else if (req.user.role === 'instructor' || req.user.role === 'lab_assistant') {
        where.examinerId = req.user.id;
    }

    if (status) {
        where.status = status;
    }

    if (submissionId) {
        where.submissionId = submissionId;
    }

    const [sessions, total] = await Promise.all([
        prisma.vivaSession.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: { scheduledAt: 'asc' },
            include: {
                submission: {
                    include: {
                        assignment: {
                            select: { id: true, title: true, titleHindi: true }
                        }
                    }
                },
                student: {
                    select: { id: true, firstName: true, lastName: true, admissionNumber: true }
                },
                examiner: {
                    select: { id: true, firstName: true, lastName: true }
                }
            }
        }),
        prisma.vivaSession.count({ where })
    ]);

    res.json({
        success: true,
        data: {
            sessions,
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
 * @route   GET /api/viva/sessions/:id
 * @desc    Get single viva session
 * @access  Private
 */
router.get('/sessions/:id', authenticate, asyncHandler(async (req, res) => {
    const session = await prisma.vivaSession.findUnique({
        where: { id: req.params.id },
        include: {
            submission: {
                include: {
                    assignment: true,
                    files: true
                }
            },
            student: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    firstNameHindi: true,
                    lastNameHindi: true,
                    admissionNumber: true,
                    profileImageUrl: true
                }
            },
            examiner: {
                select: { id: true, firstName: true, lastName: true }
            }
        }
    });

    if (!session) {
        return res.status(404).json({
            success: false,
            message: 'Viva session not found'
        });
    }

    // Check permissions - students can only view their own sessions
    const isStudent = session.studentId === req.user.id;
    const isExaminer = session.examinerId === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'principal';

    if (req.user.role === 'student' && !isStudent) {
        return res.status(403).json({
            success: false,
            message: 'This viva session is not assigned to you',
            messageHindi: 'यह वाइवा सत्र आपको असाइन नहीं किया गया है'
        });
    }

    if ((req.user.role === 'instructor' || req.user.role === 'lab_assistant') && !isExaminer && !isAdmin) {
        return res.status(403).json({
            success: false,
            message: 'You are not the examiner for this session'
        });
    }

    res.json({
        success: true,
        data: { session }
    });
}));

/**
 * @route   POST /api/viva/sessions
 * @desc    Schedule a viva session
 * @access  Private (Instructor)
 */
router.post('/sessions', authenticate, authorize('instructor', 'lab_assistant', 'admin'), [
    body('submissionId').isUUID().withMessage('Valid submission ID required'),
    body('scheduledAt').isISO8601().withMessage('Valid scheduled date required'),
    body('durationMinutes').optional().isInt({ min: 5, max: 60 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const { submissionId, scheduledAt, durationMinutes, mode } = req.body;

    // Get submission
    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: { student: true }
    });

    if (!submission) {
        return res.status(404).json({
            success: false,
            message: 'Submission not found'
        });
    }

    // Generate meeting link for online viva
    const meetingLink = mode === 'online'
        ? `${process.env.CLIENT_URL}/viva/room/${submissionId}`
        : null;

    const session = await prisma.vivaSession.create({
        data: {
            submissionId,
            studentId: submission.studentId,
            examinerId: req.user.id,
            scheduledAt: new Date(scheduledAt),
            durationMinutes: durationMinutes || 10,
            mode: mode || 'online',
            meetingLink,
            status: 'scheduled'
        },
        include: {
            student: {
                select: { id: true, firstName: true, lastName: true, email: true }
            }
        }
    });

    // Update submission status
    await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'viva_scheduled' }
    });

    // TODO: Send notification to student

    res.status(201).json({
        success: true,
        message: 'Viva session scheduled',
        messageHindi: 'वाइवा सत्र निर्धारित',
        data: { session }
    });
}));

/**
 * @route   PUT /api/viva/sessions/:id/start
 * @desc    Start a viva session
 * @access  Private (Examiner)
 */
router.put('/sessions/:id/start', authenticate, authorize('instructor', 'lab_assistant'), asyncHandler(async (req, res) => {
    const session = await prisma.vivaSession.findUnique({
        where: { id: req.params.id }
    });

    if (!session) {
        return res.status(404).json({
            success: false,
            message: 'Session not found'
        });
    }

    if (session.examinerId !== req.user.id) {
        return res.status(403).json({
            success: false,
            message: 'Not authorized'
        });
    }

    const updatedSession = await prisma.vivaSession.update({
        where: { id: req.params.id },
        data: {
            status: 'in_progress',
            actualStartTime: new Date()
        }
    });

    // Emit socket event for student to join
    const io = req.app.get('io');
    io.to(`user-${session.studentId}`).emit('viva-started', {
        sessionId: session.id,
        meetingLink: session.meetingLink
    });

    res.json({
        success: true,
        message: 'Viva session started',
        data: { session: updatedSession }
    });
}));

/**
 * @route   PUT /api/viva/sessions/:id/complete
 * @desc    Complete a viva session with evaluation
 * @access  Private (Examiner)
 */
router.put('/sessions/:id/complete', authenticate, authorize('instructor', 'lab_assistant'), [
    body('marksObtained').isFloat({ min: 0 }).withMessage('Valid marks required'),
    body('maxMarks').isFloat({ min: 0 }).withMessage('Max marks required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const {
        marksObtained, maxMarks, performanceRating,
        questionsAsked, studentResponses,
        examinerRemarks, examinerRemarksHindi, improvementSuggestions
    } = req.body;

    console.log('=== Complete Session Debug ===');
    console.log('Session ID:', req.params.id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    try {
        // First, check if the session exists
        const existingSession = await prisma.vivaSession.findUnique({
            where: { id: req.params.id },
            include: { submission: true }
        });

        console.log('Existing session:', existingSession ? { id: existingSession.id, status: existingSession.status, submissionId: existingSession.submissionId } : 'NOT FOUND');

        if (!existingSession) {
            return res.status(404).json({
                success: false,
                message: 'Viva session not found'
            });
        }

        // Update the session
        console.log('Updating session with data:', {
            status: 'completed',
            actualEndTime: new Date(),
            marksObtained: parseFloat(marksObtained),
            maxMarks: parseFloat(maxMarks),
            performanceRating,
            examinerRemarks
        });

        const session = await prisma.vivaSession.update({
            where: { id: req.params.id },
            data: {
                status: 'completed',
                actualEndTime: new Date(),
                marksObtained: parseFloat(marksObtained),
                maxMarks: parseFloat(maxMarks),
                performanceRating: performanceRating || null,
                questionsAsked: questionsAsked || null,
                studentResponses: studentResponses || null,
                examinerRemarks: examinerRemarks || null,
                examinerRemarksHindi: examinerRemarksHindi || null,
                improvementSuggestions: improvementSuggestions || null
            },
            include: { submission: true }
        });

        console.log('Session updated successfully:', session.id);

        // Update submission status if submission exists
        if (session.submissionId) {
            try {
                await prisma.submission.update({
                    where: { id: session.submissionId },
                    data: { status: 'viva_completed' }
                });
                console.log('Submission status updated');
            } catch (submissionError) {
                console.warn('Failed to update submission status:', submissionError.message);
                // Don't fail the entire request for this
            }
        }

        res.json({
            success: true,
            message: 'Viva completed successfully',
            messageHindi: 'वाइवा सफलतापूर्वक पूरा हुआ',
            data: { session }
        });
    } catch (error) {
        console.error('=== Complete Session Error ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error meta:', error.meta);
        console.error('Full error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to complete viva session',
            error: error.message,
            code: error.code,
            meta: error.meta
        });
    }
}));

/**
 * @route   GET /api/viva/questions
 * @desc    Get viva question bank
 * @access  Private (Instructor)
 */
router.get('/questions', authenticate, authorize('instructor', 'lab_assistant', 'admin'), asyncHandler(async (req, res) => {
    const { subjectId, assignmentId, difficulty, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};

    if (subjectId) {
        where.subjectId = subjectId;
    }

    if (assignmentId) {
        where.assignmentId = assignmentId;
    }

    if (difficulty) {
        where.difficulty = difficulty;
    }

    const [questions, total] = await Promise.all([
        prisma.vivaQuestion.findMany({
            where,
            skip,
            take: parseInt(limit),
            include: {
                subject: {
                    select: { id: true, name: true, nameHindi: true }
                },
                assignment: {
                    select: { id: true, title: true }
                }
            }
        }),
        prisma.vivaQuestion.count({ where })
    ]);

    res.json({
        success: true,
        data: {
            questions,
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
 * @route   POST /api/viva/questions
 * @desc    Add question to bank
 * @access  Private (Instructor)
 */
router.post('/questions', authenticate, authorize('instructor', 'lab_assistant', 'admin'), [
    body('subjectId').isUUID().withMessage('Valid subject ID required'),
    body('question').trim().notEmpty().withMessage('Question is required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const {
        subjectId, assignmentId,
        question, questionHindi,
        expectedAnswer, expectedAnswerHindi,
        difficulty, marks, topicTags
    } = req.body;

    const vivaQuestion = await prisma.vivaQuestion.create({
        data: {
            subjectId,
            assignmentId,
            question,
            questionHindi,
            expectedAnswer,
            expectedAnswerHindi,
            difficulty: difficulty || 'medium',
            marks: marks || 2,
            topicTags: topicTags || [],
            createdById: req.user.id
        }
    });

    res.status(201).json({
        success: true,
        message: 'Question added to bank',
        messageHindi: 'प्रश्न बैंक में जोड़ा गया',
        data: { question: vivaQuestion }
    });
}));

/**
 * @route   POST /api/viva/sessions/schedule
 * @desc    Schedule a standalone viva session for a student (without requiring submission)
 * @access  Private (Instructor, Admin)
 */
router.post('/sessions/schedule', authenticate, authorize('instructor', 'lab_assistant', 'admin'), [
    body('studentId').isUUID().withMessage('Valid student ID required'),
    body('scheduledAt').isISO8601().withMessage('Valid scheduled date required'),
    body('durationMinutes').optional().isInt({ min: 5, max: 120 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const { studentId, scheduledAt, durationMinutes, mode, title, description, submissionId } = req.body;

    // Verify student exists
    const student = await prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true, firstName: true, lastName: true, email: true, role: true }
    });

    if (!student) {
        return res.status(404).json({
            success: false,
            message: 'Student not found',
            messageHindi: 'छात्र नहीं मिला'
        });
    }

    if (student.role !== 'student') {
        return res.status(400).json({
            success: false,
            message: 'Selected user is not a student',
            messageHindi: 'चयनित उपयोगकर्ता छात्र नहीं है'
        });
    }

    // Generate a unique meeting link
    const sessionId = require('uuid').v4();
    const meetingLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/viva/room/${sessionId}`;

    // If submissionId is provided, use it; otherwise create a session without submission
    let session;

    if (submissionId) {
        // Verify submission exists
        const submission = await prisma.submission.findUnique({
            where: { id: submissionId }
        });

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        session = await prisma.vivaSession.create({
            data: {
                id: sessionId,
                submissionId,
                studentId,
                examinerId: req.user.id,
                scheduledAt: new Date(scheduledAt),
                durationMinutes: durationMinutes || 15,
                mode: mode || 'online',
                meetingLink,
                status: 'scheduled'
            },
            include: {
                student: {
                    select: { id: true, firstName: true, lastName: true, email: true }
                },
                submission: {
                    include: {
                        assignment: {
                            select: { id: true, title: true }
                        }
                    }
                }
            }
        });

        // Update submission status
        await prisma.submission.update({
            where: { id: submissionId },
            data: { status: 'viva_scheduled' }
        });
    } else {
        // Create session without submission - we need a dummy submission or handle this differently
        // For now, create the session with metadata stored in questionsAsked JSON

        // First, find or create a default submission for this student
        // Get any assignment for the student's class
        const studentEnrollment = await prisma.classEnrollment.findFirst({
            where: { studentId, status: 'active' },
            include: { class: true }
        });

        if (!studentEnrollment) {
            return res.status(400).json({
                success: false,
                message: 'Student is not enrolled in any class',
                messageHindi: 'छात्र किसी कक्षा में नामांकित नहीं है'
            });
        }

        // Find any assignment or create a standalone viva session with null submission
        const assignment = await prisma.assignment.findFirst({
            where: {
                targets: {
                    some: {
                        OR: [
                            { targetClassId: studentEnrollment.classId },
                            { targetStudentId: studentId }
                        ]
                    }
                }
            }
        });

        let finalSubmissionId;

        if (assignment) {
            // Create or find submission for this assignment
            let submission = await prisma.submission.findFirst({
                where: {
                    assignmentId: assignment.id,
                    studentId
                }
            });

            if (!submission) {
                submission = await prisma.submission.create({
                    data: {
                        assignmentId: assignment.id,
                        studentId,
                        status: 'viva_scheduled',
                        codeContent: '',
                        outputContent: ''
                    }
                });
            }

            finalSubmissionId = submission.id;
        } else {
            // No assignment found - create a placeholder "General Viva" assignment for this class
            const { v4: uuidv4 } = require('uuid');

            // First check for any existing "General Viva" assignment for this school
            let generalVivaAssignment = await prisma.assignment.findFirst({
                where: {
                    schoolId: req.user.schoolId,
                    title: 'General Viva Session',
                    assignmentType: 'viva_only'
                }
            });

            if (!generalVivaAssignment) {
                // Get the first subject for the student's class
                const classSubject = await prisma.classSubject.findFirst({
                    where: { classId: studentEnrollment.classId },
                    include: { subject: true }
                });

                if (!classSubject) {
                    // Get any subject from the school
                    const anySubject = await prisma.subject.findFirst({
                        where: { schoolId: req.user.schoolId }
                    });

                    if (!anySubject) {
                        return res.status(400).json({
                            success: false,
                            message: 'No subjects found. Please create a subject first.',
                            messageHindi: 'कोई विषय नहीं मिला। कृपया पहले एक विषय बनाएं।'
                        });
                    }

                    // Create a general viva assignment
                    generalVivaAssignment = await prisma.assignment.create({
                        data: {
                            schoolId: req.user.schoolId,
                            subjectId: anySubject.id,
                            createdById: req.user.id,
                            title: 'General Viva Session',
                            titleHindi: 'सामान्य वाइवा सत्र',
                            description: 'Standalone viva session for oral examination',
                            assignmentType: 'viva_only',
                            maxMarks: 100,
                            vivaMarks: 100,
                            practicalMarks: 0,
                            outputMarks: 0,
                            status: 'published'
                        }
                    });
                } else {
                    // Create a general viva assignment with the class subject
                    generalVivaAssignment = await prisma.assignment.create({
                        data: {
                            schoolId: req.user.schoolId,
                            subjectId: classSubject.subjectId,
                            createdById: req.user.id,
                            title: 'General Viva Session',
                            titleHindi: 'सामान्य वाइवा सत्र',
                            description: 'Standalone viva session for oral examination',
                            assignmentType: 'viva_only',
                            maxMarks: 100,
                            vivaMarks: 100,
                            practicalMarks: 0,
                            outputMarks: 0,
                            status: 'published'
                        }
                    });
                }

                // Create a target for the class
                await prisma.assignmentTarget.create({
                    data: {
                        assignmentId: generalVivaAssignment.id,
                        targetType: 'class',
                        targetClassId: studentEnrollment.classId,
                        assignedById: req.user.id
                    }
                });
            }

            // Create a submission for this viva
            const submission = await prisma.submission.create({
                data: {
                    assignmentId: generalVivaAssignment.id,
                    studentId,
                    status: 'viva_scheduled',
                    codeContent: '',
                    outputContent: '',
                    observations: title || 'Scheduled Viva Session'
                }
            });

            finalSubmissionId = submission.id;
        }

        session = await prisma.vivaSession.create({
            data: {
                id: sessionId,
                submissionId: finalSubmissionId,
                studentId,
                examinerId: req.user.id,
                scheduledAt: new Date(scheduledAt),
                durationMinutes: durationMinutes || 15,
                mode: mode || 'online',
                meetingLink,
                status: 'scheduled',
                questionsAsked: title || description ? {
                    sessionTitle: title || 'Viva Session',
                    sessionDescription: description || ''
                } : null
            },
            include: {
                student: {
                    select: { id: true, firstName: true, lastName: true, email: true }
                },
                submission: {
                    include: {
                        assignment: {
                            select: { id: true, title: true }
                        }
                    }
                }
            }
        });
    }

    // Log activity (wrapped in try-catch to not break the flow)
    try {
        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                schoolId: req.user.schoolId,
                actionType: 'viva',
                description: `Scheduled viva session for ${student.firstName} ${student.lastName} on ${new Date(scheduledAt).toLocaleString()}`,
                entityType: 'viva_session',
                entityId: session.id,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });
    } catch (logError) {
        console.warn('Failed to log activity:', logError.message);
    }

    // Emit notification to student
    const io = req.app.get('io');
    io.to(`user-${studentId}`).emit('notification', {
        type: 'viva_scheduled',
        message: `A viva session has been scheduled for ${new Date(scheduledAt).toLocaleString()}`,
        sessionId: session.id,
        meetingLink
    });

    res.status(201).json({
        success: true,
        message: 'Viva session scheduled successfully',
        messageHindi: 'वाइवा सत्र सफलतापूर्वक निर्धारित',
        data: { session }
    });
}));

/**
 * @route   GET /api/viva/available-students
 * @desc    Get students available for viva scheduling
 * @access  Private (Instructor, Admin)
 */
router.get('/available-students', authenticate, authorize('instructor', 'lab_assistant', 'admin'), asyncHandler(async (req, res) => {
    const { search, classId, limit = 50 } = req.query;

    let where = {
        role: 'student',
        isActive: true,
        schoolId: req.user.schoolId
    };

    if (search) {
        where.OR = [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { admissionNumber: { contains: search, mode: 'insensitive' } }
        ];
    }

    if (classId) {
        where.classEnrollments = {
            some: { classId, status: 'active' }
        };
    }

    const students = await prisma.user.findMany({
        where,
        take: parseInt(limit),
        orderBy: { firstName: 'asc' },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            admissionNumber: true,
            profileImageUrl: true,
            classEnrollments: {
                where: { status: 'active' },
                include: {
                    class: {
                        select: { id: true, name: true, gradeLevel: true, section: true }
                    }
                }
            }
        }
    });

    res.json({
        success: true,
        data: { students }
    });
}));

// ==================== WAITING ROOM ENDPOINTS ====================

/**
 * @route   POST /api/viva/sessions/:id/join
 * @desc    Join waiting room for a viva session
 * @access  Private
 */
router.post('/sessions/:id/join', authenticate, asyncHandler(async (req, res) => {
    const sessionId = req.params.id;
    const userId = req.user.id;

    // Check if session exists
    const session = await prisma.vivaSession.findUnique({
        where: { id: sessionId },
        include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            examiner: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    if (!session) {
        return res.status(404).json({
            success: false,
            message: 'Viva session not found'
        });
    }

    // Check if user is allowed (student of this session or examiner)
    const isStudent = session.studentId === userId;
    const isExaminer = session.examinerId === userId;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'principal';

    // Students can only join their own sessions
    if (req.user.role === 'student' && !isStudent) {
        return res.status(403).json({
            success: false,
            message: 'This viva session is not assigned to you',
            messageHindi: 'यह वाइवा सत्र आपको असाइन नहीं किया गया है'
        });
    }

    // Instructors can only join sessions they are examining (unless admin)
    if ((req.user.role === 'instructor' || req.user.role === 'lab_assistant') && !isExaminer && !isAdmin) {
        return res.status(403).json({
            success: false,
            message: 'You are not the examiner for this session',
            messageHindi: 'आप इस सत्र के परीक्षक नहीं हैं'
        });
    }

    // Check if session is in a joinable state
    if (session.status === 'completed') {
        return res.status(400).json({
            success: false,
            message: 'This viva session has already been completed',
            messageHindi: 'यह वाइवा सत्र पहले ही पूरा हो चुका है'
        });
    }

    if (session.status === 'cancelled') {
        return res.status(400).json({
            success: false,
            message: 'This viva session has been cancelled',
            messageHindi: 'यह वाइवा सत्र रद्द कर दिया गया है'
        });
    }

    // Determine role and initial status
    let role = 'student';
    let status = 'waiting';

    if (isExaminer) {
        role = 'examiner';
        status = 'admitted'; // Examiners are auto-admitted
    }

    // Upsert participant record
    const participant = await prisma.vivaParticipant.upsert({
        where: {
            sessionId_userId: { sessionId, userId }
        },
        create: {
            sessionId,
            userId,
            role,
            status,
            joinedWaitingAt: new Date(),
            admittedAt: status === 'admitted' ? new Date() : null
        },
        update: {
            status: status,
            socketId: null, // Will be set when WebRTC connects
            leftAt: null // Reset left time if rejoining
        },
        include: {
            user: {
                select: { id: true, firstName: true, lastName: true, email: true, admissionNumber: true }
            }
        }
    });

    res.json({
        success: true,
        message: status === 'admitted' ? 'Joined session' : 'Joined waiting room',
        data: {
            participant,
            session: {
                id: session.id,
                status: session.status,
                examinerId: session.examinerId,
                studentId: session.studentId,
                examiner: session.examiner,
                student: session.student
            },
            isHost: isExaminer
        }
    });
}));

/**
 * @route   GET /api/viva/sessions/:id/participants
 * @desc    Get all participants in waiting room and session
 * @access  Private (Examiner)
 */
router.get('/sessions/:id/participants', authenticate, asyncHandler(async (req, res) => {
    const sessionId = req.params.id;

    // Check if session exists and user is examiner
    const session = await prisma.vivaSession.findUnique({
        where: { id: sessionId }
    });

    if (!session) {
        return res.status(404).json({
            success: false,
            message: 'Session not found'
        });
    }

    // Get all participants
    const participants = await prisma.vivaParticipant.findMany({
        where: { sessionId },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    admissionNumber: true,
                    role: true
                }
            }
        },
        orderBy: { joinedWaitingAt: 'asc' }
    });

    // Split by status
    const waiting = participants.filter(p => p.status === 'waiting');
    const admitted = participants.filter(p => ['admitted', 'in_session'].includes(p.status));

    res.json({
        success: true,
        data: {
            participants,
            waiting,
            admitted,
            counts: {
                total: participants.length,
                waiting: waiting.length,
                admitted: admitted.length
            }
        }
    });
}));

/**
 * @route   PUT /api/viva/sessions/:id/admit/:participantId
 * @desc    Admit a participant from waiting room
 * @access  Private (Examiner)
 */
router.put('/sessions/:id/admit/:participantId', authenticate, authorize('instructor', 'lab_assistant', 'admin'), asyncHandler(async (req, res) => {
    const { id: sessionId, participantId } = req.params;

    // Verify session and examiner
    const session = await prisma.vivaSession.findUnique({
        where: { id: sessionId }
    });

    if (!session) {
        return res.status(404).json({
            success: false,
            message: 'Session not found'
        });
    }

    // Admit the participant
    const participant = await prisma.vivaParticipant.update({
        where: { id: participantId },
        data: {
            status: 'admitted',
            admittedAt: new Date()
        },
        include: {
            user: {
                select: { id: true, firstName: true, lastName: true, email: true }
            }
        }
    });

    res.json({
        success: true,
        message: `${participant.user.firstName} has been admitted`,
        data: { participant }
    });
}));

/**
 * @route   PUT /api/viva/sessions/:id/reject/:participantId
 * @desc    Reject a participant from waiting room
 * @access  Private (Examiner)
 */
router.put('/sessions/:id/reject/:participantId', authenticate, authorize('instructor', 'lab_assistant', 'admin'), asyncHandler(async (req, res) => {
    const { id: sessionId, participantId } = req.params;

    // Verify session
    const session = await prisma.vivaSession.findUnique({
        where: { id: sessionId }
    });

    if (!session) {
        return res.status(404).json({
            success: false,
            message: 'Session not found'
        });
    }

    // Reject the participant
    const participant = await prisma.vivaParticipant.update({
        where: { id: participantId },
        data: {
            status: 'rejected',
            leftAt: new Date()
        },
        include: {
            user: {
                select: { id: true, firstName: true, lastName: true }
            }
        }
    });

    res.json({
        success: true,
        message: `${participant.user.firstName} has been removed from waiting room`,
        data: { participant }
    });
}));

/**
 * @route   PUT /api/viva/sessions/:id/leave
 * @desc    Leave a viva session
 * @access  Private
 */
router.put('/sessions/:id/leave', authenticate, asyncHandler(async (req, res) => {
    const sessionId = req.params.id;
    const userId = req.user.id;

    // Update participant status
    const participant = await prisma.vivaParticipant.updateMany({
        where: {
            sessionId,
            userId
        },
        data: {
            status: 'left',
            leftAt: new Date()
        }
    });

    res.json({
        success: true,
        message: 'Left the session',
        data: { updated: participant.count }
    });
}));

/**
 * @route   GET /api/viva/sessions/:id/my-status
 * @desc    Get current user's participant status
 * @access  Private
 */
router.get('/sessions/:id/my-status', authenticate, asyncHandler(async (req, res) => {
    const sessionId = req.params.id;
    const userId = req.user.id;

    const participant = await prisma.vivaParticipant.findUnique({
        where: {
            sessionId_userId: { sessionId, userId }
        },
        include: {
            session: {
                select: {
                    id: true,
                    status: true,
                    examinerId: true,
                    examiner: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            }
        }
    });

    if (!participant) {
        return res.status(404).json({
            success: false,
            message: 'You have not joined this session'
        });
    }

    res.json({
        success: true,
        data: { participant }
    });
}));

/**
 * @route   PUT /api/viva/sessions/:id/admit-all
 * @desc    Admit all waiting participants
 * @access  Private (Examiner)
 */
router.put('/sessions/:id/admit-all', authenticate, authorize('instructor', 'lab_assistant', 'admin'), asyncHandler(async (req, res) => {
    const sessionId = req.params.id;

    const result = await prisma.vivaParticipant.updateMany({
        where: {
            sessionId,
            status: 'waiting'
        },
        data: {
            status: 'admitted',
            admittedAt: new Date()
        }
    });

    res.json({
        success: true,
        message: `Admitted ${result.count} participant(s)`,
        data: { admittedCount: result.count }
    });
}));

/**
 * @route   GET /api/viva/sessions/:id/time-status
 * @desc    Get session time remaining and status
 * @access  Private
 */
router.get('/sessions/:id/time-status', authenticate, asyncHandler(async (req, res) => {
    const session = await prisma.vivaSession.findUnique({
        where: { id: req.params.id },
        select: {
            id: true,
            status: true,
            scheduledAt: true,
            scheduledEndTime: true,
            durationMinutes: true,
            actualStartTime: true,
            actualEndTime: true,
            autoStart: true,
            autoAdmit: true
        }
    });

    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const now = new Date();
    let timeRemaining = null;
    let shouldAutoStart = false;
    let shouldAutoEnd = false;
    let isWithinSchedule = false;

    if (session.scheduledAt) {
        const scheduledStart = new Date(session.scheduledAt);
        const scheduledEnd = session.scheduledEndTime
            ? new Date(session.scheduledEndTime)
            : new Date(scheduledStart.getTime() + session.durationMinutes * 60 * 1000);

        isWithinSchedule = now >= scheduledStart && now <= scheduledEnd;

        // Check if should auto-start (within 1 minute of scheduled time)
        if (session.status === 'scheduled' && session.autoStart) {
            const timeDiff = (now - scheduledStart) / 1000 / 60; // in minutes
            shouldAutoStart = timeDiff >= -1 && timeDiff <= 5; // 1 min before to 5 mins after
        }

        // Calculate time remaining
        if (session.status === 'in_progress' && session.actualStartTime) {
            const actualStart = new Date(session.actualStartTime);
            const endTime = new Date(actualStart.getTime() + session.durationMinutes * 60 * 1000);
            timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000)); // seconds
            shouldAutoEnd = timeRemaining <= 0;
        } else if (session.status === 'scheduled') {
            // Time until start
            timeRemaining = Math.floor((scheduledStart - now) / 1000);
        }
    }

    res.json({
        success: true,
        data: {
            session: {
                ...session,
                timeRemaining,
                shouldAutoStart,
                shouldAutoEnd,
                isWithinSchedule,
                now: now.toISOString()
            }
        }
    });
}));

/**
 * @route   PUT /api/viva/sessions/:id/auto-start
 * @desc    Auto-start a session if within schedule
 * @access  Private
 */
router.put('/sessions/:id/auto-start', authenticate, asyncHandler(async (req, res) => {
    const session = await prisma.vivaSession.findUnique({
        where: { id: req.params.id }
    });

    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.status !== 'scheduled') {
        return res.status(400).json({ success: false, message: 'Session already started or completed' });
    }

    const now = new Date();
    const scheduledStart = new Date(session.scheduledAt);
    const timeDiff = (now - scheduledStart) / 1000 / 60;

    // Allow start 5 mins before to 30 mins after scheduled time
    if (timeDiff < -5 || timeDiff > 30) {
        return res.status(400).json({
            success: false,
            message: 'Session can only be started within schedule window',
            data: { scheduledAt: session.scheduledAt, currentTime: now, timeDiffMinutes: timeDiff }
        });
    }

    const updatedSession = await prisma.vivaSession.update({
        where: { id: req.params.id },
        data: {
            status: 'in_progress',
            actualStartTime: now
        }
    });

    // Auto-admit student if enabled
    if (session.autoAdmit) {
        await prisma.vivaParticipant.updateMany({
            where: { sessionId: session.id, role: 'student' },
            data: { status: 'admitted', admittedAt: now }
        });
    }

    res.json({
        success: true,
        message: 'Session auto-started',
        data: { session: updatedSession }
    });
}));

/**
 * @route   PUT /api/viva/sessions/:id/auto-end
 * @desc    Auto-end a session when time expires
 * @access  Private
 */
router.put('/sessions/:id/auto-end', authenticate, asyncHandler(async (req, res) => {
    const session = await prisma.vivaSession.findUnique({
        where: { id: req.params.id }
    });

    if (!session || session.status !== 'in_progress') {
        return res.status(400).json({ success: false, message: 'Session not in progress' });
    }

    const now = new Date();
    const startTime = new Date(session.actualStartTime);
    const endTime = new Date(startTime.getTime() + session.durationMinutes * 60 * 1000);

    if (now < endTime) {
        return res.status(400).json({
            success: false,
            message: 'Session time not expired yet',
            data: { timeRemaining: Math.floor((endTime - now) / 1000) }
        });
    }

    const updatedSession = await prisma.vivaSession.update({
        where: { id: req.params.id },
        data: {
            status: 'completed',
            actualEndTime: now,
            examinerRemarks: session.examinerRemarks || 'Session auto-completed due to time limit'
        }
    });

    res.json({
        success: true,
        message: 'Session auto-ended due to time limit',
        data: { session: updatedSession }
    });
}));

/**
 * @route   POST /api/viva/sessions/:id/recording
 * @desc    Upload session recording
 * @access  Private (Examiner)
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage for recordings
const recordingsDir = path.join(__dirname, '../../uploads/recordings');
if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
}

const recordingStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, recordingsDir),
    filename: (req, file, cb) => {
        const sessionId = req.params.id;
        const ext = path.extname(file.originalname) || '.webm';
        cb(null, `viva-${sessionId}-${Date.now()}${ext}`);
    }
});

const uploadRecording = multer({
    storage: recordingStorage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/webm', 'video/mp4', 'audio/webm', 'audio/mpeg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only video/audio files allowed.'));
        }
    }
});

router.post('/sessions/:id/recording', authenticate, uploadRecording.single('recording'), asyncHandler(async (req, res) => {
    const sessionId = req.params.id;

    const session = await prisma.vivaSession.findUnique({
        where: { id: sessionId }
    });

    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No recording file uploaded' });
    }

    const recordingUrl = `/api/viva/recordings/${path.basename(req.file.path)}`;

    const updatedSession = await prisma.vivaSession.update({
        where: { id: sessionId },
        data: {
            recordingUrl,
            recordingFilePath: req.file.path,
            recordingSize: req.file.size,
            recordingDuration: parseInt(req.body.duration) || null
        }
    });

    res.json({
        success: true,
        message: 'Recording uploaded successfully',
        data: {
            session: updatedSession,
            recording: {
                url: recordingUrl,
                size: req.file.size,
                filename: path.basename(req.file.path)
            }
        }
    });
}));

/**
 * @route   GET /api/viva/recordings/:filename
 * @desc    Stream recording file
 * @access  Private
 */
router.get('/recordings/:filename', authenticate, asyncHandler(async (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(recordingsDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Recording not found' });
    }

    // Get session to verify access
    const sessionId = filename.split('-')[1];
    const session = await prisma.vivaSession.findFirst({
        where: { recordingFilePath: { contains: filename } }
    });

    if (session) {
        const isAuthorized = req.user.id === session.studentId ||
            req.user.id === session.examinerId ||
            req.user.role === 'admin' ||
            req.user.role === 'principal';

        if (!isAuthorized) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this recording' });
        }
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/webm',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/webm',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
}));

/**
 * @route   GET /api/viva/sessions/check-auto-start
 * @desc    Check and auto-start sessions that are scheduled to start now
 * @access  Private (Admin/System)
 */
router.get('/sessions/check-auto-start', authenticate, asyncHandler(async (req, res) => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);

    // Find sessions that should be auto-started
    const sessionsToStart = await prisma.vivaSession.findMany({
        where: {
            status: 'scheduled',
            autoStart: true,
            scheduledAt: {
                gte: fiveMinutesAgo,
                lte: fiveMinutesLater
            }
        },
        include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            examiner: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    const startedSessions = [];
    for (const session of sessionsToStart) {
        await prisma.vivaSession.update({
            where: { id: session.id },
            data: {
                status: 'in_progress',
                actualStartTime: now
            }
        });

        // Auto-admit participants if enabled
        if (session.autoAdmit) {
            await prisma.vivaParticipant.updateMany({
                where: { sessionId: session.id },
                data: { status: 'admitted', admittedAt: now }
            });
        }

        startedSessions.push(session);
    }

    res.json({
        success: true,
        message: `Auto-started ${startedSessions.length} session(s)`,
        data: { startedSessions }
    });
}));

/**
 * @route   PUT /api/viva/sessions/:id/mark-missed
 * @desc    Mark an expired session as missed/cancelled
 * @access  Private (Instructor)
 */
router.put('/sessions/:id/mark-missed', authenticate, authorize('instructor', 'lab_assistant', 'admin'), asyncHandler(async (req, res) => {
    const session = await prisma.vivaSession.findUnique({
        where: { id: req.params.id }
    });

    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.status !== 'scheduled') {
        return res.status(400).json({ success: false, message: 'Can only mark scheduled sessions as missed' });
    }

    const updatedSession = await prisma.vivaSession.update({
        where: { id: req.params.id },
        data: {
            status: 'cancelled',
            examinerRemarks: req.body.reason || 'Session marked as missed - time slot expired'
        }
    });

    res.json({
        success: true,
        message: 'Session marked as missed',
        data: { session: updatedSession }
    });
}));

/**
 * @route   GET /api/viva/sessions/cleanup-expired
 * @desc    Auto-cancel sessions that are way past their duration (e.g., 1 hour after scheduled end)
 * @access  Private (Admin)
 */
router.get('/sessions/cleanup-expired', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const now = new Date();

    // Find scheduled sessions that are more than 1 hour past their end time
    const allScheduledSessions = await prisma.vivaSession.findMany({
        where: {
            status: 'scheduled'
        }
    });

    const expiredSessions = allScheduledSessions.filter(session => {
        if (!session.scheduledAt) return false;
        const startTime = new Date(session.scheduledAt);
        const endTime = new Date(startTime.getTime() + (session.durationMinutes || 15) * 60 * 1000);
        const graceEndTime = new Date(endTime.getTime() + 60 * 60 * 1000); // 1 hour grace
        return now > graceEndTime;
    });

    const cancelledIds = [];
    for (const session of expiredSessions) {
        await prisma.vivaSession.update({
            where: { id: session.id },
            data: {
                status: 'cancelled',
                examinerRemarks: 'Auto-cancelled - session time slot expired without being conducted'
            }
        });
        cancelledIds.push(session.id);
    }

    res.json({
        success: true,
        message: `Cleaned up ${cancelledIds.length} expired session(s)`,
        data: { cancelledCount: cancelledIds.length, cancelledIds }
    });
}));

module.exports = router;
