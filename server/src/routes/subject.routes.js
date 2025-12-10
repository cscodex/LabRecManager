const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/subjects
 * @desc    Get all subjects
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { hasLab } = req.query;

    let where = { schoolId: req.user.schoolId };
    if (hasLab !== undefined) where.hasLab = hasLab === 'true';

    const subjects = await prisma.subject.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
            labs: {
                select: { id: true, name: true, nameHindi: true }
            },
            _count: {
                select: { assignments: true }
            }
        }
    });

    res.json({
        success: true,
        data: { subjects }
    });
}));

/**
 * @route   GET /api/subjects/:id
 * @desc    Get subject by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const subject = await prisma.subject.findUnique({
        where: { id: req.params.id },
        include: {
            labs: true,
            classSubjects: {
                include: {
                    class: true,
                    instructor: {
                        select: { id: true, firstName: true, lastName: true }
                    },
                    labInstructor: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            }
        }
    });

    if (!subject) {
        return res.status(404).json({
            success: false,
            message: 'Subject not found'
        });
    }

    res.json({
        success: true,
        data: { subject }
    });
}));

/**
 * @route   POST /api/subjects
 * @desc    Create a new subject
 * @access  Private (Admin)
 */
router.post('/', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const {
        code, name, nameHindi, nameRegional,
        hasLab, labHoursPerWeek, theoryHoursPerWeek
    } = req.body;

    const subject = await prisma.subject.create({
        data: {
            schoolId: req.user.schoolId,
            code,
            name,
            nameHindi,
            nameRegional,
            hasLab: hasLab || false,
            labHoursPerWeek: labHoursPerWeek || 0,
            theoryHoursPerWeek: theoryHoursPerWeek || 0
        }
    });

    res.status(201).json({
        success: true,
        message: 'Subject created successfully',
        data: { subject }
    });
}));

/**
 * @route   GET /api/subjects/:id/labs
 * @desc    Get labs for a subject
 * @access  Private
 */
router.get('/:id/labs', authenticate, asyncHandler(async (req, res) => {
    const labs = await prisma.lab.findMany({
        where: { subjectId: req.params.id },
        include: {
            incharge: {
                select: { id: true, firstName: true, lastName: true }
            }
        }
    });

    res.json({
        success: true,
        data: { labs }
    });
}));

/**
 * @route   POST /api/subjects/:id/labs
 * @desc    Create a lab for subject
 * @access  Private (Admin)
 */
router.post('/:id/labs', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { name, nameHindi, roomNumber, capacity, equipmentList, inchargeId } = req.body;

    const lab = await prisma.lab.create({
        data: {
            schoolId: req.user.schoolId,
            subjectId: req.params.id,
            name,
            nameHindi,
            roomNumber,
            capacity: capacity || 30,
            equipmentList,
            inchargeId
        }
    });

    res.status(201).json({
        success: true,
        message: 'Lab created successfully',
        messageHindi: 'प्रयोगशाला सफलतापूर्वक बनाई गई',
        data: { lab }
    });
}));

module.exports = router;
