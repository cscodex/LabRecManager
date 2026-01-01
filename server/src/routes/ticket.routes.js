const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');

/**
 * Generate unique ticket number (TKT-000001 format)
 */
async function generateTicketNumber() {
    const count = await prisma.ticket.count();
    return `TKT-${String(count + 1).padStart(6, '0')}`;
}

/**
 * @route   GET /api/tickets/issue-types
 * @desc    Get all issue types (optionally filtered by category)
 * @access  Private
 */
router.get('/issue-types', authenticate, asyncHandler(async (req, res) => {
    const { category } = req.query;
    const where = { isActive: true };

    if (category) {
        where.category = category;
    }

    const issueTypes = await prisma.ticketIssueType.findMany({
        where,
        orderBy: [
            { category: 'asc' },
            { displayOrder: 'asc' }
        ]
    });

    // Group by category for easier frontend use
    const grouped = issueTypes.reduce((acc, type) => {
        if (!acc[type.category]) acc[type.category] = [];
        acc[type.category].push(type);
        return acc;
    }, {});

    res.json({
        success: true,
        data: {
            issueTypes,
            byCategory: grouped
        }
    });
}));

/**
 * @route   POST /api/tickets
 * @desc    Create a new ticket
 * @access  Private (Any authenticated user)
 */
router.post('/', authenticate, [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('category').optional().isIn(['hardware_issue', 'software_issue', 'maintenance_request', 'general_complaint', 'other']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('itemId').optional().matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('Invalid item ID format'),
    body('labId').optional().matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('Invalid lab ID format'),
    body('issueTypeId').optional().matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('Invalid issue type ID format')
], asyncHandler(async (req, res) => {
    console.log('=== POST /api/tickets - Create Ticket ===');
    console.log('User:', req.user?.email, 'Role:', req.user?.role, 'ID:', req.user?.id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, category, priority, itemId, labId, issueTypeId } = req.body;

    console.log('Parsed values:', { title, description, category, priority, itemId, labId, issueTypeId });

    try {
        const ticketNumber = await generateTicketNumber();
        console.log('Generated ticket number:', ticketNumber);

        const ticketData = {
            ticketNumber,
            title,
            description,
            category: category || 'other',
            priority: priority || 'medium',
            status: 'open',
            itemId: itemId || null,
            labId: labId || null,
            issueTypeId: issueTypeId || null,
            createdById: req.user.id
        };
        console.log('Ticket data to create:', JSON.stringify(ticketData, null, 2));

        const ticket = await prisma.ticket.create({
            data: ticketData,
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
                item: { select: { id: true, itemNumber: true, itemType: true } },
                lab: { select: { id: true, name: true } },
                issueType: { select: { id: true, name: true, category: true } }
            }
        });

        console.log('Ticket created successfully:', ticket.id, ticket.ticketNumber);

        res.status(201).json({
            success: true,
            message: `Ticket ${ticket.ticketNumber} created successfully`,
            data: { ticket }
        });

        // Notify admins about new ticket (after response)
        try {
            const timestamp = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
            await notificationService.notifyAdmins({
                title: `New Ticket: ${ticket.ticketNumber}`,
                message: `${ticket.createdBy.firstName} ${ticket.createdBy.lastName} (${ticket.createdBy.role}) created ticket "${ticket.title}" at ${timestamp}`,
                type: 'ticket_created',
                referenceType: 'ticket',
                referenceId: ticket.id,
                actionUrl: '/tickets'
            });
        } catch (notifyError) {
            console.warn('Failed to send ticket creation notification:', notifyError.message);
        }
    } catch (error) {
        console.error('=== ERROR creating ticket ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error stack:', error.stack);
        throw error;
    }
}));

/**
 * @route   GET /api/tickets
 * @desc    Get all tickets (with filters)
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { status, priority, category, labId, myTickets, page = 1, limit = 20 } = req.query;
    const where = {};

    // Filter by status
    if (status && status !== 'all') {
        where.status = status;
    }

    // Filter by priority
    if (priority) {
        where.priority = priority;
    }

    // Filter by category
    if (category) {
        where.category = category;
    }

    // Filter by lab
    if (labId) {
        where.labId = labId;
    }

    // Filter to show only user's tickets
    if (myTickets === 'true') {
        where.createdById = req.user.id;
    }

    // Role-based filtering
    const userRole = req.user.role;
    if (userRole === 'student') {
        // Students can only see their own tickets
        where.createdById = req.user.id;
    } else if (userRole === 'instructor') {
        // Instructors see their tickets and tickets from their classes (TODO: enhance)
        where.OR = [
            { createdById: req.user.id },
            { assignedToId: req.user.id }
        ];
    }
    // Admins, principals, lab_assistants can see all tickets

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
            where,
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
                assignedTo: { select: { id: true, firstName: true, lastName: true } },
                item: { select: { id: true, itemNumber: true, itemType: true } },
                lab: { select: { id: true, name: true } },
                _count: { select: { comments: true } }
            },
            orderBy: [
                { status: 'asc' }, // Open tickets first
                { priority: 'desc' }, // Critical first
                { createdAt: 'desc' }
            ],
            skip,
            take: parseInt(limit)
        }),
        prisma.ticket.count({ where })
    ]);

    res.json({
        success: true,
        data: {
            tickets,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        }
    });
}));

/**
 * @route   GET /api/tickets/stats
 * @desc    Get ticket statistics
 * @access  Private (Admin/Lab Assistant)
 */
router.get('/stats', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const [byStatus, byPriority, byCategory, recentActivity] = await Promise.all([
        prisma.ticket.groupBy({
            by: ['status'],
            _count: { id: true }
        }),
        prisma.ticket.groupBy({
            by: ['priority'],
            _count: { id: true }
        }),
        prisma.ticket.groupBy({
            by: ['category'],
            _count: { id: true }
        }),
        prisma.ticket.findMany({
            where: { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            select: { id: true, ticketNumber: true, title: true, status: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take: 10
        })
    ]);

    res.json({
        success: true,
        data: {
            byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
            byPriority: byPriority.reduce((acc, p) => ({ ...acc, [p.priority]: p._count.id }), {}),
            byCategory: byCategory.reduce((acc, c) => ({ ...acc, [c.category]: c._count.id }), {}),
            recentActivity
        }
    });
}));

/**
 * @route   GET /api/tickets/:id
 * @desc    Get ticket by ID with comments
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
        include: {
            createdBy: { select: { id: true, firstName: true, lastName: true, role: true, email: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true, role: true } },
            resolvedBy: { select: { id: true, firstName: true, lastName: true } },
            item: { select: { id: true, itemNumber: true, itemType: true, brand: true, modelNo: true, lab: { select: { id: true, name: true } } } },
            lab: { select: { id: true, name: true, roomNumber: true } },
            comments: {
                include: {
                    user: { select: { id: true, firstName: true, lastName: true, role: true } }
                },
                orderBy: { createdAt: 'asc' }
            }
        }
    });

    if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Check access for students
    if (req.user.role === 'student' && ticket.createdById !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: { ticket } });
}));

/**
 * @route   PUT /api/tickets/:id
 * @desc    Update ticket (status, assign, priority)
 * @access  Private (Admin/Lab Assistant)
 */
router.put('/:id', authenticate, authorize('admin', 'principal', 'lab_assistant', 'instructor'), asyncHandler(async (req, res) => {
    const { status, priority, assignedToId } = req.body;

    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;

    const updated = await prisma.ticket.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.json({
        success: true,
        message: 'Ticket updated',
        data: { ticket: updated }
    });
}));

/**
 * @route   PUT /api/tickets/:id/resolve
 * @desc    Resolve a ticket
 * @access  Private (Admin/Lab Assistant)
 */
router.put('/:id/resolve', authenticate, authorize('admin', 'principal', 'lab_assistant'), [
    body('resolutionNotes').optional().isString()
], asyncHandler(async (req, res) => {
    const { resolutionNotes } = req.body;

    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const resolved = await prisma.ticket.update({
        where: { id: req.params.id },
        data: {
            status: 'resolved',
            resolvedById: req.user.id,
            resolvedAt: new Date(),
            resolutionNotes: resolutionNotes || null
        },
        include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            resolvedBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.json({
        success: true,
        message: `Ticket ${resolved.ticketNumber} resolved`,
        data: { ticket: resolved }
    });

    // Send notification to ticket creator (after response to not delay)
    try {
        await notificationService.createNotification({
            userId: ticket.createdById,
            title: `Ticket Resolved: ${resolved.ticketNumber}`,
            message: `Your ticket "${resolved.title}" has been resolved.${resolutionNotes ? ` Notes: ${resolutionNotes}` : ''}`,
            type: 'ticket_resolved',
            referenceType: 'ticket',
            referenceId: resolved.id,
            actionUrl: '/tickets'
        });
    } catch (notifyError) {
        console.warn('Failed to send ticket resolution notification:', notifyError.message);
    }
}));

/**
 * @route   PUT /api/tickets/:id/close
 * @desc    Close a ticket
 * @access  Private (Admin/Ticket Creator)
 */
router.put('/:id/close', authenticate, asyncHandler(async (req, res) => {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Only admin or ticket creator can close
    if (req.user.role !== 'admin' && req.user.role !== 'principal' && ticket.createdById !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Only admins or ticket creator can close tickets' });
    }

    const closed = await prisma.ticket.update({
        where: { id: req.params.id },
        data: { status: 'closed' }
    });

    res.json({
        success: true,
        message: `Ticket ${closed.ticketNumber} closed`,
        data: { ticket: closed }
    });
}));

/**
 * @route   POST /api/tickets/:id/comments
 * @desc    Add comment to ticket
 * @access  Private
 */
router.post('/:id/comments', authenticate, [
    body('content').trim().notEmpty().withMessage('Comment content is required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
        select: { id: true, ticketNumber: true, title: true, createdById: true }
    });
    if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Check access for students
    if (req.user.role === 'student' && ticket.createdById !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const comment = await prisma.ticketComment.create({
        data: {
            ticketId: req.params.id,
            userId: req.user.id,
            content: req.body.content
        },
        include: {
            user: { select: { id: true, firstName: true, lastName: true, role: true } }
        }
    });

    // Update ticket's updatedAt
    await prisma.ticket.update({
        where: { id: req.params.id },
        data: { updatedAt: new Date() }
    });

    res.status(201).json({
        success: true,
        message: 'Comment added',
        data: { comment }
    });

    // Notify concerned parties about new comment (after response)
    try {
        const commenterName = `${comment.user.firstName} ${comment.user.lastName}`;
        const isAdmin = ['admin', 'principal', 'lab_assistant', 'instructor'].includes(req.user.role);

        if (isAdmin) {
            // Admin/instructor commented - notify the ticket creator (student)
            await notificationService.createNotification({
                userId: ticket.createdById,
                title: `Comment on Ticket: ${ticket.ticketNumber}`,
                message: `${commenterName} commented on your ticket "${ticket.title}"`,
                type: 'ticket_comment',
                referenceType: 'ticket',
                referenceId: ticket.id,
                actionUrl: '/tickets'
            });
        } else {
            // Student commented - notify admins and assigned person
            await notificationService.notifyAdmins({
                title: `Comment on Ticket: ${ticket.ticketNumber}`,
                message: `${commenterName} commented on ticket "${ticket.title}"`,
                type: 'ticket_comment',
                referenceType: 'ticket',
                referenceId: ticket.id,
                actionUrl: '/tickets'
            });
        }
    } catch (notifyError) {
        console.warn('Failed to send comment notification:', notifyError.message);
    }
}));

/**
 * @route   DELETE /api/tickets/:id
 * @desc    Delete a ticket
 * @access  Private (Admin only)
 */
router.delete('/:id', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    await prisma.ticket.delete({ where: { id: req.params.id } });

    res.json({
        success: true,
        message: `Ticket ${ticket.ticketNumber} deleted`
    });
}));

module.exports = router;
