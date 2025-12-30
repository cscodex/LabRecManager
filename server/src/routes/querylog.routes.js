const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/admin/query-logs
 * @desc    Get paginated query logs
 * @access  Admin only
 */
router.get('/', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, success, model, action, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    // Filter by success/error
    if (success !== undefined) {
        where.success = success === 'true';
    }

    // Filter by model
    if (model) {
        where.model = model;
    }

    // Filter by action
    if (action) {
        where.action = action;
    }

    // Search in query or error
    if (search) {
        where.OR = [
            { query: { contains: search, mode: 'insensitive' } },
            { error: { contains: search, mode: 'insensitive' } }
        ];
    }

    const [logs, total] = await Promise.all([
        prisma.queryLog.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: { createdAt: 'desc' }
        }),
        prisma.queryLog.count({ where })
    ]);

    res.json({
        success: true,
        data: {
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        }
    });
}));

/**
 * @route   GET /api/admin/query-logs/stats
 * @desc    Get query log statistics
 * @access  Admin only
 */
router.get('/stats', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    const [
        totalLogs,
        totalErrors,
        last24hLogs,
        last24hErrors,
        lastHourLogs,
        modelStats,
        avgDuration
    ] = await Promise.all([
        prisma.queryLog.count(),
        prisma.queryLog.count({ where: { success: false } }),
        prisma.queryLog.count({ where: { createdAt: { gte: last24h } } }),
        prisma.queryLog.count({ where: { createdAt: { gte: last24h }, success: false } }),
        prisma.queryLog.count({ where: { createdAt: { gte: lastHour } } }),
        prisma.queryLog.groupBy({
            by: ['model'],
            _count: { model: true },
            orderBy: { _count: { model: 'desc' } },
            take: 10
        }),
        prisma.queryLog.aggregate({
            _avg: { duration: true },
            where: { createdAt: { gte: last24h } }
        })
    ]);

    res.json({
        success: true,
        data: {
            total: totalLogs,
            totalErrors,
            errorRate: totalLogs > 0 ? (totalErrors / totalLogs * 100).toFixed(2) : 0,
            last24h: {
                total: last24hLogs,
                errors: last24hErrors,
                errorRate: last24hLogs > 0 ? (last24hErrors / last24hLogs * 100).toFixed(2) : 0
            },
            lastHour: lastHourLogs,
            avgDurationMs: Math.round(avgDuration._avg.duration || 0),
            topModels: modelStats.map(m => ({ model: m.model, count: m._count.model }))
        }
    });
}));

/**
 * @route   DELETE /api/admin/query-logs/clear
 * @desc    Clear old query logs (older than specified days)
 * @access  Admin only
 */
router.delete('/clear', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { days = 7 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const result = await prisma.queryLog.deleteMany({
        where: { createdAt: { lt: cutoffDate } }
    });

    res.json({
        success: true,
        message: `Cleared ${result.count} logs older than ${days} days`
    });
}));

/**
 * @route   GET /api/admin/query-logs/models
 * @desc    Get list of unique models for filtering
 * @access  Admin only
 */
router.get('/models', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const models = await prisma.queryLog.findMany({
        distinct: ['model'],
        select: { model: true },
        where: { model: { not: null } }
    });

    res.json({
        success: true,
        data: models.map(m => m.model)
    });
}));

module.exports = router;
