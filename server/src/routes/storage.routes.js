const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Helper to format bytes
function formatBytes(bytes) {
    if (bytes === 0 || bytes === null) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * @route   GET /api/storage/usage
 * @desc    Get current user's storage usage
 * @access  Private
 */
router.get('/usage', authenticate, asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            storageQuotaMb: true,
            storageUsedBytes: true
        }
    });

    const quotaBytes = (user.storageQuotaMb || 500) * 1024 * 1024;
    const usedBytes = Number(user.storageUsedBytes || 0);
    const percentUsed = quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 100) : 0;

    res.json({
        success: true,
        data: {
            quotaMb: user.storageQuotaMb || 500,
            quotaBytes,
            usedBytes,
            usedFormatted: formatBytes(usedBytes),
            quotaFormatted: formatBytes(quotaBytes),
            percentUsed,
            remainingBytes: Math.max(0, quotaBytes - usedBytes),
            remainingFormatted: formatBytes(Math.max(0, quotaBytes - usedBytes))
        }
    });
}));

/**
 * @route   GET /api/storage/users
 * @desc    Get all users with storage stats (Admin only)
 * @access  Private (Admin/Principal)
 */
router.get('/users', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
        where: { schoolId: req.user.schoolId },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            storageQuotaMb: true,
            storageUsedBytes: true
        },
        orderBy: [{ role: 'asc' }, { firstName: 'asc' }]
    });

    res.json({
        success: true,
        data: {
            users: users.map(u => {
                const quotaBytes = (u.storageQuotaMb || 500) * 1024 * 1024;
                const usedBytes = Number(u.storageUsedBytes || 0);
                return {
                    ...u,
                    storageUsedBytes: usedBytes,
                    usedFormatted: formatBytes(usedBytes),
                    quotaFormatted: formatBytes(quotaBytes),
                    percentUsed: quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 100) : 0
                };
            })
        }
    });
}));

/**
 * @route   PUT /api/storage/users/:id/quota
 * @desc    Set individual user storage quota
 * @access  Private (Admin/Principal)
 */
router.put('/users/:id/quota', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { quotaMb } = req.body;

    if (!quotaMb || quotaMb < 0) {
        return res.status(400).json({ success: false, message: 'Invalid quota value' });
    }

    const user = await prisma.user.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId }
    });

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    await prisma.user.update({
        where: { id: req.params.id },
        data: { storageQuotaMb: parseInt(quotaMb) }
    });

    res.json({
        success: true,
        message: `Storage quota set to ${quotaMb} MB`
    });
}));

/**
 * @route   PUT /api/storage/users/bulk-quota
 * @desc    Bulk set storage quota for multiple users
 * @access  Private (Admin/Principal)
 */
router.put('/users/bulk-quota', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { userIds, quotaMb, role } = req.body;

    if (!quotaMb || quotaMb < 0) {
        return res.status(400).json({ success: false, message: 'Invalid quota value' });
    }

    let where = { schoolId: req.user.schoolId };

    if (userIds && userIds.length > 0) {
        where.id = { in: userIds };
    } else if (role) {
        where.role = role;
    } else {
        return res.status(400).json({ success: false, message: 'Specify userIds or role' });
    }

    const result = await prisma.user.updateMany({
        where,
        data: { storageQuotaMb: parseInt(quotaMb) }
    });

    res.json({
        success: true,
        message: `Storage quota set to ${quotaMb} MB for ${result.count} users`
    });
}));

/**
 * @route   POST /api/storage/recalculate
 * @desc    Recalculate storage usage for current user
 * @access  Private
 */
router.post('/recalculate', authenticate, asyncHandler(async (req, res) => {
    // Sum up all document sizes for this user
    const result = await prisma.document.aggregate({
        where: {
            uploadedById: req.user.id,
            deletedAt: null
        },
        _sum: {
            fileSize: true
        }
    });

    const totalBytes = result._sum.fileSize || 0;

    await prisma.user.update({
        where: { id: req.user.id },
        data: { storageUsedBytes: totalBytes }
    });

    res.json({
        success: true,
        message: 'Storage recalculated',
        data: { usedBytes: totalBytes, usedFormatted: formatBytes(totalBytes) }
    });
}));

module.exports = router;
