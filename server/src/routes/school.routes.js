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

    // Get default school info for login page
    const school = await prisma.school.findFirst({
        select: {
            name: true,
            logoUrl: true
        }
    });

    res.json({
        success: true,
        data: {
            academicYears,
            school // Return default school info
        }
    });
}));

/**
 * @route   GET /api/schools/profile
 * @desc    Get current user's school profile
 * @access  Private (Admin, Principal)
 */
router.get('/profile', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    console.log('='.repeat(60));
    console.log('[SCHOOL-PROFILE] Request received at:', new Date().toISOString());
    console.log('[SCHOOL-PROFILE] User ID:', req.user?.id);
    console.log('[SCHOOL-PROFILE] User Role:', req.user?.role);
    console.log('[SCHOOL-PROFILE] SchoolID from token:', req.user?.schoolId);
    console.log('[SCHOOL-PROFILE] SchoolID type:', typeof req.user?.schoolId);
    console.log('='.repeat(60));

    // Explicitly validate schoolId from user token before query
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!req.user.schoolId || !uuidRegex.test(req.user.schoolId)) {
        console.error('[SCHOOL-PROFILE][ERROR] Invalid School ID in User Token!');
        console.error('[SCHOOL-PROFILE][ERROR] Value:', JSON.stringify(req.user.schoolId));
        console.error('[SCHOOL-PROFILE][ERROR] Full user object:', JSON.stringify(req.user));
        return res.status(400).json({
            success: false,
            message: 'Invalid School ID in user profile'
        });
    }

    try {
        console.log('[SCHOOL-PROFILE] Querying database for school...');
        const school = await prisma.school.findUnique({
            where: { id: req.user.schoolId },
            select: {
                id: true,
                name: true,
                nameHindi: true,
                nameRegional: true,
                code: true,
                address: true,
                state: true,
                district: true,
                pinCode: true,
                email: true,
                phone1: true,
                phone2: true,
                logoUrl: true,
                letterheadUrl: true,
                boardAffiliation: true,
                primaryLanguage: true
            }
        });

        if (!school) {
            console.error('[SCHOOL-PROFILE][ERROR] School not found for ID:', req.user.schoolId);
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        console.log('[SCHOOL-PROFILE] Success! Returning school:', school.name);
        res.json({
            success: true,
            data: school
        });
    } catch (error) {
        console.error('[SCHOOL-PROFILE][CRITICAL] Database error!');
        console.error('[SCHOOL-PROFILE][CRITICAL] Error name:', error.name);
        console.error('[SCHOOL-PROFILE][CRITICAL] Error message:', error.message);
        console.error('[SCHOOL-PROFILE][CRITICAL] Full error:', error);
        console.error('[SCHOOL-PROFILE][CRITICAL] Stack:', error.stack);
        throw error;
    }
}));

/**
 * @route   PUT /api/schools/profile
 * @desc    Update current user's school profile
 * @access  Private (Admin, Principal)
 */
router.put('/profile', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const {
        name, nameHindi, nameRegional, address, state, district, pinCode,
        email, phone1, phone2, logoUrl, letterheadUrl, boardAffiliation
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (nameHindi !== undefined) updateData.nameHindi = nameHindi;
    if (nameRegional !== undefined) updateData.nameRegional = nameRegional;
    if (address !== undefined) updateData.address = address;
    if (state !== undefined) updateData.state = state;
    if (district !== undefined) updateData.district = district;
    if (pinCode !== undefined) updateData.pinCode = pinCode;
    if (email !== undefined) updateData.email = email;
    if (phone1 !== undefined) updateData.phone1 = phone1;
    if (phone2 !== undefined) updateData.phone2 = phone2;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (letterheadUrl !== undefined) updateData.letterheadUrl = letterheadUrl;
    if (boardAffiliation !== undefined) updateData.boardAffiliation = boardAffiliation;

    const school = await prisma.school.update({
        where: { id: req.user.schoolId },
        data: updateData
    });

    res.json({
        success: true,
        message: 'School profile updated successfully',
        data: school
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
    console.log('[DEBUG] GET /:id hit. Params ID:', req.params.id);

    // Validate UUID format to prevent "Inconsistent column data" error
    // if a semantic URL (like 'profile' or 'public') falls through
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id)) {
        console.warn('[WARN] Invalid UUID passed to GET /:id:', req.params.id);
        return res.status(400).json({
            success: false,
            message: 'Invalid School ID format'
        });
    }

    try {
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
    } catch (error) {
        console.error('[CRITICAL] Error in GET /:id:', error);
        throw error;
    }
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
    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid School ID' });
    }

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

    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid School ID' });
    }

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
