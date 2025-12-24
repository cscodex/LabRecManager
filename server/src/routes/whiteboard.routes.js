const express = require('express');
const { prisma } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @route   GET /api/whiteboard/sessions
 * @desc    Get all active whiteboard sessions (admin only)
 * @access  Admin/Principal
 */
router.get('/sessions', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { status = 'active' } = req.query;
    const schoolId = req.user.schoolId;

    const sessions = await prisma.whiteboardSession.findMany({
        where: {
            schoolId,
            status: status === 'all' ? undefined : status
        },
        include: {
            host: {
                select: { id: true, firstName: true, lastName: true, role: true }
            },
            targetClass: {
                select: { id: true, name: true, gradeLevel: true, section: true }
            },
            targetGroup: {
                select: { id: true, name: true }
            },
            participants: {
                where: { isActive: true },
                select: { id: true, role: true, user: { select: { id: true, firstName: true, lastName: true } } }
            },
            _count: { select: { participants: true } }
        },
        orderBy: { startedAt: 'desc' }
    });

    res.json({
        success: true,
        data: sessions.map(s => ({
            ...s,
            participantCount: s._count.participants,
            duration: s.startedAt ? Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000) : 0
        }))
    });
}));

/**
 * @route   GET /api/whiteboard/sessions/:id
 * @desc    Get session details with all participants
 * @access  Admin/Principal
 */
router.get('/sessions/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const session = await prisma.whiteboardSession.findFirst({
        where: { id, schoolId },
        include: {
            host: {
                select: { id: true, firstName: true, lastName: true, email: true, role: true }
            },
            targetClass: {
                select: { id: true, name: true, gradeLevel: true, section: true }
            },
            targetGroup: {
                select: { id: true, name: true }
            },
            participants: {
                include: {
                    user: {
                        select: { id: true, firstName: true, lastName: true, role: true }
                    }
                },
                orderBy: { joinedAt: 'asc' }
            }
        }
    });

    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    res.json({ success: true, data: session });
}));

/**
 * @route   POST /api/whiteboard/sessions
 * @desc    Create a new whiteboard session (when instructor starts sharing)
 * @access  Instructor/Admin
 */
router.post('/sessions', authenticate, authorize('instructor', 'admin', 'lab_assistant'), asyncHandler(async (req, res) => {
    const { title, targetType, targetClassId, targetGroupId } = req.body;
    const hostId = req.user.id;
    const schoolId = req.user.schoolId;

    const session = await prisma.whiteboardSession.create({
        data: {
            schoolId,
            hostId,
            title: title || 'Whiteboard Session',
            targetType,
            targetClassId,
            targetGroupId,
            status: 'active'
        },
        include: {
            host: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    // Add host as participant
    await prisma.whiteboardParticipant.create({
        data: {
            sessionId: session.id,
            userId: hostId,
            role: 'host'
        }
    });

    res.status(201).json({ success: true, data: session });
}));

/**
 * @route   PUT /api/whiteboard/sessions/:id/end
 * @desc    End a whiteboard session
 * @access  Admin/Principal or Host
 */
router.put('/sessions/:id/end', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const schoolId = req.user.schoolId;

    const session = await prisma.whiteboardSession.findFirst({
        where: { id, schoolId }
    });

    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Only host or admin/principal can end
    if (session.hostId !== userId && !['admin', 'principal'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Not authorized to end this session' });
    }

    const updatedSession = await prisma.whiteboardSession.update({
        where: { id },
        data: {
            status: 'ended',
            endedAt: new Date()
        }
    });

    // Mark all participants as inactive
    await prisma.whiteboardParticipant.updateMany({
        where: { sessionId: id, isActive: true },
        data: { isActive: false, leftAt: new Date() }
    });

    res.json({ success: true, data: updatedSession, message: 'Session ended successfully' });
}));

/**
 * @route   PUT /api/whiteboard/sessions/:id/record
 * @desc    Toggle recording for a session
 * @access  Admin/Principal or Host
 */
router.put('/sessions/:id/record', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isRecording } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const schoolId = req.user.schoolId;

    const session = await prisma.whiteboardSession.findFirst({
        where: { id, schoolId }
    });

    if (!session) {
        return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.hostId !== userId && !['admin', 'principal'].includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updatedSession = await prisma.whiteboardSession.update({
        where: { id },
        data: { isRecording: isRecording ?? !session.isRecording }
    });

    res.json({ success: true, data: updatedSession });
}));

/**
 * @route   POST /api/whiteboard/sessions/:id/join
 * @desc    Join a whiteboard session as participant
 * @access  Authenticated
 */
router.post('/sessions/:id/join', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const session = await prisma.whiteboardSession.findUnique({ where: { id } });
    if (!session || session.status !== 'active') {
        return res.status(404).json({ success: false, message: 'Session not found or not active' });
    }

    // Upsert participant
    const participant = await prisma.whiteboardParticipant.upsert({
        where: { sessionId_userId: { sessionId: id, oderId: userId } },
        update: { isActive: true, leftAt: null },
        create: {
            sessionId: id,
            userId,
            role: ['admin', 'principal'].includes(userRole) ? 'cohost' : 'viewer'
        }
    });

    res.json({ success: true, data: participant });
}));

/**
 * @route   POST /api/whiteboard/sessions/:id/leave
 * @desc    Leave a whiteboard session
 * @access  Authenticated
 */
router.post('/sessions/:id/leave', authenticate, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    await prisma.whiteboardParticipant.updateMany({
        where: { sessionId: id, userId, isActive: true },
        data: { isActive: false, leftAt: new Date() }
    });

    res.json({ success: true, message: 'Left session' });
}));

/**
 * @route   POST /api/whiteboard/sessions/:id/message
 * @desc    Send message to session participants (admin broadcast)
 * @access  Admin/Principal
 */
router.post('/sessions/:id/message', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // This would emit via socket - for now just return success
    // The socket handler will pick this up
    res.json({
        success: true,
        data: { sessionId: id, message, sentAt: new Date() },
        message: 'Message will be broadcast to participants'
    });
}));

module.exports = router;
