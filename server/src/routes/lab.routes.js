const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { uploadSingle } = require('../middleware/upload');

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
 * @route   POST /api/labs/upload-image
 * @desc    Upload an image for inventory item
 * @access  Private (Admin)
 */
router.post('/upload-image', authenticate, authorize('admin', 'principal', 'lab_assistant'), uploadSingle, asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    // Return the URL path to the uploaded image
    const imageUrl = `/${req.file.path.replace(/\\/g, '/')}`;

    res.json({
        success: true,
        message: 'Image uploaded successfully',
        data: { imageUrl }
    });
}));

/**
 * @route   GET /api/labs/import-history
 * @desc    Get import history for all labs
 * @access  Private (Admin)
 */
router.get('/import-history', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const history = await prisma.importHistory.findMany({
        where: { schoolId: req.user.schoolId },
        include: {
            lab: { select: { id: true, name: true } },
            uploadedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    res.json({
        success: true,
        data: { history }
    });
}));

/**
 * @route   POST /api/labs/:labId/import-history
 * @desc    Save import history record
 * @access  Private (Admin)
 */
router.post('/:labId/import-history', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const { labId } = req.params;
    const { fileName, fileSize, itemsImported, itemsFailed, status, errors } = req.body;

    const record = await prisma.importHistory.create({
        data: {
            schoolId: req.user.schoolId,
            labId,
            uploadedById: req.user.id,
            fileName,
            fileSize,
            itemsImported,
            itemsFailed: itemsFailed || 0,
            status: status || 'completed',
            errors: errors || null
        }
    });

    res.status(201).json({
        success: true,
        message: 'Import history saved',
        data: { record }
    });
}));

/**
 * @route   GET /api/labs/items/:itemId/maintenance
 * @desc    Get maintenance history for an item
 * @access  Private
 */
router.get('/items/:itemId/maintenance', authenticate, asyncHandler(async (req, res) => {
    const { itemId } = req.params;

    const history = await prisma.itemMaintenanceHistory.findMany({
        where: { itemId },
        include: {
            recordedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: { history } });
}));

/**
 * @route   POST /api/labs/items/:itemId/maintenance
 * @desc    Add maintenance record for an item
 * @access  Private (Admin)
 */
router.post('/items/:itemId/maintenance', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const { type, description, cost, vendor, partName, resolvedAt } = req.body;

    // Validate item exists
    const item = await prisma.labItem.findUnique({ where: { id: itemId } });
    if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const record = await prisma.itemMaintenanceHistory.create({
        data: {
            itemId,
            recordedById: req.user.id,
            type,
            description,
            cost: cost ? parseFloat(cost) : null,
            vendor: vendor || null,
            partName: partName || null,
            resolvedAt: resolvedAt ? new Date(resolvedAt) : null
        },
        include: {
            recordedBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.status(201).json({
        success: true,
        message: 'Maintenance record added',
        data: { record }
    });
}));

/**
 * @route   GET /api/labs/inventory-reports
 * @desc    Get inventory reports with alerts
 * @access  Private (Admin/Principal)
 */
router.get('/inventory-reports', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const schoolId = req.user.schoolId;

    // Get all items
    const items = await prisma.labItem.findMany({
        where: { schoolId },
        include: { lab: { select: { name: true } } }
    });

    // Stats by type
    const statsByType = {};
    const statsByStatus = { active: 0, maintenance: 0, retired: 0 };
    items.forEach(item => {
        statsByType[item.itemType] = (statsByType[item.itemType] || 0) + 1;
        statsByStatus[item.status] = (statsByStatus[item.status] || 0) + 1;
    });

    // Maintenance alerts (items in maintenance)
    const maintenanceAlerts = items.filter(i => i.status === 'maintenance');

    // Warranty expiration alerts (next 30, 60, 90 days)
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const warrantyAlerts = {
        expiredOrExpiring30: items.filter(i => i.warrantyEnd && new Date(i.warrantyEnd) <= in30Days),
        expiring60: items.filter(i => i.warrantyEnd && new Date(i.warrantyEnd) > in30Days && new Date(i.warrantyEnd) <= in60Days),
        expiring90: items.filter(i => i.warrantyEnd && new Date(i.warrantyEnd) > in60Days && new Date(i.warrantyEnd) <= in90Days)
    };

    // Low stock alerts (types with < 3 items)
    const lowStockAlerts = Object.entries(statsByType)
        .filter(([type, count]) => count < 3)
        .map(([type, count]) => ({ type, count, label: ITEM_TYPES[type]?.label || type }));

    // Get labs summary
    const labs = await prisma.lab.findMany({
        where: { schoolId },
        select: { id: true, name: true, roomNumber: true, _count: { select: { items: true } } }
    });

    res.json({
        success: true,
        data: {
            totalItems: items.length,
            statsByType,
            statsByStatus,
            maintenanceAlerts,
            warrantyAlerts,
            lowStockAlerts,
            labs
        }
    });
}));

/**
 * @route   GET /api/labs/items/pcs
 * @desc    Get all PCs across all labs (for group assignment dropdown)
 * @access  Private
 * @note    This route must be defined BEFORE /:id to avoid matching "items" as an id
 */
router.get('/items/pcs', authenticate, asyncHandler(async (req, res) => {
    console.log('[GET /labs/items/pcs] User schoolId:', req.user.schoolId);

    try {
        const items = await prisma.labItem.findMany({
            where: {
                schoolId: req.user.schoolId,
                itemType: 'pc',
                status: 'active'
            },
            include: {
                lab: { select: { id: true, name: true, roomNumber: true } }
            },
            orderBy: [{ lab: { name: 'asc' } }, { itemNumber: 'asc' }]
        });

        console.log('[GET /labs/items/pcs] Found PCs:', items.length);

        res.json({
            success: true,
            data: { pcs: items }
        });
    } catch (error) {
        console.error('[GET /labs/items/pcs] ERROR:', error.message);
        throw error;
    }
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
            items: { select: { itemType: true } }
        },
        orderBy: { name: 'asc' }
    });

    // Add item counts by type
    const labsWithCounts = labs.map(lab => {
        const itemCounts = {};
        lab.items.forEach(item => {
            itemCounts[item.itemType] = (itemCounts[item.itemType] || 0) + 1;
        });
        return {
            ...lab,
            items: undefined, // Remove items array from response
            itemCounts,
            totalItems: lab.items.length
        };
    });

    res.json({
        success: true,
        data: { labs: labsWithCounts }
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

    const { itemType, itemNumber, brand, modelNo, serialNo, specs, status, notes, imageUrl, purchaseDate, warrantyEnd } = req.body;

    const item = await prisma.labItem.create({
        data: {
            labId: req.params.labId,
            schoolId: req.user.schoolId,
            itemType,
            itemNumber,
            brand,
            modelNo,
            serialNo,
            specs: specs || {},
            status: status || 'active',
            notes,
            imageUrl,
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

    const { itemType, itemNumber, brand, modelNo, serialNo, specs, status, notes, imageUrl, purchaseDate, warrantyEnd } = req.body;

    const updated = await prisma.labItem.update({
        where: { id: req.params.itemId },
        data: {
            itemType,
            itemNumber,
            brand,
            modelNo,
            serialNo,
            specs,
            status,
            notes,
            imageUrl,
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

// ==================== EQUIPMENT SHIFTING ====================

/**
 * @route   POST /api/labs/shift-requests
 * @desc    Create a new equipment shift request
 * @access  Private (Admin, Lab Assistant)
 */
router.post('/shift-requests', authenticate, authorize('admin', 'principal', 'lab_assistant'), [
    body('itemId').isUUID().withMessage('Valid item ID required'),
    body('toLabId').isUUID().withMessage('Valid destination lab ID required'),
    body('reason').trim().notEmpty().withMessage('Reason for shift is required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { itemId, toLabId, reason } = req.body;

    // Get the item and its current lab
    const item = await prisma.labItem.findFirst({
        where: { id: itemId, schoolId: req.user.schoolId },
        include: { lab: { select: { id: true, name: true } } }
    });

    if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Verify destination lab exists
    const toLab = await prisma.lab.findFirst({
        where: { id: toLabId, schoolId: req.user.schoolId }
    });

    if (!toLab) {
        return res.status(404).json({ success: false, message: 'Destination lab not found' });
    }

    if (item.labId === toLabId) {
        return res.status(400).json({ success: false, message: 'Item is already in the destination lab' });
    }

    // Check for existing pending request
    const existingRequest = await prisma.equipmentShiftRequest.findFirst({
        where: { itemId, status: 'pending' }
    });

    if (existingRequest) {
        return res.status(400).json({ success: false, message: 'A pending shift request already exists for this item' });
    }

    const shiftRequest = await prisma.equipmentShiftRequest.create({
        data: {
            itemId,
            fromLabId: item.labId,
            toLabId,
            requestedById: req.user.id,
            reason
        },
        include: {
            item: { select: { id: true, itemNumber: true, itemType: true } },
            fromLab: { select: { id: true, name: true } },
            toLab: { select: { id: true, name: true } },
            requestedBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.status(201).json({
        success: true,
        message: 'Shift request created successfully',
        data: { shiftRequest }
    });
}));

/**
 * @route   GET /api/labs/shift-requests
 * @desc    Get all shift requests (with optional status filter)
 * @access  Private (Admin, Lab Assistant)
 */
router.get('/shift-requests', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const { status, labId } = req.query;
    const schoolId = req.user.schoolId;

    console.log('[GET /labs/shift-requests] schoolId:', schoolId, 'status:', status, 'labId:', labId);

    try {
        let where = {};

        if (status) {
            where.status = status;
        }

        if (labId) {
            where.OR = [{ fromLabId: labId }, { toLabId: labId }];
        }

        // Get labs for this school
        const schoolLabs = await prisma.lab.findMany({
            where: { schoolId },
            select: { id: true }
        });
        const labIds = schoolLabs.map(l => l.id);

        console.log('[GET /labs/shift-requests] Found', labIds.length, 'labs');

        // Filter by school labs
        if (!labId && labIds.length > 0) {
            where.fromLabId = { in: labIds };
        }

        const shiftRequests = await prisma.equipmentShiftRequest.findMany({
            where,
            include: {
                item: { select: { id: true, itemNumber: true, itemType: true, brand: true, modelNo: true } },
                fromLab: { select: { id: true, name: true, roomNumber: true } },
                toLab: { select: { id: true, name: true, roomNumber: true } },
                requestedBy: { select: { id: true, firstName: true, lastName: true } },
                approvedBy: { select: { id: true, firstName: true, lastName: true } }
            },
            orderBy: { requestedAt: 'desc' }
        });

        console.log('[GET /labs/shift-requests] Found', shiftRequests.length, 'requests');

        res.json({
            success: true,
            data: { shiftRequests }
        });
    } catch (error) {
        console.error('[GET /labs/shift-requests] ERROR:', error.message);
        console.error('[GET /labs/shift-requests] STACK:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to load shift requests: ' + error.message
        });
    }
}));

/**
 * @route   PUT /api/labs/shift-requests/:id/approve
 * @desc    Approve a shift request (Admin only)
 * @access  Private (Admin)
 */
router.put('/shift-requests/:id/approve', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { adminNotes } = req.body;

    const shiftRequest = await prisma.equipmentShiftRequest.findUnique({
        where: { id: req.params.id }
    });

    if (!shiftRequest) {
        return res.status(404).json({ success: false, message: 'Shift request not found' });
    }

    if (shiftRequest.status !== 'pending') {
        return res.status(400).json({ success: false, message: `Cannot approve a request with status: ${shiftRequest.status}` });
    }

    const updated = await prisma.equipmentShiftRequest.update({
        where: { id: req.params.id },
        data: {
            status: 'approved',
            approvedById: req.user.id,
            approvedAt: new Date(),
            adminNotes
        },
        include: {
            item: { select: { id: true, itemNumber: true, itemType: true } },
            fromLab: { select: { id: true, name: true } },
            toLab: { select: { id: true, name: true } },
            requestedBy: { select: { id: true, firstName: true, lastName: true } },
            approvedBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    // Send notification to requester
    await prisma.notification.create({
        data: {
            userId: shiftRequest.requestedById,
            subject: 'Shift Request Approved',
            body: `Your request to move ${updated.item.itemNumber} from ${updated.fromLab.name} to ${updated.toLab.name} has been approved. Please complete the physical move.`,
            status: 'pending'
        }
    });

    res.json({
        success: true,
        message: 'Shift request approved',
        data: { shiftRequest: updated }
    });
}));

/**
 * @route   PUT /api/labs/shift-requests/:id/reject
 * @desc    Reject a shift request (Admin only)
 * @access  Private (Admin)
 */
router.put('/shift-requests/:id/reject', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { adminNotes } = req.body;

    const shiftRequest = await prisma.equipmentShiftRequest.findUnique({
        where: { id: req.params.id }
    });

    if (!shiftRequest) {
        return res.status(404).json({ success: false, message: 'Shift request not found' });
    }

    if (shiftRequest.status !== 'pending') {
        return res.status(400).json({ success: false, message: `Cannot reject a request with status: ${shiftRequest.status}` });
    }

    const updated = await prisma.equipmentShiftRequest.update({
        where: { id: req.params.id },
        data: {
            status: 'rejected',
            approvedById: req.user.id,
            approvedAt: new Date(),
            adminNotes
        },
        include: {
            item: { select: { id: true, itemNumber: true, itemType: true } },
            fromLab: { select: { id: true, name: true } },
            toLab: { select: { id: true, name: true } }
        }
    });

    // Send notification to requester
    await prisma.notification.create({
        data: {
            userId: shiftRequest.requestedById,
            subject: 'Shift Request Rejected',
            body: `Your request to move ${updated.item.itemNumber} from ${updated.fromLab.name} to ${updated.toLab.name} has been rejected.${adminNotes ? ' Reason: ' + adminNotes : ''}`,
            status: 'pending'
        }
    });

    res.json({
        success: true,
        message: 'Shift request rejected',
        data: { shiftRequest: updated }
    });
}));

/**
 * @route   PUT /api/labs/shift-requests/:id/complete
 * @desc    Complete an approved shift request (moves the item)
 * @access  Private (Admin, Lab Assistant)
 */
router.put('/shift-requests/:id/complete', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const { notes } = req.body;

    const shiftRequest = await prisma.equipmentShiftRequest.findUnique({
        where: { id: req.params.id },
        include: {
            item: true,
            fromLab: { select: { name: true } },
            toLab: { select: { name: true } }
        }
    });

    if (!shiftRequest) {
        return res.status(404).json({ success: false, message: 'Shift request not found' });
    }

    if (shiftRequest.status !== 'approved') {
        return res.status(400).json({ success: false, message: 'Only approved requests can be completed' });
    }

    // Use transaction to ensure atomicity
    const [updatedRequest, updatedItem, history] = await prisma.$transaction([
        // Mark request as completed
        prisma.equipmentShiftRequest.update({
            where: { id: req.params.id },
            data: {
                status: 'completed',
                completedAt: new Date()
            }
        }),
        // Move the item to the new lab
        prisma.labItem.update({
            where: { id: shiftRequest.itemId },
            data: { labId: shiftRequest.toLabId }
        }),
        // Create history record
        prisma.equipmentShiftHistory.create({
            data: {
                itemId: shiftRequest.itemId,
                fromLabId: shiftRequest.fromLabId,
                toLabId: shiftRequest.toLabId,
                shiftedById: req.user.id,
                approvedById: shiftRequest.approvedById,
                shiftRequestId: shiftRequest.id,
                notes
            }
        })
    ]);

    res.json({
        success: true,
        message: `${shiftRequest.item.itemNumber} moved from ${shiftRequest.fromLab.name} to ${shiftRequest.toLab.name}`,
        data: {
            shiftRequest: updatedRequest,
            item: updatedItem,
            history
        }
    });
}));

/**
 * @route   GET /api/labs/items/:itemId/shift-history
 * @desc    Get shift history for an item
 * @access  Private
 */
router.get('/items/:itemId/shift-history', authenticate, asyncHandler(async (req, res) => {
    const { itemId } = req.params;

    // Verify item exists and belongs to school
    const item = await prisma.labItem.findFirst({
        where: { id: itemId, schoolId: req.user.schoolId }
    });

    if (!item) {
        return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const history = await prisma.equipmentShiftHistory.findMany({
        where: { itemId },
        include: {
            fromLab: { select: { id: true, name: true } },
            toLab: { select: { id: true, name: true } },
            shiftedBy: { select: { id: true, firstName: true, lastName: true } },
            approvedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { shiftedAt: 'desc' }
    });

    res.json({
        success: true,
        data: { history }
    });
}));

module.exports = router;

