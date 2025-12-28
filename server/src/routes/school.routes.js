const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/schools/academic-years
 * @desc    Get all academic years (PUBLIC - for login page session selector)
 * @access  Public
 */
router.get('/academic-years', asyncHandler(async (req, res) => {
    // Get academic years across all schools (or filter by school if needed)
    const academicYears = await prisma.academicYear.findMany({
        orderBy: { startDate: 'desc' },
        select: {
            id: true,
            yearLabel: true,
            startDate: true,
            endDate: true,
            isCurrent: true
        }
    });

    res.json({
        success: true,
        data: { academicYears }
    });
}));


/**
 * @route   GET /api/schools
 * @desc    Get all schools (admin only)
 * @access  Private (Super Admin)
 */
router.get('/', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const schools = await prisma.school.findMany({
        include: {
            _count: {
                select: { users: true, classes: true }
            }
        }
    });

    res.json({
        success: true,
        data: { schools }
    });
}));

/**
 * @route   GET /api/schools/:id
 * @desc    Get school by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const school = await prisma.school.findUnique({
        where: { id: req.params.id },
        include: {
            academicYears: {
                orderBy: { startDate: 'desc' }
            },
            _count: {
                select: { users: true, classes: true, subjects: true, labs: true }
            }
        }
    });

    if (!school) {
        return res.status(404).json({
            success: false,
            message: 'School not found'
        });
    }

    res.json({
        success: true,
        data: { school }
    });
}));

/**
 * @route   POST /api/schools
 * @desc    Create a new school
 * @access  Private (Super Admin)
 */
router.post('/', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const {
        name, nameHindi, nameRegional, code, address,
        state, district, boardAffiliation,
        primaryLanguage, secondaryLanguages, academicYearStart
    } = req.body;

    const school = await prisma.school.create({
        data: {
            name,
            nameHindi,
            nameRegional,
            code,
            address,
            state,
            district,
            boardAffiliation,
            primaryLanguage: primaryLanguage || 'en',
            secondaryLanguages: secondaryLanguages || [],
            academicYearStart: academicYearStart || 4
        }
    });

    res.status(201).json({
        success: true,
        message: 'School created successfully',
        data: { school }
    });
}));

/**
 * @route   PUT /api/schools/:id
 * @desc    Update school
 * @access  Private (Admin, Principal)
 */
router.put('/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const school = await prisma.school.update({
        where: { id: req.params.id },
        data: req.body
    });

    res.json({
        success: true,
        message: 'School updated successfully',
        data: { school }
    });
}));

/**
 * @route   PUT /api/schools/:id/letterhead
 * @desc    Update school letterhead URL
 * @access  Private (Admin, Principal)
 */
router.put('/:id/letterhead', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { letterheadUrl } = req.body;

    const school = await prisma.school.update({
        where: { id: req.params.id },
        data: { letterheadUrl }
    });

    res.json({
        success: true,
        message: 'Letterhead updated successfully',
        data: { school }
    });
}));

module.exports = router;
