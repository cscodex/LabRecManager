const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/reports/analytics
 * @desc    Get analytics data for reports dashboard
 * @access  Private (Admin, Instructor, Principal)
 */
router.get('/analytics', authenticate, authorize('admin', 'instructor', 'principal'), asyncHandler(async (req, res) => {
    const { dateRange = 'month' } = req.query;
    const schoolId = req.user.schoolId;

    // Calculate date filter
    let dateFilter = {};
    const now = new Date();
    switch (dateRange) {
        case 'week':
            dateFilter = { gte: new Date(now.setDate(now.getDate() - 7)) };
            break;
        case 'month':
            dateFilter = { gte: new Date(now.setDate(now.getDate() - 30)) };
            break;
        case 'quarter':
            dateFilter = { gte: new Date(now.setDate(now.getDate() - 90)) };
            break;
        case 'year':
            dateFilter = { gte: new Date(now.setFullYear(now.getFullYear() - 1)) };
            break;
        default:
            dateFilter = {};
    }

    // Get total students
    const totalStudents = await prisma.user.count({
        where: { schoolId, role: 'student', isActive: true }
    });

    // Get total assignments (published)
    const totalAssignments = await prisma.assignment.count({
        where: {
            schoolId,
            status: 'published',
            ...(dateRange !== 'all' && { createdAt: dateFilter })
        }
    });

    // Get submissions
    const totalSubmissions = await prisma.submission.count({
        where: {
            assignment: { schoolId },
            ...(dateRange !== 'all' && { submittedAt: dateFilter })
        }
    });

    // Get graded submissions
    const gradedSubmissions = await prisma.grade.count({
        where: {
            submission: { assignment: { schoolId } },
            ...(dateRange !== 'all' && { gradedAt: dateFilter })
        }
    });

    // Calculate submission rate
    const expectedSubmissions = totalStudents * totalAssignments;
    const submissionRate = expectedSubmissions > 0
        ? Math.round((totalSubmissions / expectedSubmissions) * 100)
        : 0;

    // Get average score
    const avgScoreResult = await prisma.grade.aggregate({
        where: {
            submission: { assignment: { schoolId } },
            ...(dateRange !== 'all' && { gradedAt: dateFilter })
        },
        _avg: { percentage: true }
    });
    const avgScore = Math.round(avgScoreResult._avg?.percentage || 0);

    // Get grade distribution
    const grades = await prisma.grade.findMany({
        where: {
            submission: { assignment: { schoolId } },
            ...(dateRange !== 'all' && { gradedAt: dateFilter })
        },
        select: { gradeLetter: true }
    });

    const gradeCount = {};
    grades.forEach(g => {
        gradeCount[g.gradeLetter] = (gradeCount[g.gradeLetter] || 0) + 1;
    });

    const gradeOrder = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'];
    const gradeDistribution = gradeOrder.map(grade => ({
        grade,
        count: gradeCount[grade] || 0
    })).filter(g => g.count > 0);

    // Get top performers - using raw query for better aggregation
    let topPerformers = [];
    try {
        const topPerformersRaw = await prisma.grade.groupBy({
            by: ['studentId'],
            where: {
                submission: { assignment: { schoolId } },
                isPublished: true,
                percentage: { not: null }
            },
            _avg: { percentage: true },
            _count: { id: true },
            orderBy: { _avg: { percentage: 'desc' } },
            take: 10
        });

        // Get student details for top performers
        const studentIds = topPerformersRaw.map(p => p.studentId);
        const students = await prisma.user.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, firstName: true, lastName: true, admissionNumber: true, email: true }
        });

        const studentMap = {};
        students.forEach(s => { studentMap[s.id] = s; });

        topPerformers = topPerformersRaw.map(p => ({
            ...studentMap[p.studentId],
            avgScore: p._avg?.percentage || 0,
            gradedCount: p._count?.id || 0
        })).filter(p => p.firstName);
    } catch (error) {
        console.error('Error fetching top performers:', error);
        topPerformers = [];
    }

    res.json({
        success: true,
        data: {
            totalStudents,
            totalAssignments,
            totalSubmissions,
            gradedSubmissions,
            submissionRate,
            avgScore,
            gradeDistribution,
            topPerformers
        }
    });
}));

/**
 * @route   GET /api/reports/export
 * @desc    Export report as CSV
 * @access  Private (Admin, Instructor, Principal)
 */
router.get('/export', authenticate, authorize('admin', 'instructor', 'principal'), asyncHandler(async (req, res) => {
    const { format = 'csv', dateRange = 'month' } = req.query;
    const schoolId = req.user.schoolId;

    // Get all graded submissions with details
    const grades = await prisma.grade.findMany({
        where: {
            submission: { assignment: { schoolId } },
            isPublished: true
        },
        include: {
            submission: {
                include: {
                    assignment: {
                        select: { title: true, experimentNumber: true, maxMarks: true }
                    },
                    student: {
                        select: { firstName: true, lastName: true, admissionNumber: true, email: true }
                    }
                }
            }
        },
        orderBy: { gradedAt: 'desc' }
    });

    if (format === 'csv') {
        // Generate CSV
        const headers = [
            'Student Name',
            'Admission No',
            'Email',
            'Assignment',
            'Experiment No',
            'Practical Marks',
            'Output Marks',
            'Viva Marks',
            'Late Penalty',
            'Final Marks',
            'Max Marks',
            'Percentage',
            'Grade',
            'Graded Date'
        ];

        const rows = grades.map(g => [
            `${g.submission.student.firstName} ${g.submission.student.lastName}`,
            g.submission.student.admissionNumber || '',
            g.submission.student.email,
            g.submission.assignment.title,
            g.submission.assignment.experimentNumber || '',
            g.practicalMarks,
            g.outputMarks,
            g.vivaMarks,
            g.latePenaltyMarks || 0,
            g.finalMarks,
            g.maxMarks,
            g.percentage?.toFixed(1) || 0,
            g.gradeLetter,
            new Date(g.gradedAt).toLocaleDateString()
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=lab_report_${new Date().toISOString().split('T')[0]}.csv`);
        return res.send(csv);
    }

    // Default: return JSON
    res.json({ success: true, data: { grades } });
}));

/**
 * @route   GET /api/reports/student-progress/:studentId
 * @desc    Get student progress report
 * @access  Private
 */
router.get('/student-progress/:studentId', authenticate, asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    if (req.user.role === 'student' && req.user.id !== studentId) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const submissions = await prisma.submission.findMany({
        where: { studentId },
        include: {
            assignment: { include: { subject: true } },
            grade: true
        },
        orderBy: { submittedAt: 'desc' }
    });

    const stats = {
        total: submissions.length,
        graded: submissions.filter(s => s.grade?.isPublished).length,
        onTime: submissions.filter(s => !s.isLate).length,
        avgScore: 0
    };

    const gradedSubs = submissions.filter(s => s.grade);
    if (gradedSubs.length > 0) {
        stats.avgScore = gradedSubs.reduce((sum, s) => sum + (s.grade.percentage || 0), 0) / gradedSubs.length;
    }

    res.json({ success: true, data: { submissions, stats } });
}));

/**
 * @route   GET /api/reports/class-summary/:classId
 * @desc    Get class summary report
 * @access  Private (Instructor, Admin)
 */
router.get('/class-summary/:classId', authenticate, authorize('instructor', 'lab_assistant', 'admin'), asyncHandler(async (req, res) => {
    const { classId } = req.params;

    const classData = await prisma.class.findUnique({
        where: { id: classId },
        include: {
            enrollments: {
                include: {
                    student: {
                        select: { id: true, firstName: true, lastName: true, admissionNumber: true }
                    }
                }
            },
            _count: { select: { enrollments: true } }
        }
    });

    if (!classData) {
        return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // Get assignments for this class
    const assignments = await prisma.assignmentTarget.findMany({
        where: { targetType: 'class', targetClassId: classId },
        include: {
            assignment: {
                include: {
                    _count: { select: { submissions: true } }
                }
            }
        }
    });

    res.json({
        success: true,
        data: {
            class: classData,
            assignmentCount: assignments.length,
            assignments: assignments.map(a => a.assignment)
        }
    });
}));

/**
 * @route   GET /api/reports/assignment-analytics/:id
 * @desc    Get assignment analytics
 * @access  Private (Instructor, Admin)
 */
router.get('/assignment-analytics/:id', authenticate, asyncHandler(async (req, res) => {
    const assignment = await prisma.assignment.findUnique({
        where: { id: req.params.id },
        include: {
            submissions: {
                include: {
                    grade: true,
                    student: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            },
            _count: { select: { submissions: true, targets: true } }
        }
    });

    if (!assignment) {
        return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Calculate analytics
    const submissions = assignment.submissions;
    const graded = submissions.filter(s => s.grade);
    const onTime = submissions.filter(s => !s.isLate);

    const analytics = {
        totalSubmissions: submissions.length,
        gradedCount: graded.length,
        onTimeCount: onTime.length,
        lateCount: submissions.length - onTime.length,
        avgScore: graded.length > 0
            ? graded.reduce((sum, s) => sum + (s.grade.percentage || 0), 0) / graded.length
            : 0
    };

    res.json({
        success: true,
        data: { assignment, analytics }
    });
}));

module.exports = router;
