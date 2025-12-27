const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/classes
 * @desc    Get all classes (filtered by session from header)
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { academicYearId, gradeLevel, all } = req.query;
    // Use X-Academic-Session header if no explicit academicYearId provided
    // Skip session filter if 'all' is passed (for sharing across sessions)
    const sessionId = all === 'true' ? null : (academicYearId || req.headers['x-academic-session']);

    let where = { schoolId: req.user.schoolId };

    if (sessionId) where.academicYearId = sessionId;
    if (gradeLevel) where.gradeLevel = parseInt(gradeLevel);

    const classes = await prisma.class.findMany({
        where,
        orderBy: [{ gradeLevel: 'asc' }, { section: 'asc' }],
        include: {
            classTeacher: {
                select: { id: true, firstName: true, lastName: true }
            },
            academicYear: {
                select: { yearLabel: true, isCurrent: true }
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

    const classId = req.params.id;
    const { name, nameHindi, description, studentIds, leaderId } = req.body;

    // Check if any students are already in a group for this class
    const existingMembers = await prisma.groupMember.findMany({
        where: {
            studentId: { in: studentIds },
            group: { classId }
        },
        include: {
            group: { select: { name: true } },
            student: { select: { firstName: true, lastName: true } }
        }
    });

    if (existingMembers.length > 0) {
        const conflicts = existingMembers.map(m =>
            `${m.student.firstName} ${m.student.lastName} is already in "${m.group.name}"`
        );
        return res.status(400).json({
            success: false,
            message: 'Some students are already in groups',
            conflicts
        });
    }

    const group = await prisma.studentGroup.create({
        data: {
            classId,
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
            },
            assignedPc: {
                include: {
                    lab: { select: { id: true, name: true } }
                }
            }
        }
    });

    res.json({
        success: true,
        data: { groups }
    });
}));

/**
 * @route   POST /api/classes/:id/groups/auto-generate
 * @desc    Auto-generate groups with 2-3 students each (only for ungrouped students)
 * @access  Private (Admin, Instructor)
 */
router.post('/:id/groups/auto-generate', authenticate, authorize('admin', 'principal', 'instructor', 'lab_assistant'), asyncHandler(async (req, res) => {
    const classId = req.params.id;

    // Get all enrolled students
    const enrollments = await prisma.classEnrollment.findMany({
        where: { classId, status: 'active' },
        include: {
            student: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    // Get students who are already in groups for this class
    const existingGroupMembers = await prisma.groupMember.findMany({
        where: {
            group: { classId }
        },
        select: { studentId: true }
    });
    const groupedStudentIds = new Set(existingGroupMembers.map(m => m.studentId));

    // Filter to only ungrouped students
    const ungroupedStudents = enrollments
        .filter(e => !groupedStudentIds.has(e.student.id))
        .map(e => e.student);

    if (ungroupedStudents.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'All students are already in groups. No ungrouped students found.'
        });
    }

    if (ungroupedStudents.length < 2) {
        return res.status(400).json({
            success: false,
            message: 'Need at least 2 ungrouped students to create groups'
        });
    }

    // Get the highest existing group number to continue the sequence
    const existingGroups = await prisma.studentGroup.findMany({
        where: { classId },
        select: { name: true }
    });
    let maxGroupNum = 0;
    existingGroups.forEach(g => {
        const match = g.name.match(/Group (\d+)/);
        if (match) {
            maxGroupNum = Math.max(maxGroupNum, parseInt(match[1]));
        }
    });

    // Shuffle ungrouped students randomly
    for (let i = ungroupedStudents.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ungroupedStudents[i], ungroupedStudents[j]] = [ungroupedStudents[j], ungroupedStudents[i]];
    }

    // Create groups of 2-3 students
    const groupsToCreate = [];
    let groupNum = maxGroupNum + 1;
    let i = 0;

    while (i < ungroupedStudents.length) {
        const remaining = ungroupedStudents.length - i;
        let groupSize;

        if (remaining <= 3) {
            groupSize = remaining; // Take all remaining
        } else if (remaining === 4) {
            groupSize = 2; // Split into 2 + 2
        } else {
            groupSize = 3; // Take 3
        }

        groupsToCreate.push({
            name: `Group ${groupNum}`,
            members: ungroupedStudents.slice(i, i + groupSize)
        });

        i += groupSize;
        groupNum++;
    }

    // Create groups in database
    const createdGroups = [];
    for (const groupData of groupsToCreate) {
        const group = await prisma.studentGroup.create({
            data: {
                classId,
                name: groupData.name,
                createdById: req.user.id,
                members: {
                    create: groupData.members.map((student, idx) => ({
                        studentId: student.id,
                        role: idx === 0 ? 'leader' : 'member'
                    }))
                }
            },
            include: {
                members: {
                    include: { student: { select: { id: true, firstName: true, lastName: true } } }
                }
            }
        });
        createdGroups.push(group);
    }

    res.status(201).json({
        success: true,
        message: `Created ${createdGroups.length} new groups with ${ungroupedStudents.length} ungrouped students`,
        messageHindi: `${createdGroups.length} नए समूह बनाए गए, ${ungroupedStudents.length} छात्रों के साथ`,
        data: { groups: createdGroups }
    });
}));

/**
 * @route   DELETE /api/classes/:classId/groups/:groupId
 * @desc    Delete a group
 * @access  Private (Admin, Instructor)
 */
router.delete('/:classId/groups/:groupId', authenticate, authorize('admin', 'principal', 'instructor', 'lab_assistant'), asyncHandler(async (req, res) => {
    const { classId, groupId } = req.params;

    // Verify group exists and belongs to class
    const group = await prisma.studentGroup.findFirst({
        where: { id: groupId, classId }
    });

    if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Delete group members first, then group
    await prisma.groupMember.deleteMany({ where: { groupId } });
    await prisma.studentGroup.delete({ where: { id: groupId } });

    res.json({
        success: true,
        message: 'Group deleted successfully',
        messageHindi: 'समूह सफलतापूर्वक हटाया गया'
    });
}));

/**
 * @route   DELETE /api/classes/:classId/groups/:groupId/members/:studentId
 * @desc    Remove a student from a group
 * @access  Private (Admin, Instructor)
 */
router.delete('/:classId/groups/:groupId/members/:studentId', authenticate, authorize('admin', 'principal', 'instructor', 'lab_assistant'), asyncHandler(async (req, res) => {
    const { groupId, studentId } = req.params;

    const member = await prisma.groupMember.findFirst({
        where: { groupId, studentId }
    });

    if (!member) {
        return res.status(404).json({ success: false, message: 'Member not found in group' });
    }

    await prisma.groupMember.delete({ where: { id: member.id } });

    res.json({
        success: true,
        message: 'Student removed from group',
        messageHindi: 'छात्र समूह से हटाया गया'
    });
}));

/**
 * @route   POST /api/classes/:classId/groups/:groupId/members
 * @desc    Add a student to a group
 * @access  Private (Admin, Instructor)
 */
router.post('/:classId/groups/:groupId/members', authenticate, authorize('admin', 'principal', 'instructor', 'lab_assistant'), [
    body('studentId').isUUID().withMessage('Valid student ID required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { classId, groupId } = req.params;
    const { studentId, role } = req.body;

    // Verify group exists
    const group = await prisma.studentGroup.findFirst({ where: { id: groupId, classId } });
    if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Check if student is already in ANY group for this class
    const existingMembership = await prisma.groupMember.findFirst({
        where: {
            studentId,
            group: { classId }
        },
        include: {
            group: { select: { name: true } }
        }
    });
    if (existingMembership) {
        return res.status(400).json({
            success: false,
            message: `Student is already in "${existingMembership.group.name}". A student can only be in one group per class.`
        });
    }

    // Check if student is enrolled in class
    const enrollment = await prisma.classEnrollment.findFirst({
        where: { classId, studentId, status: 'active' }
    });
    if (!enrollment) {
        return res.status(400).json({ success: false, message: 'Student not enrolled in this class' });
    }

    const member = await prisma.groupMember.create({
        data: {
            groupId,
            studentId,
            role: role || 'member'
        },
        include: {
            student: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.status(201).json({
        success: true,
        message: 'Student added to group',
        messageHindi: 'छात्र समूह में जोड़ा गया',
        data: { member }
    });
}));

/**
 * @route   GET /api/classes/:classId/ungrouped-students
 * @desc    Get students not in any group
 * @access  Private
 */
router.get('/:classId/ungrouped-students', authenticate, asyncHandler(async (req, res) => {
    const { classId } = req.params;

    // Get all students in class
    const enrollments = await prisma.classEnrollment.findMany({
        where: { classId, status: 'active' },
        include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } }
    });

    // Get all students already in groups for this class
    const groupedStudentIds = await prisma.groupMember.findMany({
        where: {
            group: { classId }
        },
        select: { studentId: true }
    });

    const groupedIds = new Set(groupedStudentIds.map(g => g.studentId));

    const ungroupedStudents = enrollments
        .filter(e => !groupedIds.has(e.studentId))
        .map(e => e.student);

    res.json({
        success: true,
        data: { students: ungroupedStudents }
    });
}));
/**
 * @route   PUT /api/classes/:classId/groups/:groupId/leader
 * @desc    Change group leader
 * @access  Private (Admin, Instructor)
 */
router.put('/:classId/groups/:groupId/leader', authenticate, authorize('admin', 'principal', 'instructor', 'lab_assistant'), [
    body('studentId').isUUID().withMessage('Valid student ID required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { groupId } = req.params;
    const { studentId } = req.body;

    // Verify the student is a member of this group
    const member = await prisma.groupMember.findFirst({
        where: { groupId, studentId },
        include: { student: { select: { firstName: true, lastName: true } } }
    });

    if (!member) {
        return res.status(404).json({ success: false, message: 'Student is not a member of this group' });
    }

    // Set all members to 'member' role first, then set new leader
    await prisma.$transaction([
        prisma.groupMember.updateMany({
            where: { groupId },
            data: { role: 'member' }
        }),
        prisma.groupMember.update({
            where: { id: member.id },
            data: { role: 'leader' }
        })
    ]);

    res.json({
        success: true,
        message: `${member.student.firstName} ${member.student.lastName} is now the group leader`,
        data: { leaderId: studentId }
    });
}));

module.exports = router;
