const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * AI Socratic Review Function
 */
async function evaluateStudentCodeWithAI(code, problemStatement, failedCases) {
    if (!process.env.GEMINI_API_KEY) return "AI Assessor is not configured (Missing API Key).";
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `
        You are an expert AI Computer Science tutor. The student submitted the following code:
        \`\`\`
        ${code}
        \`\`\`
        
        The Problem Statement was:
        ${problemStatement}
        
        The following test cases failed:
        ${JSON.stringify(failedCases, null, 2)}
        
        Analyze the student's code and evaluate if their approach is logically close (partially correct) but failed on an edge case, or if it is completely wrong. 
        Provide a JSON response with the following schema:
        {
          "isPartiallyCorrect": true|false,
          "socraticFeedback": "String: Write a hint as a question to push the student to realize their mistake without directly giving them the answer.",
          "suggestedEdgeCases": [{"input": "...", "expectedOutput": "..."}] 
        }
        Do not wrap the JSON in markdown formatting backticks if possible, ensure it parses validly.
        `;

        const result = await model.generateContent(prompt);
        let out = result.response.text();
        // clean formatting
        out = out.replace(/```json/gi, '').replace(/```/gi, '').trim();
        return JSON.parse(out);
    } catch (e) {
        console.error("AI Evaluation error:", e);
        return null;
    }
}

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
    const isAdmin = ['admin', 'principal', 'instructor'].includes(req.user.role);
    let where = { schoolId: req.user.schoolId };
    // Students only see published modules; admins see all (draft + published)
    if (!isAdmin) {
        where.isPublished = true;
    }
    
    // Filter by academic session if provided via header from client interceptor
    const sessionId = req.headers['x-academic-session'];
    if (sessionId) {
        where.academicYearId = sessionId;
    }

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

    const isAdmin = ['admin', 'principal', 'instructor'].includes(req.user.role);

    // Admin/instructor sees full exercise data for the builder; students see summary
    const exerciseSelect = isAdmin
        ? {
            id: true, title: true, description: true, difficulty: true,
            scaffoldLevel: true, bloomsLevel: true, learningObjective: true,
            isReviewExercise: true, xpReward: true,
            starterCode: true, solutionCode: true, testCases: true, hints: true,
            timeLimit: true, sequenceOrder: true
          }
        : {
            id: true, title: true, difficulty: true,
            scaffoldLevel: true, isReviewExercise: true, xpReward: true
          };

    const moduleDetails = await prisma.trainingModule.findUnique({
        where: { id: moduleId },
        include: {
            units: {
                orderBy: { sequenceOrder: 'asc' },
                include: {
                    exercises: {
                        orderBy: { sequenceOrder: 'asc' },
                        select: exerciseSelect
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
    const sessionId = req.headers['x-academic-session'];

    const newModule = await prisma.trainingModule.create({
        data: {
            schoolId: req.user.schoolId,
            academicYearId: sessionId || null,
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
            bloomsLevel: req.body.bloomsLevel || null,
            learningObjective: req.body.learningObjective || null,
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
    const { code, customInput } = req.body;
    
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
            const expectedOutput = tc.expectedOutput ? tc.expectedOutput.replace(/\r\n/g, '\n') : '';
            
            const passed = (exe.code === 0) && (actualOutput === expectedOutput);
            if (!passed) passedAll = false;

            if (exe.code !== 0 && !firstErrorOutput) {
                firstErrorOutput = exe.stderr;
            }

            results.push({
                input: tc.isHidden ? 'Hidden' : tc.input,
                expected: tc.isHidden ? 'Hidden' : tc.expectedOutput,
                actual: exe.stderr ? 'Error' : actualOutput,
                passed
            });
        } catch (err) {
            passedAll = false;
            results.push({ passed: false, actual: 'Execution Sandbox Error' });
        }
    }

    const testStatus = passedAll ? 'passed' : 'failed';

    // Evaluate with AI 
    let socraticReview = null;
    let isPartiallyCorrect = false;

    // We fetch a hypothetical config, for now hardcoded to checking AI if failed or async logic.
    // Assuming synchronous AI check if it failed test cases:
    if (results.some(r => !r.passed) || results.length === 0) {
        const failedCases = results.filter(r => !r.passed).map(r => ({ input: r.input, expected: r.expected, actual: r.actual }));
        const aiEvaluation = await evaluateStudentCodeWithAI(code, exercise.description, failedCases);
        
        if (aiEvaluation) {
            socraticReview = aiEvaluation.socraticFeedback;
            isPartiallyCorrect = aiEvaluation.isPartiallyCorrect;
            
            // Inject dynamic edge cases into results for the UI to portray
            if (Array.isArray(aiEvaluation.suggestedEdgeCases)) {
                aiEvaluation.suggestedEdgeCases.forEach(tc => {
                    results.push({
                        input: tc.input,
                        expected: tc.expectedOutput,
                        actual: 'Not Evaluated (Dynamic AI Case)',
                        passed: false,
                        isAiGenerated: true
                    });
                });
            }
        } else {
            socraticReview = "Consider tracing your program with the first failing input. What does your logic currently return vs what is expected?";
        }
    }

    // Save code to Student Document Folder System structure automatically
    try {
        const dateStr = new Date().toISOString().split('T')[0];
        const folderName = `Training Records - ${dateStr}`;

        // Find or create the master document folder for the date
        let folder = await prisma.documentFolder.findFirst({
            where: { schoolId: req.user.schoolId, createdById: req.user.id, name: folderName }
        });

        if (!folder) {
            folder = await prisma.documentFolder.create({
                data: {
                    schoolId: req.user.schoolId,
                    createdById: req.user.id,
                    name: folderName
                }
            });
        }

        // Store file locally first to upload to Cloudinary (as raw TXT block since it's code)
        const fileExt = language === 'html' ? '.html' : '.py';
        const fileName = `Exercise_${exerciseId}_${Date.now()}${fileExt}`;
        const tempPath = path.join(os.tmpdir(), fileName);
        fs.writeFileSync(tempPath, code);

        const uploadResult = await uploadToCloudinary(tempPath, { folder: 'student/codes', resourceType: 'raw' });

        await prisma.document.create({
            data: {
                schoolId: req.user.schoolId,
                uploadedById: req.user.id,
                folderId: folder.id,
                name: \`Solution - \${exercise.title}\`,
                fileName: fileName,
                fileType: fileExt,
                mimeType: language === 'html' ? 'text/html' : 'text/x-python',
                fileSize: Buffer.byteLength(code, 'utf8'),
                cloudinaryId: uploadResult.public_id,
                url: uploadResult.secure_url
            }
        });
    } catch (fsErr) {
        console.error("Failed to store document in filesystem structure:", fsErr);
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

// ==========================================
// PUBLISH / UNPUBLISH MODULE
// ==========================================

/**
 * @route   PUT /api/training/modules/:id/publish
 * @desc    Toggle publish state of a module
 * @access  Private (Admin/Instructor)
 */
router.put('/modules/:id/publish', authenticate, authorize('admin', 'principal', 'instructor'), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const existing = await prisma.trainingModule.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Module not found' });

    const updated = await prisma.trainingModule.update({
        where: { id },
        data: { isPublished: !existing.isPublished }
    });

    res.json({
        success: true,
        data: { module: updated },
        message: updated.isPublished ? 'Module published' : 'Module unpublished'
    });
}));

// ==========================================
// CONFIGURATION (Update pedagogy settings)
// ==========================================

/**
 * @route   PUT /api/training/modules/:id/config
 * @desc    Update pedagogy configuration of a module
 * @access  Private (Admin/Instructor)
 */
router.put('/modules/:id/config', authenticate, authorize('admin', 'principal', 'instructor'), [
    body('pedagogyConfig').isObject().withMessage('Config must be an object'),
], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { pedagogyConfig } = req.body;

    const existing = await prisma.trainingModule.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Module not found' });

    const updated = await prisma.trainingModule.update({
        where: { id },
        data: { pedagogyConfig }
    });

    res.json({
        success: true,
        data: { module: updated },
        message: 'Pedagogy configuration updated'
    });
}));

// ==========================================
// TRAINING ASSIGNMENT (Assign modules to classes/groups with deadlines)
// ==========================================

/**
 * @route   POST /api/training/modules/:id/assign
 * @desc    Assign a training module to classes/groups with a deadline
 * @access  Private (Admin/Instructor)
 */
router.post('/modules/:id/assign', authenticate, authorize('admin', 'principal', 'instructor'), [
    body('deadline').optional().isISO8601().withMessage('Invalid deadline format'),
], asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { classIds, groupIds, deadline, notes, subjectId } = req.body;

    const mod = await prisma.trainingModule.findUnique({ where: { id } });
    if (!mod) return res.status(404).json({ success: false, message: 'Module not found' });

    // Publish automatically if still draft
    if (!mod.isPublished) {
        await prisma.trainingModule.update({ where: { id }, data: { isPublished: true } });
    }

    // Need a subjectId for the assignment. If not provided, find the school's first subject.
    let resolvedSubjectId = subjectId;
    if (!resolvedSubjectId) {
        const firstSubject = await prisma.subject.findFirst({
            where: { schoolId: req.user.schoolId }
        });
        if (!firstSubject) {
            return res.status(400).json({ success: false, message: 'No subjects found. Create a subject first.' });
        }
        resolvedSubjectId = firstSubject.id;
    }

    // Create an assignment record that links the training module to classes
    const dueDate = deadline ? new Date(deadline) : null;
    const assignment = await prisma.assignment.create({
        data: {
            schoolId: req.user.schoolId,
            createdById: req.user.id,
            title: `Training: ${mod.title}`,
            description: notes || `Complete the training module: ${mod.title}`,
            assignmentType: 'training_module',
            trainingModuleId: id,
            subjectId: resolvedSubjectId,
            maxMarks: 100,
            passingMarks: 60,
            status: 'active',
            due_date: dueDate,
        }
    });

    // Create AssignmentTarget records for each class
    const targets = [];
    if (classIds && classIds.length > 0) {
        for (const classId of classIds) {
            targets.push(prisma.assignmentTarget.create({
                data: {
                    assignmentId: assignment.id,
                    targetType: 'class',
                    targetClassId: classId,
                    assignedById: req.user.id,
                    dueDate,
                    specialInstructions: notes || null
                }
            }));
        }
    }

    // Create AssignmentTarget records for each group
    if (groupIds && groupIds.length > 0) {
        for (const groupId of groupIds) {
            targets.push(prisma.assignmentTarget.create({
                data: {
                    assignmentId: assignment.id,
                    targetType: 'group',
                    targetGroupId: groupId,
                    assignedById: req.user.id,
                    dueDate,
                    specialInstructions: notes || null
                }
            }));
        }
    }

    await Promise.all(targets);

    res.status(201).json({
        success: true,
        message: 'Module assigned successfully',
        data: { assignment }
    });
}));

/**
 * @route   GET /api/training/modules/:id/assignments
 * @desc    Get all assignments (class/group allocations) for a module
 * @access  Private (Admin/Instructor)
 */
router.get('/modules/:id/assignments', authenticate, authorize('admin', 'principal', 'instructor'), asyncHandler(async (req, res) => {
    const { id } = req.params;

    const assignments = await prisma.assignment.findMany({
        where: { trainingModuleId: id },
        include: {
            targets: true,
            createdBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Enrich targets with class/group names
    for (const assignment of assignments) {
        for (const target of assignment.targets) {
            if (target.targetClassId) {
                const cls = await prisma.class.findUnique({ where: { id: target.targetClassId }, select: { name: true } });
                target.className = cls?.name || 'Unknown';
            }
            if (target.targetGroupId) {
                const grp = await prisma.studentGroup.findUnique({ where: { id: target.targetGroupId }, select: { name: true } });
                target.groupName = grp?.name || 'Unknown';
            }
        }
    }

    res.json({ success: true, data: { assignments } });
}));

/**
 * @route   GET /api/training/modules/:id/progress
 * @desc    Get progress of all students for a specific module
 * @access  Private (Admin/Instructor)
 */
router.get('/modules/:id/progress', authenticate, authorize('admin', 'principal', 'instructor'), asyncHandler(async (req, res) => {
    const { id } = req.params;

    const progress = await prisma.studentTrainingProgress.findMany({
        where: { moduleId: id },
        include: {
            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } }
        },
        orderBy: { totalXP: 'desc' }
    });

    const unitMasteries = await prisma.studentUnitMastery.findMany({
        where: { unit: { moduleId: id } },
        include: {
            student: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.json({
        success: true,
        data: { progress, unitMasteries }
    });
}));

module.exports = router;
