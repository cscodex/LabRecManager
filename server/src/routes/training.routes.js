const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const axios = require('axios');

/**
 * Helper to run Python code via Piston API
 */
async function executePythonCode(code, input = '') {
    try {
        // Use Wandbox API as fallback since EMKC Piston requires whitelist
        const response = await axios.post('https://wandbox.org/api/compile.json', {
            compiler: 'cpython-3.11.10',
            code: code,
            stdin: input || ''
        });
        
        return {
            stdout: response.data.program_output || '',
            stderr: response.data.program_error || '',
            code: parseInt(response.data.status || 0, 10)
        };
    } catch (err) {
        console.error('Code execution error:', err.message);
        throw new Error('Failed to execute code sandbox');
    }
}

/**
 * @route   GET /api/training/modules
 * @desc    Get all available training modules (assigned to the current user's class, or all for admin)
 * @access  Private
 */
router.get('/modules', authenticate, asyncHandler(async (req, res) => {
    let where = { schoolId: req.user.schoolId, isPublished: true };

    const modules = await prisma.trainingModule.findMany({
        where,
        include: {
            _count: { select: { units: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.json({
        success: true,
        data: { modules }
    });
}));

/**
 * @route   GET /api/training/modules/:id
 * @desc    Get detailed module structure and student progress
 * @access  Private
 */
router.get('/modules/:id', authenticate, asyncHandler(async (req, res) => {
    const moduleId = req.params.id;

    const moduleDetails = await prisma.trainingModule.findUnique({
        where: { id: moduleId },
        include: {
            units: {
                orderBy: { sequenceOrder: 'asc' },
                include: {
                    exercises: {
                        orderBy: { sequenceOrder: 'asc' },
                        select: {
                            id: true,
                            title: true,
                            difficulty: true,
                            scaffoldLevel: true,
                            isReviewExercise: true,
                            xpReward: true
                        }
                    }
                }
            }
        }
    });

    if (!moduleDetails) {
        return res.status(404).json({ success: false, message: 'Module not found' });
    }

    // Get student progress if requested by a student
    let progress = null;
    let unitMasteries = [];
    
    if (req.user.role === 'student') {
        progress = await prisma.studentTrainingProgress.findUnique({
            where: {
                studentId_moduleId: {
                    studentId: req.user.id,
                    moduleId: moduleId
                }
            }
        });

        unitMasteries = await prisma.studentUnitMastery.findMany({
            where: {
                studentId: req.user.id,
                unit: { moduleId: moduleId }
            }
        });
    }

    res.json({
        success: true,
        data: {
            module: moduleDetails,
            progress,
            unitMasteries
        }
    });
}));

// ==========================================
// BUILDER APIs (Admin/Instructor Only)
// ==========================================

/**
 * @route   POST /api/training/modules
 * @desc    Create a new training module
 * @access  Private (Admin/Instructor)
 */
router.post('/modules', authenticate, authorize('admin', 'principal', 'instructor'), [
    body('title').notEmpty().withMessage('Title is required'),
    body('language').notEmpty().withMessage('Language is required'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, titleHindi, description, language, boardAligned, classLevel } = req.body;

    const newModule = await prisma.trainingModule.create({
        data: {
            schoolId: req.user.schoolId,
            title,
            titleHindi,
            description,
            language,
            boardAligned,
            classLevel: classLevel ? parseInt(classLevel) : null,
            isPublished: false // By default unpublished
        }
    });

    res.status(201).json({ success: true, data: { module: newModule } });
}));

/**
 * @route   POST /api/training/modules/:id/units
 * @desc    Create a new unit for a module
 * @access  Private
 */
router.post('/modules/:id/units', authenticate, authorize('admin', 'principal', 'instructor'), [
    body('title').notEmpty().withMessage('Title is required'),
    body('unitNumber').isNumeric().withMessage('Unit number is required'),
    body('unlockThreshold').isNumeric().withMessage('Unlock threshold is required')
], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, description, unitNumber, expectedHours, unlockThreshold, sequenceOrder } = req.body;

    const unit = await prisma.trainingUnit.create({
        data: {
            moduleId: id,
            title,
            description,
            unitNumber: parseInt(unitNumber),
            expectedHours: expectedHours ? parseInt(expectedHours) : null,
            unlockThreshold: parseInt(unlockThreshold),
            sequenceOrder: sequenceOrder ? parseInt(sequenceOrder) : parseInt(unitNumber)
        }
    });

    // Update totalUnits count
    await prisma.trainingModule.update({
        where: { id },
        data: { totalUnits: { increment: 1 } }
    });

    res.status(201).json({ success: true, data: { unit } });
}));

/**
 * @route   POST /api/training/units/:id/exercises
 * @desc    Create a new exercise
 * @access  Private
 */
router.post('/units/:id/exercises', authenticate, authorize('admin', 'principal', 'instructor'), [
    body('title').notEmpty().withMessage('Title is required'),
    body('scaffoldLevel').notEmpty().withMessage('Scaffold level is required')
], asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Find module to update total exercises count
    const unit = await prisma.trainingUnit.findUnique({
        where: { id }, select: { moduleId: true }
    });
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });

    const exercise = await prisma.trainingExercise.create({
        data: {
            unitId: id,
            title: req.body.title,
            description: req.body.description || '',
            difficulty: req.body.difficulty || 'beginner',
            scaffoldLevel: req.body.scaffoldLevel,
            isReviewExercise: req.body.isReviewExercise || false,
            reviewsTopicId: req.body.reviewsTopicId || null,
            starterCode: req.body.starterCode || '',
            solutionCode: req.body.solutionCode || '',
            testCases: req.body.testCases ? (typeof req.body.testCases === 'string' ? JSON.parse(req.body.testCases) : req.body.testCases) : [],
            hints: req.body.hints ? (typeof req.body.hints === 'string' ? JSON.parse(req.body.hints) : req.body.hints) : [],
            timeLimit: parseInt(req.body.timeLimit) || 5,
            sequenceOrder: parseInt(req.body.sequenceOrder) || 1,
            xpReward: parseInt(req.body.xpReward) || 10
        }
    });

    await prisma.trainingModule.update({
        where: { id: unit.moduleId },
        data: { totalExercises: { increment: 1 } }
    });

    res.status(201).json({ success: true, data: { exercise } });
}));

/**
 * @route   GET /api/training/exercises/:id
 * @desc    Get specific exercise data for the editor
 * @access  Private
 */
router.get('/exercises/:id', authenticate, asyncHandler(async (req, res) => {
    const exercise = await prisma.trainingExercise.findUnique({
        where: { id: req.params.id },
        include: {
            unit: { 
                select: { 
                    moduleId: true, 
                    unlockThreshold: true,
                    module: { select: { language: true } }
                } 
            }
        }
    });

    if (!exercise) return res.status(404).json({ success: false, message: 'Exercise not found' });

    // Hide solution code and hidden test cases for students
    if (req.user.role === 'student') {
        exercise.solutionCode = undefined;
        if (Array.isArray(exercise.testCases)) {
            exercise.testCases = exercise.testCases.map(tc => {
                if (tc.isHidden) {
                    return { isHidden: true };
                }
                return tc;
            });
        }
    }

    res.json({ success: true, data: { exercise } });
}));

/**
 * @route   POST /api/training/exercises/:id/run
 * @desc    Dry-run the code without submitting
 * @access  Private
 */
router.post('/exercises/:id/run', authenticate, [
    body('code').notEmpty()
], asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Check language
    const exercise = await prisma.trainingExercise.findUnique({
        where: { id },
        include: { unit: { include: { module: true } } }
    });
    
    if (!exercise) return res.status(404).json({ success: false, message: 'Exercise not found' });
    
    const language = exercise.unit?.module?.language?.toLowerCase() || 'python';
    
    let execution;
    if (language === 'html') {
        // For HTML, there is no execution Sandbox. The literal code is the output.
        execution = { stdout: code, stderr: '', code: 0 };
    } else {
        // Python Execute
        execution = await executePythonCode(code, customInput || '');
    }

    res.json({
        success: true,
        data: {
            output: execution.stdout || execution.stderr,
            isError: execution.code !== 0
        }
    });
}));

/**
 * @route   POST /api/training/exercises/:id/submit
 * @desc    Submit code, evaluate against test cases, update mastery and XP
 * @access  Private
 */
router.post('/exercises/:id/submit', authenticate, [
    body('code').notEmpty()
], asyncHandler(async (req, res) => {
    const exerciseId = req.params.id;
    const { code } = req.body;
    const studentId = req.user.id;

    // Fetch exercise with true test cases
    const exercise = await prisma.trainingExercise.findUnique({
        where: { id: exerciseId },
        include: { unit: { include: { module: true } } }
    });

    if (!exercise) return res.status(404).json({ success: false, message: 'Exercise not found' });

    const language = exercise.unit?.module?.language?.toLowerCase() || 'python';
    const testCases = Array.isArray(exercise.testCases) ? exercise.testCases : [];
    let passedAll = true;
    let results = [];
    let firstErrorOutput = null;

    // Evaluate each test case
    for (const tc of testCases) {
        try {
            let exe;
            if (language === 'html') {
                exe = { stdout: code, stderr: '', code: 0 };
            } else {
                exe = await executePythonCode(code, tc.input);
            }
            
            const actualOutput = exe.stdout ? exe.stdout.replace(/\r\n/g, '\n') : '';
            const expectedOutput = tc.expected ? tc.expected.replace(/\r\n/g, '\n') : '';
            
            const passed = (exe.code === 0) && (actualOutput === expectedOutput);
            if (!passed) passedAll = false;

            if (exe.code !== 0 && !firstErrorOutput) {
                firstErrorOutput = exe.stderr;
            }

            results.push({
                input: tc.isHidden ? 'Hidden' : tc.input,
                expected: tc.isHidden ? 'Hidden' : tc.expected,
                actual: exe.stderr ? 'Error' : actualOutput,
                passed
            });
        } catch (err) {
            passedAll = false;
            results.push({ passed: false, actual: 'Execution Sandbox Error' });
        }
    }

    const testStatus = passedAll ? 'passed' : 'failed';

    // Build the AI Review Context if failed
    // (In full production, we'd trigger Gemini here. For now we will mock the socratic review creation).
    let socraticReview = null;
    if (!passedAll) {
        socraticReview = "Consider tracing your program with the first failing input. What does your logic currently return vs what is expected?";
    }

    // Save Submission
    const submission = await prisma.codingSubmission.create({
        data: {
            exerciseId,
            studentId,
            code,
            status: testStatus,
            output: firstErrorOutput || (results.length > 0 ? results[0].actual : ''),
            testResults: results,
            aiSocraticReview: socraticReview
        }
    });

    // If passed, update Progress & Mastery
    if (passedAll && req.user.role === 'student') {
        const unitId = exercise.unitId;
        const moduleId = exercise.unit.moduleId;

        // Ensure Progress record exists
        let progress = await prisma.studentTrainingProgress.findUnique({
            where: { studentId_moduleId: { studentId, moduleId } }
        });

        if (!progress) {
            progress = await prisma.studentTrainingProgress.create({
                data: {
                    studentId,
                    moduleId,
                    currentUnitId: unitId
                }
            });
        }

        // Ensure Mastery record exists
        let mastery = await prisma.studentUnitMastery.findUnique({
            where: { studentId_unitId: { studentId, unitId } }
        });

        if (!mastery) {
            mastery = await prisma.studentUnitMastery.create({
                data: { studentId, unitId, status: 'in_progress' }
            });
        }

        // Has this student already solved this?
        const priorSuccess = await prisma.codingSubmission.findFirst({
            where: { exerciseId, studentId, status: 'passed', id: { not: submission.id } }
        });

        if (!priorSuccess) {
            // First time passing! Add XP
            await prisma.studentTrainingProgress.update({
                where: { id: progress.id },
                data: { totalXP: { increment: exercise.xpReward } }
            });

            // Update Unit Mastery
            const totalUnitExecs = await prisma.trainingExercise.count({ where: { unitId } });
            const newExercisesDone = mastery.exercisesDone + 1;
            const newScore = (newExercisesDone / totalUnitExecs) * 100;

            let newMasteryStatus = mastery.status;
            let masteredAtTime = mastery.masteredAt;
            
            if (newScore >= exercise.unit.unlockThreshold && mastery.status !== 'mastered') {
                newMasteryStatus = 'mastered';
                masteredAtTime = new Date();
                // We would then unlock the next unit here.
            }

            await prisma.studentUnitMastery.update({
                where: { id: mastery.id },
                data: {
                    exercisesDone: newExercisesDone,
                    masteryScore: newScore,
                    status: newMasteryStatus,
                    masteredAt: masteredAtTime
                }
            });
        }
    }

    res.json({
        success: true,
        data: {
            status: testStatus,
            results,
            socraticReview
        }
    });
}));

/**
 * @route   GET /api/training/class/:classId/analytics
 * @desc    Get training analytics for an entire class
 * @access  Private (Instructor, Admin)
 */
router.get('/class/:classId/analytics', authenticate, authorize('instructor', 'admin', 'principal'), asyncHandler(async (req, res) => {
    const classId = req.params.classId;

    // Get all students in the class
    const enrollments = await prisma.classEnrollment.findMany({
        where: { classId, status: 'active' },
        include: {
            student: {
                select: { id: true, firstName: true, lastName: true, admissionNumber: true }
            }
        }
    });

    const studentIds = enrollments.map(e => e.student.id);

    // Get progress for these students
    const progress = await prisma.studentTrainingProgress.findMany({
        where: { studentId: { in: studentIds } },
        include: {
            module: { select: { id: true, title: true } }
        }
    });

    // Group progress by student
    const studentAnalytics = enrollments.map(e => {
        const p = progress.filter(pr => pr.studentId === e.student.id);
        return {
            student: e.student,
            totalXP: p.reduce((sum, pr) => sum + pr.totalXP, 0),
            modulesProgress: p
        };
    });

    res.json({
        success: true,
        data: {
            classId,
            studentCount: enrollments.length,
            students: studentAnalytics
        }
    });
}));

module.exports = router;
