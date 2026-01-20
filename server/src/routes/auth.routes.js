const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { jwt: jwtConfig } = require('../config/constants');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Validation rules
const loginValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
];

const registerValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('role').isIn(['admin', 'principal', 'instructor', 'student', 'accountant', 'lab_assistant'])
        .withMessage('Valid role is required'),
    body('schoolId').isUUID().withMessage('Valid school ID is required')
];

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post('/login', loginValidation, asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            messageHindi: 'सत्यापन विफल',
            errors: errors.array()
        });
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            school: {
                select: {
                    id: true,
                    name: true,
                    nameHindi: true,
                    primaryLanguage: true
                }
            }
        }
    });

    // DEBUG: Log user lookup result
    console.log('Login attempt for:', email);
    console.log('Raw request body email:', req.body.email);
    console.log('User found:', user ? { id: user.id, email: user.email, role: user.role, isActive: user.isActive, hasPasswordHash: !!user.passwordHash } : 'NOT FOUND');

    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Invalid email or password',
            messageHindi: 'अमान्य ईमेल या पासवर्ड'
        });
    }

    // Check if active
    if (!user.isActive) {
        console.log('User is not active');
        return res.status(401).json({
            success: false,
            message: 'Account is deactivated. Contact administrator.',
            messageHindi: 'खाता निष्क्रिय है। प्रशासक से संपर्क करें।'
        });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    console.log('Password match result:', isMatch);

    if (!isMatch) {
        return res.status(401).json({
            success: false,
            message: 'Invalid email or password',
            messageHindi: 'अमान्य ईमेल या पासवर्ड'
        });
    }

    // Generate tokens
    const accessToken = jwt.sign(
        { userId: user.id, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
    );

    const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        jwtConfig.secret,
        { expiresIn: jwtConfig.refreshExpiresIn }
    );

    // Update last login
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
    });

    // Log activity (wrapped in try-catch to not break login)
    try {
        await prisma.activityLog.create({
            data: {
                userId: user.id,
                schoolId: user.schoolId,
                actionType: 'login',
                description: 'User logged in',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });
    } catch (logError) {
        console.warn('Failed to log activity:', logError.message);
    }

    res.json({
        success: true,
        message: 'Login successful',
        messageHindi: 'लॉगिन सफल',
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                firstNameHindi: user.firstNameHindi,
                lastName: user.lastName,
                lastNameHindi: user.lastNameHindi,
                role: user.role,
                studentId: user.studentId,
                admissionNumber: user.admissionNumber,
                employeeId: user.employeeId,
                preferredLanguage: user.preferredLanguage,
                profileImageUrl: user.profileImageUrl,
                school: user.school
            },
            accessToken,
            refreshToken
        }
    });
}));

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public (but typically controlled)
 */
router.post('/register', registerValidation, asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            messageHindi: 'सत्यापन विफल',
            errors: errors.array()
        });
    }

    const {
        email, password, firstName, firstNameHindi, lastName, lastNameHindi,
        role, schoolId, phone, admissionNumber, employeeId, preferredLanguage
    } = req.body;

    // Check if email exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return res.status(409).json({
            success: false,
            message: 'Email already registered',
            messageHindi: 'ईमेल पहले से पंजीकृत है'
        });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            firstName,
            firstNameHindi,
            lastName,
            lastNameHindi,
            role,
            schoolId,
            phone,
            admissionNumber,
            employeeId,
            preferredLanguage: preferredLanguage || 'en'
        },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            preferredLanguage: true,
            createdAt: true
        }
    });

    res.status(201).json({
        success: true,
        message: 'Registration successful',
        messageHindi: 'पंजीकरण सफल',
        data: { user }
    });
}));

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            message: 'Refresh token is required',
            messageHindi: 'रिफ्रेश टोकन आवश्यक है'
        });
    }

    try {
        const decoded = jwt.verify(refreshToken, jwtConfig.secret);

        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, role: true, isActive: true }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token',
                messageHindi: 'अमान्य रिफ्रेश टोकन'
            });
        }

        const accessToken = jwt.sign(
            { userId: user.id, role: user.role },
            jwtConfig.secret,
            { expiresIn: jwtConfig.expiresIn }
        );

        res.json({
            success: true,
            data: { accessToken }
        });
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token',
            messageHindi: 'अमान्य या समाप्त रिफ्रेश टोकन'
        });
    }
}));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            email: true,
            phone: true,
            firstName: true,
            firstNameHindi: true,
            lastName: true,
            lastNameHindi: true,
            role: true,
            studentId: true,
            admissionNumber: true,
            employeeId: true,
            profileImageUrl: true,
            preferredLanguage: true,
            lastLogin: true,
            createdAt: true,
            school: {
                select: {
                    id: true,
                    name: true,
                    nameHindi: true,
                    primaryLanguage: true,
                    secondaryLanguages: true
                }
            }
        }
    });

    res.json({
        success: true,
        data: { user }
    });
}));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client should discard tokens)
 * @access  Private
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
    // Log activity
    await prisma.activityLog.create({
        data: {
            userId: req.user.id,
            schoolId: req.user.schoolId,
            actionType: 'logout',
            description: 'User logged out',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        }
    });

    res.json({
        success: true,
        message: 'Logout successful',
        messageHindi: 'लॉगआउट सफल'
    });
}));

/**
 * @route   PUT /api/auth/password
 * @desc    Change password
 * @access  Private
 */
router.put('/password', authenticate, [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
        where: { id: req.user.id }
    });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
        return res.status(400).json({
            success: false,
            message: 'Current password is incorrect',
            messageHindi: 'वर्तमान पासवर्ड गलत है'
        });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash }
    });

    res.json({
        success: true,
        message: 'Password changed successfully',
        messageHindi: 'पासवर्ड सफलतापूर्वक बदला गया'
    });
}));

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticate, [
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
    body('phone').optional().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const { firstName, lastName, phone, firstNameHindi, lastNameHindi } = req.body;

    // Build update data
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;
    if (firstNameHindi) updateData.firstNameHindi = firstNameHindi;
    if (lastNameHindi) updateData.lastNameHindi = lastNameHindi;

    const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: {
            id: true,
            email: true,
            firstName: true,
            firstNameHindi: true,
            lastName: true,
            lastNameHindi: true,
            phone: true,
            role: true,
            profileImageUrl: true
        }
    });

    res.json({
        success: true,
        message: 'Profile updated successfully',
        messageHindi: 'प्रोफ़ाइल सफलतापूर्वक अपडेट की गई',
        data: { user: updatedUser }
    });
}));

/**
 * @route   POST /api/auth/login-with-pin
 * @desc    First-time login with PIN (for new students)
 * @access  Public
 */
router.post('/login-with-pin', asyncHandler(async (req, res) => {
    const { email, pin, newPassword } = req.body;

    if (!email || !pin) {
        return res.status(400).json({
            success: false,
            message: 'Email and PIN are required'
        });
    }

    // Find user
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            school: {
                select: { id: true, name: true, nameHindi: true, primaryLanguage: true }
            }
        }
    });

    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Invalid email or PIN'
        });
    }

    // Check if PIN exists
    if (!user.resetPin || !user.pinExpiresAt) {
        return res.status(400).json({
            success: false,
            message: 'No PIN set for this account. Use password to login.',
            requiresPassword: true
        });
    }

    // Check if PIN expired
    if (new Date() > user.pinExpiresAt) {
        return res.status(400).json({
            success: false,
            message: 'PIN has expired. Contact administrator for a new PIN.'
        });
    }

    // Verify PIN
    const isPinValid = await bcrypt.compare(pin, user.resetPin);
    if (!isPinValid) {
        return res.status(401).json({
            success: false,
            message: 'Invalid PIN'
        });
    }

    // If no newPassword provided, tell frontend to ask for password setup
    if (!newPassword) {
        return res.json({
            success: true,
            requiresPasswordSetup: true,
            message: 'PIN verified. Please set your password.',
            data: {
                email: user.email,
                firstName: user.firstName
            }
        });
    }

    // Validate new password
    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters'
        });
    }

    // Set new password and clear PIN
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash,
            resetPin: null,
            pinExpiresAt: null,
            lastLogin: new Date()
        }
    });

    // Generate tokens
    const accessToken = jwt.sign(
        { userId: user.id, role: user.role },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn }
    );

    const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        jwtConfig.secret,
        { expiresIn: jwtConfig.refreshExpiresIn }
    );

    // Log activity
    try {
        await prisma.activityLog.create({
            data: {
                userId: user.id,
                schoolId: user.schoolId,
                actionType: 'login',
                description: 'First-time login with PIN',
                ipAddress: req.ip
            }
        });
    } catch (e) { }

    res.json({
        success: true,
        message: 'Password set and login successful',
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                preferredLanguage: user.preferredLanguage,
                profileImageUrl: user.profileImageUrl,
                school: user.school
            },
            accessToken,
            refreshToken
        }
    });
}));

/**
 * @route   POST /api/auth/reset-admin-password
 * @desc    Reset admin password (use secret key for security)
 * @access  Public (with secret key)
 */
router.post('/reset-admin-password', asyncHandler(async (req, res) => {
    const { email, newPassword, secretKey } = req.body;

    // Security: Require a secret key (set this in env or use a fixed one for emergency)
    const RESET_SECRET = process.env.ADMIN_RESET_SECRET || 'RESET_ADMIN_2024';

    if (secretKey !== RESET_SECRET) {
        return res.status(403).json({
            success: false,
            message: 'Invalid secret key'
        });
    }

    if (!email || !newPassword) {
        return res.status(400).json({
            success: false,
            message: 'Email and new password are required'
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters'
        });
    }

    // Find user
    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
    });

    console.log(`Password reset for user: ${email}`);

    res.json({
        success: true,
        message: `Password reset successfully for ${email}`,
        hint: 'You can now login with the new password'
    });
}));

module.exports = router;
