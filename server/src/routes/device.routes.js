const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/devices/test-status
 * @desc    Get current user's device test status
 * @access  Private
 */
router.get('/test-status', authenticate, asyncHandler(async (req, res) => {
    const deviceTest = await prisma.deviceTest.findUnique({
        where: { userId: req.user.id }
    });

    res.json({
        success: true,
        data: { deviceTest }
    });
}));

/**
 * @route   POST /api/devices/test-camera
 * @desc    Save camera test result
 * @access  Private
 */
router.post('/test-camera', authenticate, [
    body('status').isIn(['granted', 'denied']).withMessage('Status must be granted or denied'),
    body('deviceId').optional().isString(),
    body('deviceName').optional().isString()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { status, deviceId, deviceName } = req.body;
    const userAgent = req.headers['user-agent'] || '';

    // Detect platform
    let platform = 'desktop';
    if (/mobile|android|iphone|ipad/i.test(userAgent)) {
        platform = /ipad|tablet/i.test(userAgent) ? 'tablet' : 'mobile';
    }

    // Detect browser
    let browser = 'unknown';
    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) browser = 'Chrome';
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/edge/i.test(userAgent)) browser = 'Edge';

    const deviceTest = await prisma.deviceTest.upsert({
        where: { userId: req.user.id },
        update: {
            cameraStatus: status,
            cameraTestedAt: new Date(),
            cameraDeviceId: deviceId,
            cameraDeviceName: deviceName,
            userAgent,
            platform,
            browser
        },
        create: {
            userId: req.user.id,
            cameraStatus: status,
            cameraTestedAt: new Date(),
            cameraDeviceId: deviceId,
            cameraDeviceName: deviceName,
            userAgent,
            platform,
            browser
        }
    });

    res.json({
        success: true,
        message: 'Camera test saved',
        data: { deviceTest }
    });
}));

/**
 * @route   POST /api/devices/test-mic
 * @desc    Save microphone test result
 * @access  Private
 */
router.post('/test-mic', authenticate, [
    body('status').isIn(['granted', 'denied']).withMessage('Status must be granted or denied'),
    body('deviceId').optional().isString(),
    body('deviceName').optional().isString()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { status, deviceId, deviceName } = req.body;

    const deviceTest = await prisma.deviceTest.upsert({
        where: { userId: req.user.id },
        update: {
            micStatus: status,
            micTestedAt: new Date(),
            micDeviceId: deviceId,
            micDeviceName: deviceName
        },
        create: {
            userId: req.user.id,
            micStatus: status,
            micTestedAt: new Date(),
            micDeviceId: deviceId,
            micDeviceName: deviceName
        }
    });

    res.json({
        success: true,
        message: 'Microphone test saved',
        data: { deviceTest }
    });
}));

/**
 * @route   POST /api/devices/test-speaker
 * @desc    Save speaker test result
 * @access  Private
 */
router.post('/test-speaker', authenticate, [
    body('status').isIn(['granted', 'tested']).withMessage('Status must be granted or tested'),
    body('volume').optional().isInt({ min: 0, max: 100 }),
    body('deviceId').optional().isString(),
    body('deviceName').optional().isString()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { status, volume, deviceId, deviceName } = req.body;

    const deviceTest = await prisma.deviceTest.upsert({
        where: { userId: req.user.id },
        update: {
            speakerStatus: status,
            speakerTestedAt: new Date(),
            speakerVolume: volume,
            speakerDeviceId: deviceId,
            speakerDeviceName: deviceName
        },
        create: {
            userId: req.user.id,
            speakerStatus: status,
            speakerTestedAt: new Date(),
            speakerVolume: volume,
            speakerDeviceId: deviceId,
            speakerDeviceName: deviceName
        }
    });

    res.json({
        success: true,
        message: 'Speaker test saved',
        data: { deviceTest }
    });
}));

/**
 * @route   POST /api/devices/test-all
 * @desc    Save all device test results at once
 * @access  Private
 */
router.post('/test-all', authenticate, asyncHandler(async (req, res) => {
    const {
        cameraStatus, cameraDeviceId, cameraDeviceName,
        micStatus, micDeviceId, micDeviceName,
        speakerStatus, speakerVolume, speakerDeviceId, speakerDeviceName
    } = req.body;

    const userAgent = req.headers['user-agent'] || '';

    let platform = 'desktop';
    if (/mobile|android|iphone|ipad/i.test(userAgent)) {
        platform = /ipad|tablet/i.test(userAgent) ? 'tablet' : 'mobile';
    }

    let browser = 'unknown';
    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) browser = 'Chrome';
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/edge/i.test(userAgent)) browser = 'Edge';

    const updateData = { userAgent, platform, browser };
    const createData = { userId: req.user.id, userAgent, platform, browser };

    if (cameraStatus) {
        updateData.cameraStatus = cameraStatus;
        updateData.cameraTestedAt = new Date();
        updateData.cameraDeviceId = cameraDeviceId;
        updateData.cameraDeviceName = cameraDeviceName;
        createData.cameraStatus = cameraStatus;
        createData.cameraTestedAt = new Date();
        createData.cameraDeviceId = cameraDeviceId;
        createData.cameraDeviceName = cameraDeviceName;
    }

    if (micStatus) {
        updateData.micStatus = micStatus;
        updateData.micTestedAt = new Date();
        updateData.micDeviceId = micDeviceId;
        updateData.micDeviceName = micDeviceName;
        createData.micStatus = micStatus;
        createData.micTestedAt = new Date();
        createData.micDeviceId = micDeviceId;
        createData.micDeviceName = micDeviceName;
    }

    if (speakerStatus) {
        updateData.speakerStatus = speakerStatus;
        updateData.speakerTestedAt = new Date();
        updateData.speakerVolume = speakerVolume;
        updateData.speakerDeviceId = speakerDeviceId;
        updateData.speakerDeviceName = speakerDeviceName;
        createData.speakerStatus = speakerStatus;
        createData.speakerTestedAt = new Date();
        createData.speakerVolume = speakerVolume;
        createData.speakerDeviceId = speakerDeviceId;
        createData.speakerDeviceName = speakerDeviceName;
    }

    const deviceTest = await prisma.deviceTest.upsert({
        where: { userId: req.user.id },
        update: updateData,
        create: createData
    });

    res.json({
        success: true,
        message: 'Device tests saved',
        data: { deviceTest }
    });
}));

module.exports = router;
