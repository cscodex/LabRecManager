const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/classes
 * @desc    Get all classes
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { academicYearId, gradeLevel } = req.query;

    let where = { schoolId: req.user.schoolId };

    if (academicYearId) where.academicYearId = academicYearId;
    if (gradeLevel) where.gradeLevel = parseInt(gradeLevel);

    const classes = await prisma.class.findMany({
        where,
        orderBy: [{ gradeLevel: 'asc' }, { section: 'asc' }],
        include: {
            classTeacher: {
                select: { id: true, firstName: true, lastName: true }
            },
            academicYear: {
                select: { yearLabel: true }
            },
            _count: {
                select: { enrollments: true, groups: true }
            }
        }
    });

    res.json({
        success: true,
        data: { classes }
    });
}));

/**
 * @route   GET /api/classes/:id
 * @desc    Get class by ID with details
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const classData = await prisma.class.findUnique({
        where: { id: req.params.id },
        include: {
            classTeacher: {
                select: { id: true, firstName: true, lastName: true, email: true }
            },
            academicYear: true,
            classSubjects: {
                include: {
                    subject: true,
                    instructor: {
                        select: { id: true, firstName: true, lastName: true }
                    },
                    labInstructor: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            },
            groups: {
                include: {
                    _count: { select: { members: true } }
                }
            }
        }
    });

    if (!classData) {
        return res.status(404).json({
            success: false,
            message: 'Class not found'
        });
    }

    res.json({
        success: true,
        data: { class: classData }
    });
}));

/**
 * @route   GET /api/classes/:id/students
 * @desc    Get students in a class
 * @access  Private
 */
router.get('/:id/students', authenticate, asyncHandler(async (req, res) => {
    const enrollments = await prisma.classEnrollment.findMany({
        where: {
            classId: req.params.id,
            status: 'active'
        },
        orderBy: { rollNumber: 'asc' },
        include: {
            student: {
                select: {
                    id: true,
                    firstName: true,
                    firstNameHindi: true,
                    lastName: true,
                    lastNameHindi: true,
                    email: true,
                    phone: true,
                    admissionNumber: true,
                    profileImageUrl: true
                }
            }
        }
    });

    res.json({
        success: true,
        data: {
            students: enrollments.map(e => ({
                ...e.student,
                rollNumber: e.rollNumber,
                enrollmentDate: e.enrollmentDate
            }))
        }
    });
}));

/**
 * @route   POST /api/classes
 * @desc    Create a new class
 * @access  Private (Admin, Principal)
 */
router.post('/', authenticate, authorize('admin', 'principal'), [
    body('name').trim().notEmpty().withMessage('Class name is required'),
    body('gradeLevel').isInt({ min: 1, max: 12 }).withMessage('Valid grade level required'),
    body('academicYearId').isUUID().withMessage('Valid academic year required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const {
        name, nameHindi, gradeLevel, section, stream,
        academicYearId, classTeacherId, maxStudents
    } = req.body;

    const classData = await prisma.class.create({
        data: {
            schoolId: req.user.schoolId,
            name,
            nameHindi,
            gradeLevel,
            section,
            stream,
            academicYearId,
            classTeacherId,
            maxStudents: maxStudents || 60
        },
        include: {
            classTeacher: {
                select: { id: true, firstName: true, lastName: true }
            }
        }
    });

    res.status(201).json({
        success: true,
        message: 'Class created successfully',
        messageHindi: 'कक्षा सफलतापूर्वक बनाई गई',
        data: { class: classData }
    });
}));

/**
 * @route   POST /api/classes/:id/enroll
 * @desc    Enroll students in a class
 * @access  Private (Admin, Principal)
 */
router.post('/:id/enroll', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { studentIds, rollNumbers } = req.body;

    if (!studentIds || !Array.isArray(studentIds)) {
        return res.status(400).json({
            success: false,
            message: 'Student IDs array is required'
        });
    }

    const enrollments = await Promise.all(studentIds.map((studentId, index) =>
        prisma.classEnrollment.upsert({
            where: {
                studentId_classId: {
                    studentId,
                    classId: req.params.id
                }
            },
            create: {
                studentId,
                classId: req.params.id,
                rollNumber: rollNumbers?.[index] || index + 1,
                status: 'active'
            },
            update: {
                status: 'active',
                rollNumber: rollNumbers?.[index]
            }
        })
    ));

    res.status(201).json({
        success: true,
        message: `Enrolled ${enrollments.length} students`,
        messageHindi: `${enrollments.length} छात्रों को नामांकित किया`,
        data: { enrollments }
    });
}));

/**
 * @route   POST /api/classes/:id/groups
 * @desc    Create a student group in class
 * @access  Private (Instructor)
 */
router.post('/:id/groups', authenticate, authorize('instructor', 'lab_assistant', 'admin'), [
    body('name').trim().notEmpty().withMessage('Group name is required'),
    body('studentIds').isArray({ min: 1 }).withMessage('At least one student required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const { name, nameHindi, description, studentIds, leaderId } = req.body;

    const group = await prisma.studentGroup.create({
        data: {
            classId: req.params.id,
            name,
            nameHindi,
            description,
            createdById: req.user.id,
            members: {
                create: studentIds.map(studentId => ({
                    studentId,
                    role: studentId === leaderId ? 'leader' : 'member'
                }))
            }
        },
        include: {
            members: {
                include: {
                    student: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            }
        }
    });

    res.status(201).json({
        success: true,
        message: 'Group created successfully',
        messageHindi: 'समूह सफलतापूर्वक बनाया गया',
        data: { group }
    });
}));

/**
 * @route   GET /api/classes/:id/groups
 * @desc    Get all groups in a class
 * @access  Private
 */
router.get('/:id/groups', authenticate, asyncHandler(async (req, res) => {
    const groups = await prisma.studentGroup.findMany({
        where: { classId: req.params.id },
        include: {
            members: {
                include: {
                    student: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            admissionNumber: true
                        }
                    }
                }
            },
            createdBy: {
                select: { id: true, firstName: true, lastName: true }
            }
        }
    });

    res.json({
        success: true,
        data: { groups }
    });
}));

module.exports = router;
