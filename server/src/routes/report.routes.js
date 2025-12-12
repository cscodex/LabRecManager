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
    const { dateRange = 'month', classId } = req.query;
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

    // Build class filter for students if classId is provided
    let studentFilter = { schoolId, role: 'student', isActive: true };
    let studentIds = null;

    if (classId) {
        // Get students enrolled in the specified class
        const enrollments = await prisma.classEnrollment.findMany({
            where: { classId, status: 'active' },
            select: { studentId: true }
        });
        studentIds = enrollments.map(e => e.studentId);
        studentFilter = { ...studentFilter, id: { in: studentIds } };
    }

    // Get total students (filtered by class if classId provided)
    const totalStudents = await prisma.user.count({
        where: studentFilter
    });

    // Build assignment filter - include class-specific assignments if classId provided
    let assignmentFilter = {
        schoolId,
        status: 'published',
        ...(dateRange !== 'all' && { createdAt: dateFilter })
    };

    if (classId) {
        // Get assignment IDs targeted to this class
        const classAssignmentTargets = await prisma.assignmentTarget.findMany({
            where: { targetType: 'class', targetClassId: classId },
            select: { assignmentId: true }
        });
        const classAssignmentIds = classAssignmentTargets.map(t => t.assignmentId);
        assignmentFilter = { ...assignmentFilter, id: { in: classAssignmentIds } };
    }

    // Get total assignments (published)
    const totalAssignments = await prisma.assignment.count({
        where: assignmentFilter
    });

    // Build submission filter
    let submissionFilter = {
        assignment: { schoolId },
        ...(dateRange !== 'all' && { submittedAt: dateFilter })
    };

    if (studentIds) {
        submissionFilter = { ...submissionFilter, studentId: { in: studentIds } };
    }

    // Get submissions
    const totalSubmissions = await prisma.submission.count({
        where: submissionFilter
    });

    // Get graded submissions - count submissions that have a grade record
    const gradedSubmissions = await prisma.submission.count({
        where: {
            ...submissionFilter,
            grade: { isNot: null }
        }
    });

    // Build grade filter for other grade-related queries
    let gradeFilter = {
        submission: { assignment: { schoolId } },
        ...(dateRange !== 'all' && { gradedAt: dateFilter })
    };

    if (studentIds) {
        gradeFilter = { ...gradeFilter, studentId: { in: studentIds } };
    }

    // Calculate submission rate
    const expectedSubmissions = totalStudents * totalAssignments;
    const submissionRate = expectedSubmissions > 0
        ? Math.round((totalSubmissions / expectedSubmissions) * 100)
        : 0;

    // Get score aggregations (avg, min, max)
    const scoreAggregation = await prisma.grade.aggregate({
        where: gradeFilter,
        _avg: { percentage: true },
        _min: { percentage: true },
        _max: { percentage: true }
    });

    const avgScore = Math.round(scoreAggregation._avg?.percentage ? parseFloat(scoreAggregation._avg.percentage) : 0);
    const minScore = Math.round(scoreAggregation._min?.percentage ? parseFloat(scoreAggregation._min.percentage) : 0);
    const maxScore = Math.round(scoreAggregation._max?.percentage ? parseFloat(scoreAggregation._max.percentage) : 0);

    // Get grade distribution
    const grades = await prisma.grade.findMany({
        where: gradeFilter,
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
        let topPerformersFilter = {
            submission: { assignment: { schoolId } },
            isPublished: true,
            percentage: { not: null }
        };

        if (studentIds) {
            topPerformersFilter = { ...topPerformersFilter, studentId: { in: studentIds } };
        }

        const topPerformersRaw = await prisma.grade.groupBy({
            by: ['studentId'],
            where: topPerformersFilter,
            _avg: { percentage: true },
            _count: { id: true },
            orderBy: { _avg: { percentage: 'desc' } },
            take: 10
        });

        // Get student details for top performers
        const performerStudentIds = topPerformersRaw.map(p => p.studentId);
        const students = await prisma.user.findMany({
            where: { id: { in: performerStudentIds } },
            select: { id: true, firstName: true, lastName: true, studentId: true, admissionNumber: true, email: true }
        });

        const studentMap = {};
        students.forEach(s => { studentMap[s.id] = s; });

        topPerformers = topPerformersRaw.map(p => ({
            ...studentMap[p.studentId],
            avgScore: p._avg?.percentage ? parseFloat(p._avg.percentage) : 0,
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
            minScore,
            maxScore,
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
            g.percentage ? parseFloat(g.percentage).toFixed(1) : 0,
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
        stats.avgScore = gradedSubs.reduce((sum, s) => sum + (s.grade.percentage ? parseFloat(s.grade.percentage) : 0), 0) / gradedSubs.length;
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
            ? graded.reduce((sum, s) => sum + (s.grade.percentage ? parseFloat(s.grade.percentage) : 0), 0) / graded.length
            : 0
    };

    res.json({
        success: true,
        data: { assignment, analytics }
    });
}));

module.exports = router;
