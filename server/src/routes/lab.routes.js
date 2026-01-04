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
    laptop: { label: 'Laptop', specFields: ['processor', 'ram', 'storage', 'os', 'screenSize', 'battery'] },
    tablet: { label: 'Tablet', specFields: ['processor', 'ram', 'storage', 'os', 'screenSize', 'battery'] },
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
 * @route   GET /api/labs/debug-maintenance/:labId
 * @desc    Debug endpoint to test maintenance history queries (PUBLIC - NO AUTH for debugging)
 * @access  Public (TEMPORARY - for debugging only)
 */
router.get('/debug-maintenance/:labId', async (req, res) => {
    try {
        const labId = req.params.labId;
        const results = {
            labId: labId,
            prismaQuery: null,
            prismaError: null,
            rawSqlQuery: null,
            rawSqlError: null,
            tableCheck: null,
            rawSqlCount: null
        };

        // Test 1: Check if table exists and columns
        try {
            const tableInfo = await prisma.$queryRaw`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'lab_maintenance_history'
                ORDER BY ordinal_position
            `;
            results.tableCheck = tableInfo;
        } catch (e) {
            results.tableCheck = 'ERROR: ' + e.message;
        }

        // Test 2: Raw SQL count (cast to text to avoid BigInt)
        try {
            const rawCount = await prisma.$queryRaw`
                SELECT COUNT(*)::text as count FROM lab_maintenance_history WHERE lab_id = ${labId}::uuid
            `;
            results.rawSqlCount = rawCount[0]?.count || '0';
        } catch (e) {
            results.rawSqlError = 'Count failed: ' + e.message;
        }

        // Test 3: Raw SQL query with data
        try {
            const rawData = await prisma.$queryRaw`
                SELECT id::text, lab_id::text, action, reason, new_status, created_at::text 
                FROM lab_maintenance_history 
                WHERE lab_id = ${labId}::uuid
                ORDER BY id DESC
                LIMIT 10
            `;
            results.rawSqlQuery = rawData;
        } catch (e) {
            results.rawSqlError = e.message;
        }

        // Test 4: Prisma query
        try {
            const prismaData = await prisma.labMaintenanceHistory.findMany({
                where: { labId: labId },
                orderBy: { id: 'desc' },
                take: 10
            });
            results.prismaQuery = prismaData;
        } catch (e) {
            results.prismaError = e.message;
        }

        // Custom JSON serializer to handle any remaining BigInt
        const jsonString = JSON.stringify({ success: true, debug: results }, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        );
        res.setHeader('Content-Type', 'application/json');
        res.send(jsonString);
    } catch (globalError) {
        res.status(500).json({
            success: false,
            error: globalError.message,
            stack: globalError.stack
        });
    }
});

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
 * @route   GET /api/labs/maintenance-summary
 * @desc    Get maintenance summary grouped by item type and time period
 * @access  Private (Admin/Principal)
 */
router.get('/maintenance-summary', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const schoolId = req.user.schoolId;
    const { period = 'month' } = req.query; // week, month, quarter, year

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
        case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'quarter':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case 'year':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        default: // month
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get all maintenance records with item info
    const records = await prisma.itemMaintenanceHistory.findMany({
        where: {
            createdAt: { gte: startDate },
            item: { schoolId }
        },
        include: {
            item: { select: { id: true, itemType: true, itemNumber: true, lab: { select: { name: true } } } },
            recordedBy: { select: { firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Group by item type
    const byItemType = {};
    // Group by maintenance type (repair, replacement, etc.)
    const byActionType = {};
    // Total cost
    let totalCost = 0;

    records.forEach(r => {
        const itemType = r.item?.itemType || 'unknown';
        const actionType = r.type || 'other';

        if (!byItemType[itemType]) {
            byItemType[itemType] = { count: 0, cost: 0 };
        }
        byItemType[itemType].count++;
        byItemType[itemType].cost += parseFloat(r.cost || 0);

        if (!byActionType[actionType]) {
            byActionType[actionType] = { count: 0, cost: 0 };
        }
        byActionType[actionType].count++;
        byActionType[actionType].cost += parseFloat(r.cost || 0);

        totalCost += parseFloat(r.cost || 0);
    });

    // Recent records (last 10) with full timestamps
    const recentRecords = records.slice(0, 10).map(r => ({
        id: r.id,
        itemType: r.item?.itemType,
        itemNumber: r.item?.itemNumber,
        labName: r.item?.lab?.name,
        type: r.type,
        description: r.description,
        cost: r.cost,
        vendor: r.vendor,
        partName: r.partName,
        recordedBy: r.recordedBy ? `${r.recordedBy.firstName} ${r.recordedBy.lastName}` : null,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt
    }));

    res.json({
        success: true,
        data: {
            period,
            startDate,
            endDate: now,
            totalRecords: records.length,
            totalCost: totalCost.toFixed(2),
            byItemType: Object.entries(byItemType).map(([type, data]) => ({
                type,
                label: ITEM_TYPES[type]?.label || type,
                ...data,
                cost: data.cost.toFixed(2)
            })),
            byActionType: Object.entries(byActionType).map(([type, data]) => ({
                type,
                ...data,
                cost: data.cost.toFixed(2)
            })),
            recentRecords
        }
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
 * @route   GET /api/labs/items/all
 * @desc    Get all items across all labs (for barcode generator)
 * @access  Private
 */
router.get('/items/all', authenticate, asyncHandler(async (req, res) => {
    const items = await prisma.labItem.findMany({
        where: { schoolId: req.user.schoolId },
        select: {
            id: true, itemNumber: true, serialNo: true, brand: true,
            modelNo: true, itemType: true, status: true,
            lab: { select: { name: true } }
        },
        orderBy: { itemNumber: 'asc' }
    });

    res.json({
        success: true,
        data: items
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
 * @note    Must validate UUID format to avoid matching paths like /shift-requests
 */
router.get('/:id', authenticate, asyncHandler(async (req, res, next) => {
    // Skip this route if id doesn't look like a UUID (allows /shift-requests etc to match later)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id)) {
        return next();
    }

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
        where: { id: req.params.id, schoolId: req.user.schoolId },
        include: { incharge: { select: { id: true, firstName: true, lastName: true } } }
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

    // Log incharge change if it changed
    const oldInchargeId = lab.inchargeId || null;
    const newInchargeId = inchargeId || null;

    if (oldInchargeId !== newInchargeId) {
        const eventType = !oldInchargeId && newInchargeId ? 'incharge_assigned' :
            oldInchargeId && !newInchargeId ? 'incharge_removed' : 'incharge_changed';

        const oldName = lab.incharge ? `${lab.incharge.firstName} ${lab.incharge.lastName}` : null;
        const newName = updated.incharge ? `${updated.incharge.firstName} ${updated.incharge.lastName}` : null;

        await prisma.labEventHistory.create({
            data: {
                labId: lab.id,
                eventType,
                description: eventType === 'incharge_assigned' ? `Incharge assigned: ${newName}` :
                    eventType === 'incharge_removed' ? `Incharge removed: ${oldName}` :
                        `Incharge changed from ${oldName} to ${newName}`,
                oldInchargeId: oldInchargeId,
                newInchargeId: newInchargeId,
                performedById: req.user.id
            }
        });
        console.log(`[Lab Update] Logged incharge change: ${eventType}`);
    }

    res.json({
        success: true,
        message: 'Lab updated successfully',
        data: { lab: updated }
    });
}));

/**
 * @route   PUT /api/labs/:id/status
 * @desc    Update lab status (active, maintenance, closed)
 * @access  Private (Admin)
 */
router.put('/:id/status', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    console.log('[Lab Status Update] Request body:', JSON.stringify(req.body));
    console.log('[Lab Status Update] Lab ID:', req.params.id);

    const lab = await prisma.lab.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId }
    });

    if (!lab) {
        console.log('[Lab Status Update] Lab not found');
        return res.status(404).json({ success: false, message: 'Lab not found' });
    }

    console.log('[Lab Status Update] Found lab:', lab.name);

    const { status, maintenanceReason, maintenanceEndDate } = req.body;

    // Validate status
    const validStatuses = ['active', 'maintenance', 'closed'];
    if (!validStatuses.includes(status)) {
        console.log('[Lab Status Update] Invalid status:', status);
        return res.status(400).json({
            success: false,
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
    }

    try {
        const updateData = {
            status
        };

        // Only set maintenance fields if going into maintenance
        if (status === 'maintenance') {
            updateData.maintenanceReason = maintenanceReason || null;
            updateData.maintenanceStartDate = new Date();
            if (maintenanceEndDate) {
                updateData.maintenanceEndDate = new Date(maintenanceEndDate);
            }
        } else {
            // Clear maintenance fields when going active
            updateData.maintenanceReason = null;
            updateData.maintenanceStartDate = null;
            updateData.maintenanceEndDate = null;
        }

        console.log('[Lab Status Update] Update data:', JSON.stringify(updateData));

        const updated = await prisma.lab.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                subject: { select: { id: true, name: true } },
                incharge: { select: { id: true, firstName: true, lastName: true } }
            }
        });

        // Log maintenance history - handle start vs end differently
        if (status === 'maintenance') {
            // STARTING maintenance - create new record
            await prisma.labMaintenanceHistory.create({
                data: {
                    labId: lab.id,
                    action: 'started',
                    reason: maintenanceReason || null,
                    previousStatus: lab.status || 'active',
                    newStatus: 'maintenance',
                    startedAt: new Date(),
                    endedAt: null,
                    expectedEndDate: maintenanceEndDate ? new Date(maintenanceEndDate) : null,
                    performedById: req.user.id
                }
            });
            console.log('[Lab Status Update] Created new maintenance history record (started)');
        } else if (lab.status === 'maintenance' && status === 'active') {
            // ENDING maintenance - find and update existing record
            const existingRecord = await prisma.labMaintenanceHistory.findFirst({
                where: {
                    labId: lab.id,
                    action: 'started',
                    endedAt: null
                },
                orderBy: { createdAt: 'desc' }
            });

            if (existingRecord) {
                // Update existing record with end time
                await prisma.labMaintenanceHistory.update({
                    where: { id: existingRecord.id },
                    data: {
                        action: 'ended',
                        endedAt: new Date(),
                        newStatus: 'active'
                    }
                });
                console.log('[Lab Status Update] Updated existing maintenance record (ended):', existingRecord.id);
            } else {
                // Fallback: create new record if no existing one found
                await prisma.labMaintenanceHistory.create({
                    data: {
                        labId: lab.id,
                        action: 'ended',
                        reason: lab.maintenanceReason || null,
                        previousStatus: 'maintenance',
                        newStatus: 'active',
                        startedAt: lab.maintenanceStartDate || null,
                        endedAt: new Date(),
                        expectedEndDate: lab.maintenanceEndDate || null,
                        performedById: req.user.id
                    }
                });
                console.log('[Lab Status Update] Created new maintenance record (ended) - no existing record found');
            }
        }

        console.log('[Lab Status Update] Success! New status:', updated.status);

        res.json({
            success: true,
            message: status === 'maintenance'
                ? `Lab set to maintenance mode: ${maintenanceReason || 'No reason provided'}`
                : `Lab status updated to ${status}`,
            data: { lab: updated }
        });
    } catch (error) {
        console.error('[Lab Status Update] ERROR:', error.message);
        console.error('[Lab Status Update] Full error:', error);
        throw error;
    }
}));

/**
 * @route   GET /api/labs/:id/maintenance-history
 * @desc    Get maintenance history for a lab
 * @access  Private (Admin/Principal/Lab Assistant)
 */
router.get('/:id/maintenance-history', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const labId = req.params.id;
    console.log('[Maintenance History] Fetching for labId:', labId);

    const history = await prisma.labMaintenanceHistory.findMany({
        where: { labId: labId },
        include: {
            performedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' }
        ]
    });

    console.log('[Maintenance History] Found', history.length, 'records');
    res.json({ success: true, data: { history } });
}));

/**
 * @route   GET /api/labs/:id/event-history
 * @desc    Get comprehensive event history for a lab (inventory additions, incharge changes, procurement items)
 * @access  Private (Admin/Principal/Lab Assistant)
 */
router.get('/:id/event-history', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const labId = req.params.id;
    const { eventType, limit = 50 } = req.query;
    console.log('[Event History] Fetching for labId:', labId, 'eventType:', eventType);

    const where = { labId };
    if (eventType) {
        where.eventType = eventType;
    }

    const history = await prisma.labEventHistory.findMany({
        where,
        include: {
            item: { select: { id: true, itemNumber: true, itemType: true, brand: true } },
            oldIncharge: { select: { id: true, firstName: true, lastName: true } },
            newIncharge: { select: { id: true, firstName: true, lastName: true } },
            procurementRequest: { select: { id: true, title: true, poNumber: true } },
            procurementItem: { select: { id: true, itemName: true, quantity: true } },
            performedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
    });

    console.log('[Event History] Found', history.length, 'records');
    res.json({ success: true, data: { history } });
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

    // Log item addition event
    await prisma.labEventHistory.create({
        data: {
            labId: req.params.labId,
            eventType: 'item_added',
            description: `Added ${ITEM_TYPES[itemType]?.label || itemType}: ${itemNumber}`,
            itemId: item.id,
            itemDetails: {
                itemType,
                itemNumber,
                brand,
                modelNo,
                serialNo,
                quantity: 1
            },
            performedById: req.user.id
        }
    });
    console.log(`[Lab Items] Logged item addition: ${itemNumber}`);

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

    // Check if PC is already assigned to another group in the same class
    const existingAssignment = await prisma.studentGroup.findFirst({
        where: {
            assignedPcId: pcId,
            classId: group.classId,
            id: { not: req.params.groupId } // Exclude current group
        }
    });

    if (existingAssignment) {
        return res.status(400).json({
            success: false,
            message: `PC ${pc.itemNumber} is already assigned to group "${existingAssignment.name}" in this class`
        });
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
            title: 'Shift Request Approved',
            message: `Your request to move ${updated.item.itemNumber} from ${updated.fromLab.name} to ${updated.toLab.name} has been approved. Please complete the physical move.`,
            is_read: false
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
            title: 'Shift Request Rejected',
            message: `Your request to move ${updated.item.itemNumber} from ${updated.fromLab.name} to ${updated.toLab.name} has been rejected.${adminNotes ? ' Reason: ' + adminNotes : ''}`,
            is_read: false
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

// ==================== LAPTOP ISSUANCE ====================

/**
 * Generate voucher number
 */
async function generateVoucherNumber(prisma) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.laptopIssuance.count();
    return `LV-${dateStr}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * @route   GET /api/labs/laptop-issuances
 * @desc    Get all laptop issuances
 * @access  Private (Admin, Lab Assistant)
 */
router.get('/laptop-issuances', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const { status, laptopId, issuedToId } = req.query;
    const where = { schoolId: req.user.schoolId };

    if (status) where.status = status;
    if (laptopId) where.laptopId = laptopId;
    if (issuedToId) where.issuedToId = issuedToId;

    const issuances = await prisma.laptopIssuance.findMany({
        where,
        include: {
            laptop: { select: { id: true, itemNumber: true, brand: true, modelNo: true, serialNo: true } },
            issuedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
            issuedBy: { select: { id: true, firstName: true, lastName: true } },
            receivedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { issuedAt: 'desc' }
    });

    res.json({
        success: true,
        data: { issuances }
    });
}));

/**
 * @route   GET /api/labs/laptops/available
 * @desc    Get laptops available for issuance (not currently issued)
 * @access  Private (Admin, Lab Assistant)
 */
router.get('/laptops/available', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    try {
        // Get all laptops
        const laptops = await prisma.labItem.findMany({
            where: {
                schoolId: req.user.schoolId,
                itemType: 'laptop',
                status: 'active'
            },
            include: {
                lab: { select: { id: true, name: true } }
            }
        });

        // Try to get issued laptops (table may not exist yet)
        let issuedLaptopIds = [];
        try {
            const issuedLaptops = await prisma.laptopIssuance.findMany({
                where: { schoolId: req.user.schoolId, status: 'issued' },
                select: { laptopId: true }
            });
            issuedLaptopIds = issuedLaptops.map(i => i.laptopId);
        } catch (e) {
            // Table doesn't exist yet - all laptops are available
            console.log('laptop_issuances table not found, returning all laptops');
        }

        // Filter out laptops that are currently issued
        const availableLaptops = laptops.filter(l => !issuedLaptopIds.includes(l.id));

        res.json({
            success: true,
            data: { laptops: availableLaptops }
        });
    } catch (error) {
        console.error('Get available laptops error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to load laptops',
            error: error.message
        });
    }
}));

/**
 * @route   GET /api/labs/staff-members
 * @desc    Get staff members who can receive laptops
 * @access  Private (Admin, Lab Assistant)
 */
router.get('/staff-members', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const staffRoles = ['admin', 'principal', 'instructor', 'lab_assistant'];

    const staff = await prisma.user.findMany({
        where: {
            schoolId: req.user.schoolId,
            role: { in: staffRoles },
            isActive: true
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true
        },
        orderBy: [{ role: 'asc' }, { firstName: 'asc' }]
    });

    res.json({
        success: true,
        data: { staff }
    });
}));

/**
 * @route   POST /api/labs/laptop-issuances
 * @desc    Issue a laptop to a staff member
 * @access  Private (Admin, Lab Assistant)
 */
router.post('/laptop-issuances', authenticate, authorize('admin', 'principal', 'lab_assistant'), [
    body('laptopId').notEmpty().withMessage('Laptop ID required'),
    body('issuedToId').notEmpty().withMessage('Staff member ID required'),
    body('purpose').optional().isString(),
    body('expectedReturnDate').optional().isISO8601(),
    body('conditionOnIssue').optional().isString()
], asyncHandler(async (req, res) => {
    console.log('[POST /laptop-issuances] Request body:', JSON.stringify(req.body, null, 2));
    console.log('[POST /laptop-issuances] User:', req.user.id, 'School:', req.user.schoolId);

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('[POST /laptop-issuances] Validation errors:', errors.array());
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { laptopId, issuedToId, purpose, expectedReturnDate, conditionOnIssue, remarks } = req.body;
        console.log('[POST /laptop-issuances] Parsed data - laptopId:', laptopId, 'issuedToId:', issuedToId);

        // Verify laptop exists and is type laptop
        const laptop = await prisma.labItem.findFirst({
            where: { id: laptopId, schoolId: req.user.schoolId, itemType: 'laptop' }
        });
        console.log('[POST /laptop-issuances] Found laptop:', laptop ? laptop.itemNumber : 'NOT FOUND');

        if (!laptop) {
            return res.status(404).json({ success: false, message: 'Laptop not found or not of type laptop' });
        }

        // Check if laptop is already issued
        let existingIssuance = null;
        try {
            existingIssuance = await prisma.laptopIssuance.findFirst({
                where: { laptopId, status: 'issued' }
            });
            console.log('[POST /laptop-issuances] Existing issuance check:', existingIssuance ? 'ALREADY ISSUED' : 'Available');
        } catch (e) {
            console.error('[POST /laptop-issuances] laptop_issuances table error:', e.message);
            console.error('[POST /laptop-issuances] Full error:', e);
            return res.status(500).json({
                success: false,
                message: `Database error: ${e.message}. Have you run laptop_issuance_migration.sql?`
            });
        }

        if (existingIssuance) {
            return res.status(400).json({ success: false, message: 'This laptop is already issued' });
        }

        // Verify staff member exists
        const staffMember = await prisma.user.findFirst({
            where: { id: issuedToId, schoolId: req.user.schoolId }
        });
        console.log('[POST /laptop-issuances] Found staff member:', staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : 'NOT FOUND');

        if (!staffMember) {
            return res.status(404).json({ success: false, message: 'Staff member not found' });
        }

        // Build component status from individual fields
        const { screenStatus, keyboardStatus, touchpadStatus, batteryStatus, portsStatus, chargerStatus } = req.body;
        const componentStatus = {
            screen: screenStatus || 'working',
            keyboard: keyboardStatus || 'working',
            touchpad: touchpadStatus || 'working',
            battery: batteryStatus || 'working',
            ports: portsStatus || 'working',
            charger: chargerStatus || 'working'
        };

        const voucherNumber = await generateVoucherNumber(prisma);
        console.log('[POST /laptop-issuances] Generated voucher:', voucherNumber);

        const createData = {
            laptopId,
            issuedToId,
            issuedById: req.user.id,
            voucherNumber,
            purpose,
            expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
            conditionOnIssue: conditionOnIssue || 'good',
            componentStatus,
            remarks,
            status: 'issued',
            schoolId: req.user.schoolId
        };
        console.log('[POST /laptop-issuances] Create data:', JSON.stringify(createData, null, 2));

        const issuance = await prisma.laptopIssuance.create({
            data: createData,
            include: {
                laptop: { select: { id: true, itemNumber: true, brand: true, modelNo: true, serialNo: true } },
                issuedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
                issuedBy: { select: { id: true, firstName: true, lastName: true } }
            }
        });
        console.log('[POST /laptop-issuances] Created issuance:', issuance.id, 'Voucher:', issuance.voucherNumber);

        res.status(201).json({
            success: true,
            message: `Laptop ${laptop.itemNumber} issued to ${staffMember.firstName} ${staffMember.lastName}. Voucher: ${issuance.voucherNumber}`,
            data: { issuance }
        });
    } catch (error) {
        console.error('[POST /laptop-issuances] ERROR:', error.message);
        console.error('[POST /laptop-issuances] Error code:', error.code);
        console.error('[POST /laptop-issuances] Error meta:', error.meta);
        console.error('[POST /laptop-issuances] Full error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to issue laptop',
            error: error.message,
            code: error.code,
            meta: error.meta
        });
    }
}));

/**
 * @route   PUT /api/labs/laptop-issuances/:id/return
 * @desc    Mark a laptop as returned
 * @access  Private (Admin, Lab Assistant)
 */
router.put('/laptop-issuances/:id/return', authenticate, authorize('admin', 'principal', 'lab_assistant'), [
    body('conditionOnReturn').optional().isString(),
    body('returnRemarks').optional().isString()
], asyncHandler(async (req, res) => {
    const { conditionOnReturn, returnRemarks } = req.body;

    const issuance = await prisma.laptopIssuance.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId }
    });

    if (!issuance) {
        return res.status(404).json({ success: false, message: 'Issuance record not found' });
    }

    if (issuance.status !== 'issued') {
        return res.status(400).json({ success: false, message: 'Laptop is not currently issued' });
    }

    const updated = await prisma.laptopIssuance.update({
        where: { id: req.params.id },
        data: {
            status: 'returned',
            returnedAt: new Date(),
            receivedById: req.user.id,
            conditionOnReturn: conditionOnReturn || 'good',
            returnRemarks
        },
        include: {
            laptop: { select: { id: true, itemNumber: true, brand: true } },
            issuedTo: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.json({
        success: true,
        message: `Laptop ${updated.laptop.itemNumber} returned successfully`,
        data: { issuance: updated }
    });
}));

/**
 * @route   GET /api/labs/laptop-issuances/:id/voucher
 * @desc    Get voucher details for printing/sharing
 * @access  Private (Admin, Lab Assistant)
 */
router.get('/laptop-issuances/:id/voucher', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    try {
        const issuance = await prisma.laptopIssuance.findFirst({
            where: { id: req.params.id, schoolId: req.user.schoolId }
        });

        if (!issuance) {
            return res.status(404).json({ success: false, message: 'Issuance record not found' });
        }

        // Fetch related data separately to avoid Prisma include issues
        const [laptop, issuedTo, issuedBy, receivedBy, school] = await Promise.all([
            prisma.labItem.findUnique({
                where: { id: issuance.laptopId },
                select: { id: true, itemNumber: true, brand: true, modelNo: true, serialNo: true, specs: true }
            }),
            prisma.user.findUnique({
                where: { id: issuance.issuedToId },
                select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true }
            }),
            prisma.user.findUnique({
                where: { id: issuance.issuedById },
                select: { id: true, firstName: true, lastName: true, role: true }
            }),
            issuance.receivedById ? prisma.user.findUnique({
                where: { id: issuance.receivedById },
                select: { id: true, firstName: true, lastName: true }
            }) : null,
            prisma.school.findUnique({
                where: { id: issuance.schoolId },
                select: { name: true, address: true }
            })
        ]);

        res.json({
            success: true,
            data: {
                voucher: {
                    ...issuance,
                    laptop,
                    issuedTo,
                    issuedBy,
                    receivedBy,
                    school
                }
            }
        });
    } catch (error) {
        console.error('Get voucher error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to load voucher',
            error: error.message
        });
    }
}));

module.exports = router;

