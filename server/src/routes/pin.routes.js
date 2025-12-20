/**
 * PIN-based Password Reset Routes
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { generatePin } = require('../utils/profileHelper');

/**
 * @route   POST /api/users/:id/generate-pin
 * @desc    Generate password reset PIN for a student
 * @access  Private (Admin, Principal, Instructor)
 */
router.post('/:id/generate-pin', authenticate, authorize('admin', 'principal', 'instructor'), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { expiresInHours = 24 } = req.body;

    // Find the user
    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, firstName: true, lastName: true, role: true, schoolId: true }
    });

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    // Only allow PIN generation for students in the same school
    if (user.schoolId !== req.user.schoolId) {
        return res.status(403).json({
            success: false,
            message: 'Cannot generate PIN for users in a different school'
        });
    }

    // Generate 6-digit PIN
    const pin = generatePin();

    // Hash the PIN for storage
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);

    // Calculate expiry
    const pinExpiresAt = new Date();
    pinExpiresAt.setHours(pinExpiresAt.getHours() + expiresInHours);

    // Store hashed PIN
    await prisma.user.update({
        where: { id },
        data: {
            resetPin: hashedPin,
            pinExpiresAt
        }
    });

    // Log the action
    await prisma.activityLog.create({
        data: {
            userId: req.user.id,
            schoolId: req.user.schoolId,
            actionType: 'other',
            entityType: 'user',
            entityId: id,
            description: `Generated password reset PIN for ${user.firstName} ${user.lastName}`
        }
    });

    res.json({
        success: true,
        message: 'PIN generated successfully. Share this PIN with the student securely.',
        messageHindi: 'पिन सफलतापूर्वक जनरेट किया गया। इस पिन को छात्र के साथ सुरक्षित रूप से साझा करें।',
        data: {
            pin, // Return plain PIN to admin (only shown once)
            expiresAt: pinExpiresAt,
            studentName: `${user.firstName} ${user.lastName}`
        }
    });
}));

/**
 * @route   POST /api/auth/reset-with-pin
 * @desc    Reset password using PIN (public endpoint)
 * @access  Public
 */
router.post('/reset-with-pin', asyncHandler(async (req, res) => {
    const { email, pin, newPassword } = req.body;

    if (!email || !pin || !newPassword) {
        return res.status(400).json({
            success: false,
            message: 'Email, PIN, and new password are required'
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters'
        });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, resetPin: true, pinExpiresAt: true, firstName: true }
    });

    if (!user) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email or PIN'
        });
    }

    // Check if PIN exists
    if (!user.resetPin || !user.pinExpiresAt) {
        return res.status(400).json({
            success: false,
            message: 'No PIN has been generated for this account. Contact your administrator.'
        });
    }

    // Check if PIN has expired
    if (new Date() > user.pinExpiresAt) {
        return res.status(400).json({
            success: false,
            message: 'PIN has expired. Please request a new PIN from your administrator.'
        });
    }

    // Verify PIN
    const isPinValid = await bcrypt.compare(pin, user.resetPin);
    if (!isPinValid) {
        return res.status(400).json({
            success: false,
            message: 'Invalid PIN'
        });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password and clear PIN
    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash,
            resetPin: null,
            pinExpiresAt: null
        }
    });

    res.json({
        success: true,
        message: 'Password reset successfully. You can now login with your new password.',
        messageHindi: 'पासवर्ड सफलतापूर्वक रीसेट किया गया। अब आप अपने नए पासवर्ड से लॉगिन कर सकते हैं।'
    });
}));

module.exports = router;
