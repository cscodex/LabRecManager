const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/grade-scales
 * @desc    Get grade scales for the school
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const schoolId = req.user.schoolId;

    const gradeScales = await prisma.gradeScale.findMany({
        where: {
            schoolId,
            isActive: true
        },
        orderBy: { minPercentage: 'desc' }
    });

    res.json({
        success: true,
        data: { gradeScales }
    });
}));

/**
 * @route   GET /api/grade-scales/all
 * @desc    Get all grade scales including inactive
 * @access  Private (Admin)
 */
router.get('/all', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const schoolId = req.user.schoolId;

    const gradeScales = await prisma.gradeScale.findMany({
        where: { schoolId },
        orderBy: { minPercentage: 'desc' }
    });

    res.json({
        success: true,
        data: { gradeScales }
    });
}));

/**
 * @route   GET /api/grade-scales/history
 * @desc    Get grade scale change history
 * @access  Private (Instructor/Admin)
 */
router.get('/history', authenticate, asyncHandler(async (req, res) => {
    const schoolId = req.user.schoolId;
    const { limit = 50 } = req.query;

    // Get all grade scales for this school
    const allGradeScales = await prisma.gradeScale.findMany({
        where: { schoolId },
        select: { id: true, gradeLetter: true, minPercentage: true, maxPercentage: true, gradePoint: true, isActive: true }
    });

    const gradeScaleIds = allGradeScales.map(g => g.id);

    const history = await prisma.gradeScaleHistory.findMany({
        where: {
            gradeScaleId: { in: gradeScaleIds }
        },
        orderBy: { changedAt: 'desc' },
        take: parseInt(limit) * 8, // Get more entries to group into revisions
        include: {
            gradeScale: {
                select: { gradeLetter: true, schoolId: true }
            }
        }
    });

    // Get user details for changedBy
    const userIds = [...new Set(history.map(h => h.changedById))];
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, role: true }
    });
    const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {});

    // Group history entries into revisions (changes within 1 minute of each other by same user)
    const revisions = [];
    let currentRevision = null;

    for (const entry of history) {
        const entryTime = new Date(entry.changedAt).getTime();
        const enrichedEntry = {
            ...entry,
            changedBy: userMap[entry.changedById] || null
        };

        if (!currentRevision) {
            // Start new revision
            currentRevision = {
                id: entry.id,
                timestamp: entry.changedAt,
                changedBy: enrichedEntry.changedBy,
                action: entry.action,
                reason: entry.reason,
                changes: [enrichedEntry]
            };
        } else {
            const revisionTime = new Date(currentRevision.timestamp).getTime();
            const timeDiff = Math.abs(revisionTime - entryTime);

            // Group if within 1 minute and same user
            if (timeDiff <= 60000 && entry.changedById === (currentRevision.changedBy?.id || null)) {
                currentRevision.changes.push(enrichedEntry);
            } else {
                // Save current revision and start new one
                revisions.push(currentRevision);
                currentRevision = {
                    id: entry.id,
                    timestamp: entry.changedAt,
                    changedBy: enrichedEntry.changedBy,
                    action: entry.action,
                    reason: entry.reason,
                    changes: [enrichedEntry]
                };
            }
        }
    }

    // Don't forget the last revision
    if (currentRevision) {
        revisions.push(currentRevision);
    }

    // Limit revisions
    const limitedRevisions = revisions.slice(0, parseInt(limit));

    // Build the complete grade scale state at each revision for better context
    const revisionsWithState = limitedRevisions.map(revision => {
        // For 'created' actions, show the new state
        // For 'updated' actions, show old -> new state
        // For 'deleted' actions, show what was removed

        const scalesSummary = revision.changes.map(change => ({
            gradeLetter: change.newLetter || change.previousLetter,
            previousState: change.previousLetter ? {
                letter: change.previousLetter,
                minPct: change.previousMinPct,
                maxPct: change.previousMaxPct,
                points: change.previousPoints
            } : null,
            newState: change.newLetter ? {
                letter: change.newLetter,
                minPct: change.newMinPct,
                maxPct: change.newMaxPct,
                points: change.newPoints
            } : null,
            action: change.action
        }));

        return {
            ...revision,
            scalesSummary,
            changesCount: revision.changes.length
        };
    });

    // Also get the current complete grade scale state for reference
    const currentScales = allGradeScales
        .filter(g => g.isActive)
        .sort((a, b) => b.minPercentage - a.minPercentage)
        .map(g => ({
            letter: g.gradeLetter,
            minPct: g.minPercentage,
            maxPct: g.maxPercentage,
            points: Number(g.gradePoint)
        }));

    res.json({
        success: true,
        data: {
            currentScales,
            revisions: revisionsWithState,
            totalRevisions: revisions.length,
            // Keep individual history for backward compatibility
            history: history.map(h => ({
                ...h,
                changedBy: userMap[h.changedById] || null
            }))
        }
    });
}));

/**
 * @route   POST /api/grade-scales
 * @desc    Create a new grade scale
 * @access  Private (Admin)
 */
router.post('/', authenticate, authorize('admin', 'principal'), [
    body('gradeLetter').trim().notEmpty().withMessage('Grade letter is required'),
    body('gradePoint').isFloat({ min: 0, max: 10 }).withMessage('Grade point must be between 0 and 10'),
    body('minPercentage').isInt({ min: 0, max: 100 }).withMessage('Min percentage must be 0-100'),
    body('maxPercentage').isInt({ min: 0, max: 100 }).withMessage('Max percentage must be 0-100')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { gradeLetter, gradePoint, minPercentage, maxPercentage, description } = req.body;
    const schoolId = req.user.schoolId;

    // Check for overlapping ranges
    const overlapping = await prisma.gradeScale.findFirst({
        where: {
            schoolId,
            isActive: true,
            OR: [
                { AND: [{ minPercentage: { lte: maxPercentage } }, { maxPercentage: { gte: minPercentage } }] }
            ]
        }
    });

    if (overlapping && overlapping.gradeLetter !== gradeLetter) {
        return res.status(400).json({
            success: false,
            message: `Percentage range overlaps with grade ${overlapping.gradeLetter}`
        });
    }

    const gradeScale = await prisma.gradeScale.upsert({
        where: {
            schoolId_gradeLetter: { schoolId, gradeLetter }
        },
        create: {
            schoolId,
            gradeLetter,
            gradePoint,
            minPercentage,
            maxPercentage,
            description
        },
        update: {
            gradePoint,
            minPercentage,
            maxPercentage,
            description,
            isActive: true
        }
    });

    // Log to history
    await prisma.gradeScaleHistory.create({
        data: {
            gradeScaleId: gradeScale.id,
            action: 'created',
            newLetter: gradeLetter,
            newMinPct: minPercentage,
            newMaxPct: maxPercentage,
            newPoints: gradePoint,
            changedById: req.user.id,
            reason: 'Grade scale created'
        }
    });

    res.status(201).json({
        success: true,
        message: 'Grade scale saved successfully',
        data: { gradeScale }
    });
}));

/**
 * @route   PUT /api/grade-scales/:id
 * @desc    Update a grade scale
 * @access  Private (Admin)
 */
router.put('/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { gradeLetter, gradePoint, minPercentage, maxPercentage, description, isActive, reason } = req.body;

    // Get previous values
    const previous = await prisma.gradeScale.findUnique({
        where: { id: req.params.id }
    });

    const gradeScale = await prisma.gradeScale.update({
        where: { id: req.params.id },
        data: {
            gradeLetter,
            gradePoint,
            minPercentage,
            maxPercentage,
            description,
            isActive
        }
    });

    // Log to history
    await prisma.gradeScaleHistory.create({
        data: {
            gradeScaleId: gradeScale.id,
            action: 'updated',
            previousLetter: previous.gradeLetter,
            previousMinPct: previous.minPercentage,
            previousMaxPct: previous.maxPercentage,
            previousPoints: previous.gradePoint,
            newLetter: gradeLetter,
            newMinPct: minPercentage,
            newMaxPct: maxPercentage,
            newPoints: gradePoint,
            changedById: req.user.id,
            reason: reason || 'Grade scale updated'
        }
    });

    res.json({
        success: true,
        message: 'Grade scale updated',
        data: { gradeScale }
    });
}));

/**
 * @route   DELETE /api/grade-scales/:id
 * @desc    Soft delete a grade scale
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    // Get current values before deactivating
    const previous = await prisma.gradeScale.findUnique({
        where: { id: req.params.id }
    });

    await prisma.gradeScale.update({
        where: { id: req.params.id },
        data: { isActive: false }
    });

    // Log to history
    await prisma.gradeScaleHistory.create({
        data: {
            gradeScaleId: previous.id,
            action: 'deleted',
            previousLetter: previous.gradeLetter,
            previousMinPct: previous.minPercentage,
            previousMaxPct: previous.maxPercentage,
            previousPoints: previous.gradePoint,
            changedById: req.user.id,
            reason: 'Grade scale deactivated'
        }
    });

    res.json({
        success: true,
        message: 'Grade scale deactivated'
    });
}));

/**
 * @route   POST /api/grade-scales/reset
 * @desc    Reset to default CBSE grade scales
 * @access  Private (Admin)
 */
router.post('/reset', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const schoolId = req.user.schoolId;

    // Deactivate all existing
    await prisma.gradeScale.updateMany({
        where: { schoolId },
        data: { isActive: false }
    });

    // Create default scales
    const defaults = [
        { gradeLetter: 'A1', gradePoint: 10.0, minPercentage: 91, maxPercentage: 100, description: 'Outstanding' },
        { gradeLetter: 'A2', gradePoint: 9.0, minPercentage: 81, maxPercentage: 90, description: 'Excellent' },
        { gradeLetter: 'B1', gradePoint: 8.0, minPercentage: 71, maxPercentage: 80, description: 'Very Good' },
        { gradeLetter: 'B2', gradePoint: 7.0, minPercentage: 61, maxPercentage: 70, description: 'Good' },
        { gradeLetter: 'C1', gradePoint: 6.0, minPercentage: 51, maxPercentage: 60, description: 'Above Average' },
        { gradeLetter: 'C2', gradePoint: 5.0, minPercentage: 41, maxPercentage: 50, description: 'Average' },
        { gradeLetter: 'D', gradePoint: 4.0, minPercentage: 33, maxPercentage: 40, description: 'Below Average' },
        { gradeLetter: 'E', gradePoint: 0.0, minPercentage: 0, maxPercentage: 32, description: 'Needs Improvement' }
    ];

    for (const scale of defaults) {
        await prisma.gradeScale.upsert({
            where: { schoolId_gradeLetter: { schoolId, gradeLetter: scale.gradeLetter } },
            create: { schoolId, ...scale },
            update: { ...scale, isActive: true }
        });
    }

    const gradeScales = await prisma.gradeScale.findMany({
        where: { schoolId, isActive: true },
        orderBy: { minPercentage: 'desc' }
    });

    res.json({
        success: true,
        message: 'Grade scales reset to default',
        data: { gradeScales }
    });
}));

module.exports = router;
