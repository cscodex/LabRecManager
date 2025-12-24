const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Dashboard stats based on user role
router.get('/stats', authenticate, asyncHandler(async (req, res) => {
    const { role, schoolId, id: userId } = req.user;
    let stats = {};

    if (role === 'student') {
        // Get classes the student is enrolled in
        const enrollments = await prisma.classEnrollment.findMany({
            where: { studentId: userId, status: 'active' },
            select: { classId: true }
        });
        const classIds = enrollments.map(e => e.classId);

        const [assignedCount, submissionCount, pendingVivas] = await Promise.all([
            prisma.assignmentTarget.count({
                where: {
                    OR: [
                        { targetStudentId: userId },
                        { targetClassId: { in: classIds } }
                    ]
                }
            }),
            prisma.submission.count({ where: { studentId: userId } }),
            prisma.vivaSession.count({ where: { studentId: userId, status: { in: ['scheduled', 'in_progress'] } } }),
            // Get grades for avg score calculation
            prisma.grade.findMany({
                where: {
                    submission: { studentId: userId },
                    isPublished: true
                },
                select: { finalMarks: true, maxMarks: true }
            })
        ]);

        // Calculate average score percentage
        let avgScore = null;
        if (grades.length > 0) {
            const totalMarks = grades.reduce((sum, g) => sum + (g.finalMarks || 0), 0);
            const totalMax = grades.reduce((sum, g) => sum + (g.maxMarks || 100), 0);
            avgScore = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0;
        }

        stats = {
            assignedToMe: assignedCount,
            mySubmissions: submissionCount,
            pendingVivas,
            completedVivas: await prisma.vivaSession.count({ where: { studentId: userId, status: 'completed' } }),
            avgScore,
            totalGrades: grades.length
        };
    } else if (role === 'instructor' || role === 'lab_assistant') {
        const [assignmentCount, pendingGrading, scheduledVivas, totalStudents] = await Promise.all([
            prisma.assignment.count({ where: { createdById: userId } }),
            prisma.submission.count({
                where: {
                    assignment: { createdById: userId },
                    status: { in: ['submitted', 'under_review'] }
                }
            }),
            prisma.vivaSession.count({ where: { examinerId: userId, status: { in: ['scheduled', 'in_progress'] } } }),
            prisma.classEnrollment.count({
                where: {
                    class: {
                        OR: [
                            { classTeacherId: userId },
                            { classSubjects: { some: { OR: [{ instructorId: userId }, { labInstructorId: userId }] } } }
                        ]
                    },
                    status: 'active'
                }
            })
        ]);
        stats = {
            myAssignments: assignmentCount,
            pendingGrading,
            scheduledVivas,
            totalStudents,
            completedGrades: await prisma.grade.count({ where: { gradedById: userId } })
        };
    } else {
        // Admin/Principal - school-wide stats
        const [totalUsers, totalStudents, totalInstructors, totalClasses, totalAssignments, totalSubmissions, totalVivas] = await Promise.all([
            prisma.user.count({ where: { schoolId, isActive: true } }),
            prisma.user.count({ where: { schoolId, role: 'student', isActive: true } }),
            prisma.user.count({ where: { schoolId, role: 'instructor', isActive: true } }),
            prisma.class.count({ where: { schoolId } }),
            prisma.assignment.count(),
            prisma.submission.count(),
            prisma.vivaSession.count()
        ]);
        stats = {
            totalUsers,
            totalStudents,
            totalInstructors,
            totalClasses,
            totalAssignments,
            totalSubmissions,
            totalVivas,
            pendingGrading: await prisma.submission.count({ where: { status: { in: ['submitted', 'under_review'] } } })
        };
    }

    res.json({ success: true, data: { stats } });
}));

// Recent activity
router.get('/activity', authenticate, asyncHandler(async (req, res) => {
    const activities = await prisma.activityLog.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
    res.json({ success: true, data: { activities } });
}));

// Upcoming deadlines - Query through AssignmentTarget since dueDate is on targets, not assignments
router.get('/deadlines', authenticate, asyncHandler(async (req, res) => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const { role, id: userId } = req.user;

    // Get the user's class enrollments if student
    let classIds = [];
    if (role === 'student') {
        const enrollments = await prisma.classEnrollment.findMany({
            where: { studentId: userId, status: 'active' },
            select: { classId: true }
        });
        classIds = enrollments.map(e => e.classId);
    }

    // Query assignment targets with upcoming due dates
    const targets = await prisma.assignmentTarget.findMany({
        where: {
            dueDate: { gte: now, lte: nextWeek },
            assignment: { status: 'published' },
            ...(role === 'student' && {
                OR: [
                    { targetStudentId: userId },
                    { targetClassId: { in: classIds } }
                ]
            })
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
        include: {
            assignment: {
                select: { id: true, title: true, titleHindi: true, subject: true }
            }
        }
    });

    // For students, get their submissions to check completion status
    let studentSubmissions = [];
    if (role === 'student') {
        const assignmentIds = [...new Set(targets.map(t => t.assignment.id))];
        studentSubmissions = await prisma.submission.findMany({
            where: {
                studentId: userId,
                assignmentId: { in: assignmentIds }
            },
            select: {
                assignmentId: true,
                status: true,
                grade: { select: { finalMarks: true, isPublished: true } }
            }
        });
    }

    // Format the response to match expected format with status
    const submissionMap = new Map(studentSubmissions.map(s => [s.assignmentId, s]));

    const upcomingDeadlines = targets.map(t => {
        const submission = submissionMap.get(t.assignment.id);
        let status = 'pending';
        if (submission) {
            if (submission.grade?.isPublished) status = 'graded';
            else if (submission.status === 'submitted' || submission.status === 'under_review') status = 'submitted';
            else if (submission.status === 'needs_revision') status = 'needs_revision';
            else status = 'in_progress';
        }
        return {
            id: t.assignment.id,
            title: t.assignment.title,
            titleHindi: t.assignment.titleHindi,
            dueDate: t.dueDate,
            subject: t.assignment.subject,
            status,
            isCompleted: ['submitted', 'graded', 'under_review'].includes(status),
            grade: submission?.grade
        };
    });

    res.json({ success: true, data: { upcomingDeadlines } });
}));

// Database health check - public endpoint
router.get('/health', asyncHandler(async (req, res) => {
    const startTime = Date.now();
    let dbStatus = 'offline';
    let dbResponseTime = null;
    let dbError = null;

    try {
        // Simple query to check database connection
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'online';
        dbResponseTime = Date.now() - startTime;
    } catch (error) {
        dbStatus = 'offline';
        dbError = error.message;
        dbResponseTime = Date.now() - startTime;
    }

    res.json({
        success: true,
        data: {
            server: 'online',
            database: dbStatus,
            responseTime: dbResponseTime,
            timestamp: new Date().toISOString(),
            error: dbError
        }
    });
}));

module.exports = router;
