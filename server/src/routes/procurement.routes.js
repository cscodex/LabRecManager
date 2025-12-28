const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================================
// VENDOR MANAGEMENT
// ============================================================

/**
 * @route   GET /api/procurement/vendors
 * @desc    Get all vendors
 */
router.get('/vendors', authenticate, asyncHandler(async (req, res) => {
    const vendors = await prisma.vendor.findMany({
        where: { schoolId: req.user.schoolId },
        orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: vendors });
}));

/**
 * @route   POST /api/procurement/vendors
 * @desc    Create a vendor
 */
router.post('/vendors', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { name, contactPerson, email, phone, address, gstin } = req.body;
    const vendor = await prisma.vendor.create({
        data: { name, contactPerson, email, phone, address, gstin, schoolId: req.user.schoolId }
    });
    res.status(201).json({ success: true, data: vendor, message: 'Vendor created' });
}));

/**
 * @route   PUT /api/procurement/vendors/:id
 * @desc    Update a vendor
 */
router.put('/vendors/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { name, contactPerson, email, phone, address, gstin } = req.body;
    const vendor = await prisma.vendor.update({
        where: { id: req.params.id },
        data: { name, contactPerson, email, phone, address, gstin }
    });
    res.json({ success: true, data: vendor, message: 'Vendor updated' });
}));

/**
 * @route   DELETE /api/procurement/vendors/:id
 * @desc    Delete a vendor
 */
router.delete('/vendors/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    await prisma.vendor.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Vendor deleted' });
}));

// ============================================================
// PROCUREMENT REQUESTS
// ============================================================

/**
 * @route   GET /api/procurement/requests
 * @desc    Get all procurement requests
 */
router.get('/requests', authenticate, asyncHandler(async (req, res) => {
    const { status } = req.query;
    const where = { schoolId: req.user.schoolId };
    if (status) where.status = status;

    const requests = await prisma.procurementRequest.findMany({
        where,
        include: {
            createdBy: { select: { firstName: true, lastName: true } },
            approvedBy: { select: { firstName: true, lastName: true } },
            items: { select: { id: true, itemName: true, quantity: true, estimatedUnitPrice: true } },
            quotations: { select: { id: true, vendorId: true, totalAmount: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: requests });
}));

/**
 * @route   GET /api/procurement/requests/:id
 * @desc    Get procurement request with full details and comparison
 */
router.get('/requests/:id', authenticate, asyncHandler(async (req, res) => {
    const request = await prisma.procurementRequest.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId },
        include: {
            createdBy: { select: { firstName: true, lastName: true, email: true } },
            approvedBy: { select: { firstName: true, lastName: true } },
            items: {
                include: {
                    approvedVendor: { select: { name: true } },
                    quotationItems: {
                        include: {
                            quotation: {
                                include: { vendor: { select: { id: true, name: true } } }
                            }
                        }
                    }
                }
            },
            quotations: {
                include: {
                    vendor: { select: { id: true, name: true, email: true, phone: true } },
                    items: true
                }
            }
        }
    });

    if (!request) {
        return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Build comparison matrix
    const comparison = request.items.map(item => {
        const vendorPrices = {};
        let lowestPrice = Infinity;
        let lowestVendorId = null;

        item.quotationItems.forEach(qi => {
            const vendorId = qi.quotation.vendor.id;
            const vendorName = qi.quotation.vendor.name;
            const price = parseFloat(qi.unitPrice);
            vendorPrices[vendorId] = { vendorName, unitPrice: price, quotationItemId: qi.id };
            if (price < lowestPrice) {
                lowestPrice = price;
                lowestVendorId = vendorId;
            }
        });

        return {
            itemId: item.id,
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            specifications: item.specifications,
            vendorPrices,
            lowestVendorId,
            lowestPrice: lowestPrice === Infinity ? null : lowestPrice,
            approvedVendorId: item.approvedVendorId,
            approvedUnitPrice: item.approvedUnitPrice
        };
    });

    res.json({ success: true, data: { request, comparison } });
}));

/**
 * @route   POST /api/procurement/requests
 * @desc    Create procurement request with items
 */
router.post('/requests', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const { title, description, purpose, department, budgetCode, items } = req.body;

    const request = await prisma.procurementRequest.create({
        data: {
            title,
            description,
            purpose,
            department,
            budgetCode,
            status: 'draft',
            createdById: req.user.id,
            schoolId: req.user.schoolId,
            items: {
                create: items?.map(item => ({
                    itemName: item.itemName,
                    description: item.description,
                    specifications: item.specifications,
                    quantity: item.quantity || 1,
                    unit: item.unit || 'pcs',
                    estimatedUnitPrice: item.estimatedUnitPrice
                })) || []
            }
        },
        include: { items: true }
    });

    res.status(201).json({ success: true, data: request, message: 'Procurement request created' });
}));

/**
 * @route   PUT /api/procurement/requests/:id
 * @desc    Update procurement request
 */
router.put('/requests/:id', authenticate, asyncHandler(async (req, res) => {
    const { title, description, purpose, department, budgetCode, status } = req.body;

    const request = await prisma.procurementRequest.update({
        where: { id: req.params.id },
        data: { title, description, purpose, department, budgetCode, status }
    });

    res.json({ success: true, data: request, message: 'Request updated' });
}));

/**
 * @route   POST /api/procurement/requests/:id/items
 * @desc    Add item to procurement request
 */
router.post('/requests/:id/items', authenticate, asyncHandler(async (req, res) => {
    const { itemName, description, specifications, quantity, unit, estimatedUnitPrice } = req.body;

    const item = await prisma.procurementItem.create({
        data: {
            requestId: req.params.id,
            itemName,
            description,
            specifications,
            quantity: quantity || 1,
            unit: unit || 'pcs',
            estimatedUnitPrice
        }
    });

    res.status(201).json({ success: true, data: item, message: 'Item added' });
}));

/**
 * @route   DELETE /api/procurement/requests/:id/items/:itemId
 * @desc    Remove item from procurement request
 */
router.delete('/requests/:id/items/:itemId', authenticate, asyncHandler(async (req, res) => {
    await prisma.procurementItem.delete({ where: { id: req.params.itemId } });
    res.json({ success: true, message: 'Item removed' });
}));

// ============================================================
// VENDOR QUOTATIONS
// ============================================================

/**
 * @route   POST /api/procurement/requests/:id/quotations
 * @desc    Add vendor quotation with item prices
 */
router.post('/requests/:id/quotations', authenticate, asyncHandler(async (req, res) => {
    const { vendorId, quotationNumber, quotationDate, validUntil, documentUrl, terms, remarks, items } = req.body;

    // Calculate total
    let totalAmount = 0;
    if (items) {
        items.forEach(item => {
            totalAmount += (parseFloat(item.unitPrice) || 0) * (item.quantity || 1);
        });
    }

    const quotation = await prisma.vendorQuotation.create({
        data: {
            requestId: req.params.id,
            vendorId,
            quotationNumber,
            quotationDate: quotationDate ? new Date(quotationDate) : null,
            validUntil: validUntil ? new Date(validUntil) : null,
            documentUrl,
            totalAmount,
            terms,
            remarks,
            items: {
                create: items?.map(item => ({
                    procurementItemId: item.procurementItemId,
                    unitPrice: item.unitPrice,
                    quantity: item.quantity,
                    totalPrice: (parseFloat(item.unitPrice) || 0) * (item.quantity || 1),
                    remarks: item.remarks
                })) || []
            }
        },
        include: { vendor: { select: { name: true } }, items: true }
    });

    // Update request status
    await prisma.procurementRequest.update({
        where: { id: req.params.id },
        data: { status: 'quotes_received' }
    });

    res.status(201).json({ success: true, data: quotation, message: 'Quotation added' });
}));

/**
 * @route   POST /api/procurement/requests/:id/approve
 * @desc    Approve procurement with selected vendors and quantities
 */
router.post('/requests/:id/approve', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { approvedItems } = req.body; // [{itemId, vendorId, unitPrice, quantity}]

    let approvedTotal = 0;

    for (const item of approvedItems) {
        await prisma.procurementItem.update({
            where: { id: item.itemId },
            data: {
                approvedVendorId: item.vendorId,
                approvedUnitPrice: item.unitPrice,
                quantity: item.quantity
            }
        });
        approvedTotal += (parseFloat(item.unitPrice) || 0) * (item.quantity || 0);
    }

    const request = await prisma.procurementRequest.update({
        where: { id: req.params.id },
        data: {
            status: 'approved',
            approvedById: req.user.id,
            approvedAt: new Date(),
            approvedTotal
        }
    });

    res.json({ success: true, data: request, message: 'Procurement approved' });
}));

/**
 * @route   GET /api/procurement/requests/:id/print
 * @desc    Get data for printable comparative statement
 */
router.get('/requests/:id/print', authenticate, asyncHandler(async (req, res) => {
    const request = await prisma.procurementRequest.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId },
        include: {
            createdBy: { select: { firstName: true, lastName: true } },
            approvedBy: { select: { firstName: true, lastName: true } },
            items: {
                include: {
                    approvedVendor: true,
                    quotationItems: {
                        include: {
                            quotation: { include: { vendor: true } }
                        }
                    }
                }
            },
            quotations: { include: { vendor: true } }
        }
    });

    if (!request) {
        return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Get unique vendors
    const vendors = request.quotations.map(q => q.vendor);

    res.json({ success: true, data: { request, vendors } });
}));

// ============================================================
// COMMITTEE MANAGEMENT
// ============================================================

/**
 * @route   GET /api/procurement/staff
 * @desc    Get staff members for committee selection
 */
router.get('/staff', authenticate, asyncHandler(async (req, res) => {
    const staff = await prisma.user.findMany({
        where: {
            schoolId: req.user.schoolId,
            role: { in: ['admin', 'principal', 'teacher', 'lab_assistant', 'instructor'] }
        },
        select: { id: true, firstName: true, lastName: true, role: true, email: true }
    });
    res.json({ success: true, data: staff });
}));

/**
 * @route   POST /api/procurement/requests/:id/committee
 * @desc    Add committee member to procurement
 */
router.post('/requests/:id/committee', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { userId, role, designation } = req.body;

    // Check committee size (max 5)
    const existingCount = await prisma.procurementCommittee.count({
        where: { requestId: req.params.id }
    });
    if (existingCount >= 5) {
        return res.status(400).json({ success: false, message: 'Maximum 5 committee members allowed' });
    }

    const member = await prisma.procurementCommittee.create({
        data: {
            requestId: req.params.id,
            userId,
            role: role || 'member',
            designation
        },
        include: { user: { select: { firstName: true, lastName: true, role: true } } }
    });

    res.status(201).json({ success: true, data: member, message: 'Committee member added' });
}));

/**
 * @route   DELETE /api/procurement/requests/:id/committee/:memberId
 * @desc    Remove committee member
 */
router.delete('/requests/:id/committee/:memberId', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    await prisma.procurementCommittee.delete({ where: { id: req.params.memberId } });
    res.json({ success: true, message: 'Committee member removed' });
}));

// ============================================================
// COMBINED PDF PREVIEW DATA
// ============================================================

/**
 * @route   GET /api/procurement/requests/:id/preview
 * @desc    Get all data for combined PDF preview
 */
router.get('/requests/:id/preview', authenticate, asyncHandler(async (req, res) => {
    // Get school with letterhead
    const school = await prisma.school.findFirst({
        where: { id: req.user.schoolId },
        select: { name: true, address: true, letterheadUrl: true, logoUrl: true }
    });

    // Get request with all details
    const request = await prisma.procurementRequest.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId },
        include: {
            createdBy: { select: { firstName: true, lastName: true } },
            approvedBy: { select: { firstName: true, lastName: true } },
            committee: {
                include: { user: { select: { firstName: true, lastName: true, role: true } } }
            },
            items: {
                include: {
                    approvedVendor: { select: { name: true } },
                    quotationItems: {
                        include: {
                            quotation: { include: { vendor: { select: { id: true, name: true } } } }
                        }
                    }
                }
            },
            quotations: {
                include: {
                    vendor: { select: { id: true, name: true, contactPerson: true, email: true, phone: true, address: true, gstin: true } }
                }
            }
        }
    });

    if (!request) {
        return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Build comparison matrix
    const comparison = request.items.map(item => {
        const vendorPrices = {};
        let lowestPrice = Infinity;
        let lowestVendorId = null;

        item.quotationItems.forEach(qi => {
            const vendorId = qi.quotation.vendor.id;
            const vendorName = qi.quotation.vendor.name;
            const price = parseFloat(qi.unitPrice);
            vendorPrices[vendorId] = { vendorName, unitPrice: price };
            if (price < lowestPrice) {
                lowestPrice = price;
                lowestVendorId = vendorId;
            }
        });

        return {
            itemId: item.id,
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            specifications: item.specifications,
            vendorPrices,
            lowestVendorId,
            lowestPrice: lowestPrice === Infinity ? null : lowestPrice,
            approvedVendorId: item.approvedVendorId,
            approvedUnitPrice: parseFloat(item.approvedUnitPrice) || null
        };
    });

    // Calculate totals
    const totalApproved = request.items.reduce((sum, item) => {
        return sum + ((parseFloat(item.approvedUnitPrice) || 0) * item.quantity);
    }, 0);

    const vendors = request.quotations.map(q => q.vendor);

    res.json({
        success: true,
        data: {
            school,
            request,
            comparison,
            vendors,
            totalApproved,
            committee: request.committee
        }
    });
}));

// ============================================================
// PROCUREMENT FLOW STAGES
// ============================================================

/**
 * @route   PUT /api/procurement/requests/:id/order
 * @desc    Mark as ordered with PO details
 */
router.put('/requests/:id/order', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { poNumber, poUrl } = req.body;

    const request = await prisma.procurementRequest.update({
        where: { id: req.params.id },
        data: {
            status: 'ordered',
            orderedAt: new Date(),
            poNumber,
            poUrl
        }
    });

    res.json({ success: true, data: request, message: 'Marked as ordered' });
}));

/**
 * @route   PUT /api/procurement/requests/:id/bill
 * @desc    Add bill details from vendor
 */
router.put('/requests/:id/bill', authenticate, asyncHandler(async (req, res) => {
    const { billNumber, billDate, billAmount, billUrl } = req.body;

    const request = await prisma.procurementRequest.update({
        where: { id: req.params.id },
        data: {
            status: 'billed',
            billNumber,
            billDate: billDate ? new Date(billDate) : null,
            billAmount,
            billUrl
        }
    });

    res.json({ success: true, data: request, message: 'Bill added' });
}));

/**
 * @route   PUT /api/procurement/requests/:id/payment
 * @desc    Add payment details
 */
router.put('/requests/:id/payment', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { paymentMethod, chequeNumber, chequeUrl, paymentDate, paymentReference } = req.body;

    const request = await prisma.procurementRequest.update({
        where: { id: req.params.id },
        data: {
            status: 'paid',
            paymentMethod,
            chequeNumber,
            chequeUrl,
            paymentDate: paymentDate ? new Date(paymentDate) : null,
            paymentReference
        }
    });

    res.json({ success: true, data: request, message: 'Payment recorded' });
}));

/**
 * @route   PUT /api/procurement/requests/:id/receive
 * @desc    Mark items as received with optional video
 */
router.put('/requests/:id/receive', authenticate, asyncHandler(async (req, res) => {
    const { receivingVideoUrl, receivingNotes } = req.body;

    const request = await prisma.procurementRequest.update({
        where: { id: req.params.id },
        data: {
            status: 'received',
            receivedAt: new Date(),
            receivedById: req.user.id,
            receivingVideoUrl,
            receivingNotes
        }
    });

    res.json({ success: true, data: request, message: 'Marked as received' });
}));

/**
 * @route   POST /api/procurement/requests/:id/items/:itemId/receive
 * @desc    Receive individual item and optionally create inventory entry
 */
router.post('/requests/:id/items/:itemId/receive', authenticate, asyncHandler(async (req, res) => {
    const { receivedQty, addToInventory, labId, serialNo, barcode } = req.body;

    let inventoryItemId = null;

    // Get the procurement item
    const procItem = await prisma.procurementItem.findFirst({
        where: { id: req.params.itemId, requestId: req.params.id },
        include: { request: true }
    });

    if (!procItem) {
        return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Create inventory item if requested
    if (addToInventory && labId) {
        const inventoryItem = await prisma.labItem.create({
            data: {
                labId,
                schoolId: procItem.request.schoolId,
                itemType: procItem.itemName.toLowerCase().includes('chair') ? 'chair' :
                    procItem.itemName.toLowerCase().includes('table') ? 'table' :
                        procItem.itemName.toLowerCase().includes('pc') ? 'pc' : 'other',
                itemNumber: barcode || serialNo || `PROC-${procItem.id.substring(0, 8)}`,
                serialNo: serialNo || barcode,
                brand: procItem.specifications?.split(' ')[0] || null,
                status: 'active',
                notes: `Added from procurement: ${procItem.request.title}`,
                purchaseDate: new Date(),
                quantity: receivedQty || procItem.quantity
            }
        });
        inventoryItemId = inventoryItem.id;
    }

    // Update procurement item
    const item = await prisma.procurementItem.update({
        where: { id: req.params.itemId },
        data: {
            isReceived: true,
            receivedQty: receivedQty || procItem.quantity,
            inventoryItemId
        }
    });

    // Check if all items received
    const allItems = await prisma.procurementItem.findMany({
        where: { requestId: req.params.id }
    });
    const allReceived = allItems.every(i => i.isReceived);

    if (allReceived) {
        await prisma.procurementRequest.update({
            where: { id: req.params.id },
            data: { status: 'completed' }
        });
    }

    res.json({
        success: true,
        data: { item, inventoryItemId },
        message: addToInventory ? 'Item received and added to inventory' : 'Item received'
    });
}));

/**
 * @route   GET /api/procurement/labs
 * @desc    Get labs for inventory destination selection
 */
router.get('/labs', authenticate, asyncHandler(async (req, res) => {
    const labs = await prisma.lab.findMany({
        where: { schoolId: req.user.schoolId },
        select: { id: true, name: true, roomNumber: true }
    });
    res.json({ success: true, data: labs });
}));

module.exports = router;

