const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Item types with their specific spec fields
const ITEM_TYPES = {
    pc: { label: 'Computer', specFields: ['processor', 'ram', 'storage', 'os', 'monitor'] },
    printer: { label: 'Printer', specFields: ['printType', 'paperSize', 'connectivity'] },
    router: { label: 'WiFi Router', specFields: ['speed', 'frequency', 'ports'] },
    speaker: { label: 'Speaker', specFields: ['power', 'channels'] },
    projector: { label: 'Projector', specFields: ['resolution', 'lumens', 'connectivity'] },
    chair: { label: 'Chair', specFields: ['material', 'color'] },
    table: { label: 'Computer Table', specFields: ['material', 'dimensions', 'color'] },
    other: { label: 'Other', specFields: [] }
};

/**
 * @route   GET /api/labs/item-types
 * @desc    Get available item types and their spec fields
 * @access  Private
 */
router.get('/item-types', authenticate, asyncHandler(async (req, res) => {
    res.json({ success: true, data: { itemTypes: ITEM_TYPES } });
}));

/**
 * @route   GET /api/labs/items/pcs
 * @desc    Get all PCs across all labs (for group assignment dropdown)
 * @access  Private
 * @note    This route must be defined BEFORE /:id to avoid matching "items" as an id
 */
router.get('/items/pcs', authenticate, asyncHandler(async (req, res) => {
    const items = await prisma.labItem.findMany({
        where: { schoolId: req.user.schoolId, itemType: 'pc', status: 'active' },
        include: {
            lab: { select: { id: true, name: true, roomNumber: true } },
            assignedGroups: { select: { id: true, name: true } }
        },
        orderBy: [{ lab: { name: 'asc' } }, { itemNumber: 'asc' }]
    });

    res.json({
        success: true,
        data: { items }
    });
}));

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
            _count: { select: { items: true } }
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
 * @desc    Get lab by ID with all items
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const lab = await prisma.lab.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId },
        include: {
            subject: { select: { id: true, name: true } },
            incharge: { select: { id: true, firstName: true, lastName: true } },
            items: { orderBy: [{ itemType: 'asc' }, { itemNumber: 'asc' }] }
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

// ==================== LAB ITEMS (Inventory) ====================

/**
 * @route   GET /api/labs/:labId/items
 * @desc    Get all items in a lab (optionally filter by type)
 * @access  Private
 */
router.get('/:labId/items', authenticate, asyncHandler(async (req, res) => {
    const { type } = req.query;
    const where = { labId: req.params.labId, schoolId: req.user.schoolId };
    if (type) where.itemType = type;

    const items = await prisma.labItem.findMany({
        where,
        include: {
            assignedGroups: {
                include: {
                    class: { select: { id: true, name: true, gradeLevel: true, section: true } }
                }
            }
        },
        orderBy: [{ itemType: 'asc' }, { itemNumber: 'asc' }]
    });

    res.json({
        success: true,
        data: { items }
    });
}));

/**
 * @route   POST /api/labs/:labId/items
 * @desc    Add an item to a lab
 * @access  Private (Admin)
 */
router.post('/:labId/items', authenticate, authorize('admin', 'principal', 'lab_assistant'), [
    body('itemType').trim().notEmpty().withMessage('Item type is required'),
    body('itemNumber').trim().notEmpty().withMessage('Item number is required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const lab = await prisma.lab.findFirst({
        where: { id: req.params.labId, schoolId: req.user.schoolId }
    });
    if (!lab) {
        return res.status(404).json({ success: false, message: 'Lab not found' });
    }

    const { itemType, itemNumber, brand, modelNo, serialNo, quantity, specs, status, notes, purchaseDate, warrantyEnd } = req.body;

    const item = await prisma.labItem.create({
        data: {
            labId: req.params.labId,
            schoolId: req.user.schoolId,
            itemType,
            itemNumber,
            brand,
            modelNo,
            serialNo,
            quantity: quantity || 1,
            specs: specs || {},
            status: status || 'active',
            notes,
            purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
            warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : null
        }
    });

    res.status(201).json({
        success: true,
        message: `${ITEM_TYPES[itemType]?.label || 'Item'} added successfully`,
        data: { item }
    });
}));

/**
 * @route   PUT /api/labs/:labId/items/:itemId
 * @desc    Update an item
 * @access  Private (Admin)
 */
router.put('/:labId/items/:itemId', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const item = await prisma.labItem.findFirst({
        where: { id: req.params.itemId, labId: req.params.labId, schoolId: req.user.schoolId }
    });

    if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const { itemType, itemNumber, brand, modelNo, serialNo, quantity, specs, status, notes, purchaseDate, warrantyEnd } = req.body;

    const updated = await prisma.labItem.update({
        where: { id: req.params.itemId },
        data: {
            itemType,
            itemNumber,
            brand,
            modelNo,
            serialNo,
            quantity,
            specs,
            status,
            notes,
            purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
            warrantyEnd: warrantyEnd ? new Date(warrantyEnd) : null
        }
    });

    res.json({
        success: true,
        message: 'Item updated successfully',
        data: { item: updated }
    });
}));

/**
 * @route   DELETE /api/labs/:labId/items/:itemId
 * @desc    Delete an item
 * @access  Private (Admin)
 */
router.delete('/:labId/items/:itemId', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const item = await prisma.labItem.findFirst({
        where: { id: req.params.itemId, labId: req.params.labId, schoolId: req.user.schoolId }
    });

    if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Unassign from any groups first (only for PCs)
    if (item.itemType === 'pc') {
        await prisma.studentGroup.updateMany({
            where: { assignedPcId: req.params.itemId },
            data: { assignedPcId: null }
        });
    }

    await prisma.labItem.delete({ where: { id: req.params.itemId } });

    res.json({
        success: true,
        message: 'Item deleted successfully'
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

    if (!pcId) {
        await prisma.studentGroup.update({
            where: { id: req.params.groupId },
            data: { assignedPcId: null }
        });
        return res.json({ success: true, message: 'PC unassigned from group' });
    }

    const pc = await prisma.labItem.findFirst({
        where: { id: pcId, schoolId: req.user.schoolId, itemType: 'pc' }
    });

    if (!pc) {
        return res.status(404).json({ success: false, message: 'PC not found' });
    }

    const updated = await prisma.studentGroup.update({
        where: { id: req.params.groupId },
        data: { assignedPcId: pcId },
        include: {
            assignedPc: { include: { lab: { select: { name: true } } } }
        }
    });

    res.json({
        success: true,
        message: `PC ${pc.itemNumber} assigned to ${group.name}`,
        data: { group: updated }
    });
}));

module.exports = router;
