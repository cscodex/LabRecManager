const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/users
 * @desc    Get all users (with filters)
 * @access  Private (Admin, Principal)
 */
router.get('/', authenticate, authorize('admin', 'principal', 'instructor'), asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, role, search, isActive, classId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = { schoolId: req.user.schoolId };

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    if (search) {
        where.OR = [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { admissionNumber: { contains: search, mode: 'insensitive' } },
            { studentId: { contains: search, mode: 'insensitive' } }
        ];
    }

    // Filter by class for students
    if (classId) {
        where.classEnrollments = {
            some: { classId, status: 'active' }
        };
    }

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: { firstName: 'asc' },
            select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                firstNameHindi: true,
                lastName: true,
                lastNameHindi: true,
                role: true,
                admissionNumber: true,
                studentId: true,
                employeeId: true,
                profileImageUrl: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                classEnrollments: {
                    where: { status: 'active' },
                    include: {
                        class: {
                            select: { id: true, name: true, gradeLevel: true, section: true }
                        }
                    }
                }
            }
        }),
        prisma.user.count({ where })
    ]);

    res.json({
        success: true,
        data: {
            users,
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
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            firstNameHindi: true,
            lastName: true,
            lastNameHindi: true,
            role: true,
            admissionNumber: true,
            studentId: true,
            employeeId: true,
            profileImageUrl: true,
            preferredLanguage: true,
            isActive: true,
            lastLogin: true,
            createdAt: true,
            school: {
                select: { id: true, name: true, nameHindi: true }
            },
            classEnrollments: {
                include: {
                    class: true
                }
            },
            groupMemberships: {
                include: {
                    group: true
                }
            }
        }
    });

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    res.json({
        success: true,
        data: { user }
    });
}));

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Self or Admin)
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
    // Check authorization
    if (req.user.id !== req.params.id && !['admin', 'principal'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Not authorized to update this user'
        });
    }

    const {
        firstName, firstNameHindi, lastName, lastNameHindi,
        phone, preferredLanguage, profileImageUrl
    } = req.body;

    // Admin can update more fields
    const adminFields = ['admin', 'principal'].includes(req.user.role) ? {
        role: req.body.role,
        isActive: req.body.isActive,
        admissionNumber: req.body.admissionNumber,
        studentId: req.body.studentId,
        employeeId: req.body.employeeId
    } : {};

    const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
            firstName,
            firstNameHindi,
            lastName,
            lastNameHindi,
            phone,
            preferredLanguage,
            profileImageUrl,
            ...adminFields
        },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            profileImageUrl: true,
            preferredLanguage: true
        }
    });

    res.json({
        success: true,
        message: 'User updated successfully',
        messageHindi: 'उपयोगकर्ता सफलतापूर्वक अपडेट किया गया',
        data: { user }
    });
}));

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Private (Admin, Principal)
 */
router.post('/', authenticate, authorize('admin', 'principal', 'instructor'), [
    body('email').isEmail().normalizeEmail(),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('role').isIn(['student', 'instructor', 'lab_assistant', 'admin', 'principal'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }

    const {
        email, firstName, firstNameHindi, lastName, lastNameHindi,
        role, phone, admissionNumber, studentId, employeeId, password, classId
    } = req.body;

    // Check if email exists
    const existing = await prisma.user.findUnique({
        where: { email }
    });

    if (existing) {
        return res.status(400).json({
            success: false,
            message: 'Email already exists'
        });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password || 'password123', salt);

    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            firstName,
            firstNameHindi,
            lastName,
            lastNameHindi,
            role: role || 'student',
            schoolId: req.user.schoolId,
            phone,
            admissionNumber,
            studentId: studentId || admissionNumber, // Use studentId or fallback to admissionNumber
            employeeId,
            preferredLanguage: 'en'
        },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            admissionNumber: true,
            studentId: true,
            employeeId: true
        }
    });

    // If student and classId provided, enroll in class
    if (role === 'student' && classId) {
        await prisma.classEnrollment.create({
            data: {
                studentId: user.id,
                classId,
                enrolledById: req.user.id,
                status: 'active'
            }
        });
    }

    // Log the action
    await prisma.activityLog.create({
        data: {
            userId: req.user.id,
            schoolId: req.user.schoolId,
            actionType: 'other',
            entityType: 'user',
            entityId: user.id,
            description: `Created ${role} account: ${firstName} ${lastName}`,
            descriptionHindi: `${role === 'student' ? 'छात्र' : role === 'instructor' ? 'शिक्षक' : role} खाता बनाया: ${firstName} ${lastName}`
        }
    });

    res.status(201).json({
        success: true,
        message: 'User created successfully',
        messageHindi: 'उपयोगकर्ता सफलतापूर्वक बनाया गया',
        data: { user }
    });
}));

/**
 * @route   POST /api/users/:id/profile-image
 * @desc    Upload profile image
 * @access  Private (Self)
 */
router.post('/:id/profile-image', authenticate, uploadSingle, asyncHandler(async (req, res) => {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Not authorized'
        });
    }

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No image uploaded'
        });
    }

    const profileImageUrl = `/uploads/profiles/${req.file.filename}`;

    await prisma.user.update({
        where: { id: req.params.id },
        data: { profileImageUrl }
    });

    res.json({
        success: true,
        message: 'Profile image uploaded',
        data: { profileImageUrl }
    });
}));

/**
 * @route   POST /api/users/bulk
 * @desc    Create multiple users (for import)
 * @access  Private (Admin)
 */
router.post('/bulk', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Users array is required'
        });
    }

    const { classId } = req.body; // Optional class to enroll all students
    const results = { created: [], failed: [], enrolled: 0 };

    for (const userData of users) {
        try {
            // Check if email exists
            const existing = await prisma.user.findUnique({
                where: { email: userData.email }
            });

            if (existing) {
                results.failed.push({ email: userData.email, reason: 'Email already exists' });
                continue;
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(userData.password || 'password123', salt);

            const user = await prisma.user.create({
                data: {
                    email: userData.email,
                    passwordHash,
                    firstName: userData.firstName,
                    firstNameHindi: userData.firstNameHindi,
                    lastName: userData.lastName,
                    lastNameHindi: userData.lastNameHindi,
                    role: userData.role || 'student',
                    schoolId: req.user.schoolId,
                    phone: userData.phone,
                    admissionNumber: userData.admissionNumber,
                    studentId: userData.studentId || userData.admissionNumber,
                    employeeId: userData.employeeId,
                    preferredLanguage: userData.preferredLanguage || 'en'
                },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    studentId: true
                }
            });

            // Enroll in class if classId provided and user is a student
            const enrollClassId = userData.classId || classId;
            if (enrollClassId && (userData.role || 'student') === 'student') {
                try {
                    await prisma.classEnrollment.create({
                        data: {
                            studentId: user.id,
                            classId: enrollClassId,
                            status: 'active'
                        }
                    });
                    results.enrolled++;
                } catch (enrollError) {
                    // Enrollment failed but user was created
                    console.error('Enrollment failed:', enrollError.message);
                }
            }

            results.created.push(user);
        } catch (error) {
            results.failed.push({ email: userData.email, reason: error.message });
        }
    }

    res.status(201).json({
        success: true,
        message: `Created ${results.created.length} users, ${results.failed.length} failed, ${results.enrolled} enrolled in class`,
        data: results
    });
}));

/**
 * @route   DELETE /api/users/:id
 * @desc    Deactivate user (soft delete)
 * @access  Private (Admin)
 */
router.delete('/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    await prisma.user.update({
        where: { id: req.params.id },
        data: { isActive: false }
    });

    res.json({
        success: true,
        message: 'User deactivated successfully',
        messageHindi: 'उपयोगकर्ता निष्क्रिय किया गया'
    });
}));

module.exports = router;
