const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0, unreadOnly } = req.query;

    try {
        const where = { userId: req.user.id };
        if (unreadOnly === 'true') {
            where.is_read = false;
        }

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset),
            select: {
                id: true,
                userId: true,
                title: true,
                title_hindi: true,
                message: true,
                message_hindi: true,
                type: true,
                is_read: true,
                createdAt: true,
                readAt: true,
                action_url: true
            }
        });

        const unreadCount = await prisma.notification.count({
            where: { userId: req.user.id, is_read: false }
        });

        res.json({
            success: true,
            data: {
                notifications: notifications.map(n => ({
                    ...n,
                    // Keep backward compatibility - map fields
                    subject: n.title,
                    body: n.message,
                    isRead: n.is_read
                })),
                unreadCount
            }
        });
    } catch (error) {
        console.error('Notification query error:', error.message);
        // Return empty notifications if table/columns not available yet
        res.json({
            success: true,
            data: {
                notifications: [],
                unreadCount: 0
            }
        });
    }
}));

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', authenticate, asyncHandler(async (req, res) => {
    try {
        const count = await prisma.notification.count({
            where: { userId: req.user.id, is_read: false }
        });

        res.json({
            success: true,
            data: { count }
        });
    } catch (error) {
        res.json({
            success: true,
            data: { count: 0 }
        });
    }
}));

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:id/read', authenticate, asyncHandler(async (req, res) => {
    try {
        const notification = await prisma.notification.update({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            data: {
                is_read: true,
                readAt: new Date()
            }
        });

        res.json({
            success: true,
            data: { notification }
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: 'Notification not found'
        });
    }
}));

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', authenticate, asyncHandler(async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: {
                userId: req.user.id,
                is_read: false
            },
            data: {
                is_read: true,
                readAt: new Date()
            }
        });

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        res.json({
            success: true,
            message: 'No notifications to mark as read'
        });
    }
}));

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
    await prisma.notification.delete({
        where: {
            id: req.params.id,
            userId: req.user.id
        }
    });

    res.json({
        success: true,
        message: 'Notification deleted'
    });
}));

module.exports = router;
