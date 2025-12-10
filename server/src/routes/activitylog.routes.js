const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/activity-logs
 * @desc    Get activity logs (role-based filtering)
 * @access  Private (Admin, Principal, Instructor)
 */
router.get('/', authenticate, authorize('admin', 'principal', 'instructor'), asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, actionType, userId, entityType, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};

    // Role-based filtering
    if (req.user.role === 'admin' || req.user.role === 'principal') {
        // Admin and principal can see all logs in their school
        where.user = { schoolId: req.user.schoolId };
    } else if (req.user.role === 'instructor') {
        // Instructors can see logs related to their students
        // Get classes they teach
        const classSubjects = await prisma.classSubject.findMany({
            where: { instructorId: req.user.id },
            select: { classId: true }
        });
        const classIds = classSubjects.map(cs => cs.classId);

        // Get students in those classes
        const enrollments = await prisma.classEnrollment.findMany({
            where: { classId: { in: classIds }, status: 'active' },
            select: { studentId: true }
        });
        const studentIds = enrollments.map(e => e.studentId);

        // Include instructor's own logs and student logs
        where.OR = [
            { userId: req.user.id },
            { userId: { in: studentIds } }
        ];
    }

    // Filter by activity type
    if (actionType) {
        where.actionType = actionType;
    }

    // Filter by entity type
    if (entityType) {
        where.entityType = entityType;
    }

    // Filter by specific user
    if (userId) {
        where.userId = userId;
    }

    // Date range filter
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        role: true
                    }
                }
            }
        }),
        prisma.activityLog.count({ where })
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
 * @route   GET /api/activity-logs/my
 * @desc    Get current user's own activity logs
 * @access  Private
 */
router.get('/my', authenticate, asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
        prisma.activityLog.findMany({
            where: { userId: req.user.id },
            skip,
            take: parseInt(limit),
            orderBy: { createdAt: 'desc' }
        }),
        prisma.activityLog.count({ where: { userId: req.user.id } })
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
 * @route   POST /api/activity-logs
 * @desc    Create an activity log entry (internal use)
 * @access  Private
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const { activityType, description, descriptionHindi, entityType, entityId } = req.body;

    const log = await prisma.activityLog.create({
        data: {
            userId: req.user.id,
            activityType,
            description,
            descriptionHindi,
            entityType,
            entityId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        }
    });

    res.status(201).json({
        success: true,
        data: { log }
    });
}));

module.exports = router;
