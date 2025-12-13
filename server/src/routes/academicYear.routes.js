const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/academic-years
 * @desc    Get all academic years for user's school
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { schoolId } = req.user;

    const academicYears = await prisma.academicYear.findMany({
        where: { schoolId },
        orderBy: { startDate: 'desc' }
    });

    res.json({
        success: true,
        data: { academicYears }
    });
}));

/**
 * @route   GET /api/academic-years/current
 * @desc    Get current academic year
 * @access  Private
 */
router.get('/current', authenticate, asyncHandler(async (req, res) => {
    const { schoolId } = req.user;

    const academicYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true }
    });

    res.json({
        success: true,
        data: { academicYear }
    });
}));

/**
 * @route   POST /api/academic-years
 * @desc    Create a new academic year
 * @access  Private (Admin, Principal)
 */
router.post('/', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { schoolId } = req.user;
    const { yearLabel, startDate, endDate, isCurrent } = req.body;

    // If setting as current, unset other current years
    if (isCurrent) {
        await prisma.academicYear.updateMany({
            where: { schoolId, isCurrent: true },
            data: { isCurrent: false }
        });
    }

    const academicYear = await prisma.academicYear.create({
        data: {
            schoolId,
            yearLabel,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isCurrent: isCurrent || false
        }
    });

    res.status(201).json({
        success: true,
        message: 'Academic year created successfully',
        data: { academicYear }
    });
}));

/**
 * @route   PUT /api/academic-years/:id/set-current
 * @desc    Set an academic year as current
 * @access  Private (Admin, Principal)
 */
router.put('/:id/set-current', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { schoolId } = req.user;
    const { id } = req.params;

    // Unset current on all other years
    await prisma.academicYear.updateMany({
        where: { schoolId, isCurrent: true },
        data: { isCurrent: false }
    });

    // Set this year as current
    const academicYear = await prisma.academicYear.update({
        where: { id },
        data: { isCurrent: true }
    });

    res.json({
        success: true,
        message: 'Academic year set as current',
        data: { academicYear }
    });
}));

module.exports = router;
