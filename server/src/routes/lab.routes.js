const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/labs
 * @desc    Get all labs for the school
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const labs = await prisma.lab.findMany({
        where: { schoolId: req.user.schoolId },
        include: {
            subject: { select: { id: true, name: true } },
            incharge: { select: { id: true, firstName: true, lastName: true } },
            _count: { select: { pcs: true } }
        },
        orderBy: { name: 'asc' }
    });

    res.json({
        success: true,
        data: { labs }
    });
}));

/**
 * @route   GET /api/labs/:id
 * @desc    Get lab by ID with PCs
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const lab = await prisma.lab.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId },
        include: {
            subject: { select: { id: true, name: true } },
            incharge: { select: { id: true, firstName: true, lastName: true } },
            pcs: { orderBy: { pcNumber: 'asc' } }
        }
    });

    if (!lab) {
        return res.status(404).json({ success: false, message: 'Lab not found' });
    }

    res.json({
        success: true,
        data: { lab }
    });
}));

/**
 * @route   POST /api/labs
 * @desc    Create a new lab
 * @access  Private (Admin)
 */
router.post('/', authenticate, authorize('admin', 'principal'), [
    body('name').trim().notEmpty().withMessage('Lab name is required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, nameHindi, roomNumber, capacity, subjectId, inchargeId } = req.body;

    const lab = await prisma.lab.create({
        data: {
            schoolId: req.user.schoolId,
            name,
            nameHindi,
            roomNumber,
            capacity: capacity || 30,
            subjectId,
            inchargeId
        },
        include: {
            subject: { select: { id: true, name: true } },
            incharge: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.status(201).json({
        success: true,
        message: 'Lab created successfully',
        data: { lab }
    });
}));

/**
 * @route   PUT /api/labs/:id
 * @desc    Update a lab
 * @access  Private (Admin)
 */
router.put('/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const lab = await prisma.lab.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId }
    });

    if (!lab) {
        return res.status(404).json({ success: false, message: 'Lab not found' });
    }

    const { name, nameHindi, roomNumber, capacity, subjectId, inchargeId } = req.body;

    const updated = await prisma.lab.update({
        where: { id: req.params.id },
        data: { name, nameHindi, roomNumber, capacity, subjectId, inchargeId },
        include: {
            subject: { select: { id: true, name: true } },
            incharge: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.json({
        success: true,
        message: 'Lab updated successfully',
        data: { lab: updated }
    });
}));

/**
 * @route   DELETE /api/labs/:id
 * @desc    Delete a lab
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const lab = await prisma.lab.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId }
    });

    if (!lab) {
        return res.status(404).json({ success: false, message: 'Lab not found' });
    }

    await prisma.lab.delete({ where: { id: req.params.id } });

    res.json({
        success: true,
        message: 'Lab deleted successfully'
    });
}));

// ==================== LAB PCs ====================

/**
 * @route   GET /api/labs/:labId/pcs
 * @desc    Get all PCs in a lab
 * @access  Private
 */
router.get('/:labId/pcs', authenticate, asyncHandler(async (req, res) => {
    const pcs = await prisma.labPC.findMany({
        where: { labId: req.params.labId, schoolId: req.user.schoolId },
        include: {
            assignedGroups: {
                include: {
                    class: { select: { id: true, name: true, gradeLevel: true, section: true } }
                }
            }
        },
        orderBy: { pcNumber: 'asc' }
    });

    res.json({
        success: true,
        data: { pcs }
    });
}));

/**
 * @route   GET /api/labs/pcs/all
 * @desc    Get all PCs across all labs (for assignment dropdown)
 * @access  Private
 */
router.get('/pcs/all', authenticate, asyncHandler(async (req, res) => {
    const pcs = await prisma.labPC.findMany({
        where: { schoolId: req.user.schoolId, status: 'active' },
        include: {
            lab: { select: { id: true, name: true, roomNumber: true } },
            assignedGroups: { select: { id: true, name: true } }
        },
        orderBy: [{ lab: { name: 'asc' } }, { pcNumber: 'asc' }]
    });

    res.json({
        success: true,
        data: { pcs }
    });
}));

/**
 * @route   POST /api/labs/:labId/pcs
 * @desc    Add a PC to a lab
 * @access  Private (Admin)
 */
router.post('/:labId/pcs', authenticate, authorize('admin', 'principal', 'lab_assistant'), [
    body('pcNumber').trim().notEmpty().withMessage('PC number is required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Verify lab exists
    const lab = await prisma.lab.findFirst({
        where: { id: req.params.labId, schoolId: req.user.schoolId }
    });
    if (!lab) {
        return res.status(404).json({ success: false, message: 'Lab not found' });
    }

    const { pcNumber, brand, modelNo, serialNo, ram, storage, processor, os, status, notes } = req.body;

    const pc = await prisma.labPC.create({
        data: {
            labId: req.params.labId,
            schoolId: req.user.schoolId,
            pcNumber,
            brand,
            modelNo,
            serialNo,
            ram,
            storage,
            processor,
            os,
            status: status || 'active',
            notes
        }
    });

    res.status(201).json({
        success: true,
        message: 'PC added successfully',
        data: { pc }
    });
}));

/**
 * @route   PUT /api/labs/:labId/pcs/:pcId
 * @desc    Update a PC
 * @access  Private (Admin)
 */
router.put('/:labId/pcs/:pcId', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const pc = await prisma.labPC.findFirst({
        where: { id: req.params.pcId, labId: req.params.labId, schoolId: req.user.schoolId }
    });

    if (!pc) {
        return res.status(404).json({ success: false, message: 'PC not found' });
    }

    const { pcNumber, brand, modelNo, serialNo, ram, storage, processor, os, status, notes } = req.body;

    const updated = await prisma.labPC.update({
        where: { id: req.params.pcId },
        data: { pcNumber, brand, modelNo, serialNo, ram, storage, processor, os, status, notes }
    });

    res.json({
        success: true,
        message: 'PC updated successfully',
        data: { pc: updated }
    });
}));

/**
 * @route   DELETE /api/labs/:labId/pcs/:pcId
 * @desc    Delete a PC
 * @access  Private (Admin)
 */
router.delete('/:labId/pcs/:pcId', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const pc = await prisma.labPC.findFirst({
        where: { id: req.params.pcId, labId: req.params.labId, schoolId: req.user.schoolId }
    });

    if (!pc) {
        return res.status(404).json({ success: false, message: 'PC not found' });
    }

    // Unassign from any groups first
    await prisma.studentGroup.updateMany({
        where: { assignedPcId: req.params.pcId },
        data: { assignedPcId: null }
    });

    await prisma.labPC.delete({ where: { id: req.params.pcId } });

    res.json({
        success: true,
        message: 'PC deleted successfully'
    });
}));

/**
 * @route   PUT /api/labs/groups/:groupId/assign-pc
 * @desc    Assign a PC to a student group
 * @access  Private (Admin, Instructor)
 */
router.put('/groups/:groupId/assign-pc', authenticate, authorize('admin', 'principal', 'instructor', 'lab_assistant'), asyncHandler(async (req, res) => {
    const { pcId } = req.body;

    const group = await prisma.studentGroup.findUnique({
        where: { id: req.params.groupId },
        include: { class: true }
    });

    if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // If pcId is null, unassign
    if (!pcId) {
        await prisma.studentGroup.update({
            where: { id: req.params.groupId },
            data: { assignedPcId: null }
        });
        return res.json({ success: true, message: 'PC unassigned from group' });
    }

    // Verify PC exists
    const pc = await prisma.labPC.findFirst({
        where: { id: pcId, schoolId: req.user.schoolId }
    });

    if (!pc) {
        return res.status(404).json({ success: false, message: 'PC not found' });
    }

    // Assign PC
    const updated = await prisma.studentGroup.update({
        where: { id: req.params.groupId },
        data: { assignedPcId: pcId },
        include: {
            assignedPc: { include: { lab: { select: { name: true } } } }
        }
    });

    res.json({
        success: true,
        message: `PC ${pc.pcNumber} assigned to ${group.name}`,
        data: { group: updated }
    });
}));

module.exports = router;
