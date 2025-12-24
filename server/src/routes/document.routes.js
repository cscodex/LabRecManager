const express = require('express');
const router = express.Router();
const multer = require('multer');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const cloudinary = require('../services/cloudinary');

// Configure multer for memory storage with 100MB limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, JPG, PNG, GIF, WEBP'));
        }
    }
});

// Helper to get file type from mime
function getFileType(mimeType) {
    const types = {
        'application/pdf': 'pdf',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'text/csv': 'csv',
        'text/plain': 'txt',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp'
    };
    return types[mimeType] || 'file';
}

// Helper to format file size
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * @route   GET /api/documents
 * @desc    Get all documents for the school
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { category, search } = req.query;

    const where = { schoolId: req.user.schoolId };
    if (category) where.category = category;
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { fileName: { contains: search, mode: 'insensitive' } }
        ];
    }

    const documents = await prisma.document.findMany({
        where,
        include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
            shares: {
                include: {
                    targetClass: { select: { id: true, name: true, gradeLevel: true, section: true } },
                    targetGroup: { select: { id: true, name: true } },
                    targetUser: { select: { id: true, firstName: true, lastName: true, role: true } }
                },
                orderBy: { sharedAt: 'desc' }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.json({
        success: true,
        data: {
            documents: documents.map(d => {
                // Deduplicate shares by type + target ID
                const uniqueSharesMap = new Map();
                d.shares?.forEach(s => {
                    const targetId = s.targetClassId || s.targetGroupId || s.targetUserId;
                    const key = `${s.targetType}-${targetId}`;
                    if (!uniqueSharesMap.has(key)) {
                        uniqueSharesMap.set(key, {
                            id: s.id,
                            type: s.targetType,
                            targetId: targetId,
                            targetName: s.targetType === 'class'
                                ? (s.targetClass?.name || `Grade ${s.targetClass?.gradeLevel}-${s.targetClass?.section}`)
                                : s.targetType === 'group'
                                    ? s.targetGroup?.name
                                    : `${s.targetUser?.firstName} ${s.targetUser?.lastName}`,
                            sharedAt: s.sharedAt
                        });
                    }
                });
                const uniqueShares = Array.from(uniqueSharesMap.values());

                return {
                    ...d,
                    fileSizeFormatted: formatSize(d.fileSize),
                    shareCount: uniqueShares.length,
                    shareInfo: uniqueShares
                };
            })
        }
    });
}));

/**
 * @route   GET /api/documents/:id
 * @desc    Get a single document
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res, next) => {
    // UUID validation - if not a valid UUID, skip to next route (e.g., /shared)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id)) {
        return next();
    }

    const doc = await prisma.document.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId },
        include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.json({
        success: true,
        data: {
            document: {
                ...doc,
                fileSizeFormatted: formatSize(doc.fileSize)
            }
        }
    });
}));

/**
 * @route   POST /api/documents
 * @desc    Upload a new document
 * @access  Private (Admin/Principal/Lab Assistant)
 */
router.post('/', authenticate, authorize('admin', 'principal', 'lab_assistant'), upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file provided' });
    }

    if (!cloudinary.isConfigured()) {
        return res.status(503).json({ success: false, message: 'File storage not configured' });
    }

    const { name, description, category, isPublic } = req.body;

    // Upload to Cloudinary
    const result = await cloudinary.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
    );

    // Create document record
    const doc = await prisma.document.create({
        data: {
            schoolId: req.user.schoolId,
            uploadedById: req.user.id,
            name: name || req.file.originalname.replace(/\.[^.]+$/, ''),
            description: description || null,
            fileName: req.file.originalname,
            fileType: getFileType(req.file.mimetype),
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            cloudinaryId: result.publicId,
            url: result.secureUrl,
            isPublic: isPublic === 'true' || isPublic === true,
            category: category || null
        },
        include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: {
            document: {
                ...doc,
                fileSizeFormatted: formatSize(doc.fileSize)
            }
        }
    });
}));

/**
 * @route   PUT /api/documents/:id
 * @desc    Update document metadata
 * @access  Private (Admin/Principal)
 */
router.put('/:id', authenticate, authorize('admin', 'principal', 'lab_assistant'), asyncHandler(async (req, res) => {
    const { name, description, category, isPublic } = req.body;

    const doc = await prisma.document.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId }
    });

    if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const updated = await prisma.document.update({
        where: { id: req.params.id },
        data: {
            name: name !== undefined ? name : doc.name,
            description: description !== undefined ? description : doc.description,
            category: category !== undefined ? category : doc.category,
            isPublic: isPublic !== undefined ? (isPublic === 'true' || isPublic === true) : doc.isPublic
        },
        include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.json({
        success: true,
        message: 'Document updated',
        data: {
            document: {
                ...updated,
                fileSizeFormatted: formatSize(updated.fileSize)
            }
        }
    });
}));

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete a document
 * @access  Private (Admin/Principal)
 */
router.delete('/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const doc = await prisma.document.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId }
    });

    if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Delete from Cloudinary
    try {
        await cloudinary.deleteFile(doc.cloudinaryId, 'raw');
    } catch (err) {
        console.error('Cloudinary delete error:', err.message);
    }

    // Delete from database
    await prisma.document.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: 'Document deleted' });
}));

/**
 * @route   GET /api/documents/:id/public
 * @desc    Get public document (no auth required if isPublic)
 * @access  Public
 */
router.get('/:id/public', asyncHandler(async (req, res) => {
    const doc = await prisma.document.findUnique({
        where: { id: req.params.id }
    });

    if (!doc || !doc.isPublic) {
        return res.status(404).json({ success: false, message: 'Document not found or not public' });
    }

    res.json({
        success: true,
        data: {
            document: {
                id: doc.id,
                name: doc.name,
                fileType: doc.fileType,
                url: doc.url,
                fileSizeFormatted: formatSize(doc.fileSize)
            }
        }
    });
}));

/**
 * @route   POST /api/documents/:id/share
 * @desc    Share a document with classes, groups, or users
 * @access  Private (Admin/Principal/Lab Assistant)
 */
router.post('/:id/share', authenticate, authorize('admin', 'principal', 'lab_assistant', 'instructor'), asyncHandler(async (req, res) => {
    const { targets, message } = req.body;
    // targets: [{ type: 'class'|'group'|'instructor'|'admin', id: 'uuid' }]

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one target is required' });
    }

    const doc = await prisma.document.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId }
    });

    if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const shares = [];
    const notifications = [];

    // Valid target types
    const VALID_TYPES = ['class', 'group', 'instructor', 'admin', 'student'];

    for (const target of targets) {
        // Validate target type
        if (!VALID_TYPES.includes(target.type)) {
            console.error('Invalid target type:', target.type);
            return res.status(400).json({ success: false, message: `Invalid target type: ${target.type}` });
        }

        let shareData = {
            documentId: doc.id,
            sharedById: req.user.id,
            targetType: target.type,
            message: message || null
        };

        // Set the appropriate target field based on type
        if (target.type === 'class') {
            shareData.targetClassId = target.id;

            // Get all students in the class for notifications
            const enrollments = await prisma.classEnrollment.findMany({
                where: { classId: target.id, status: 'active' },
                select: { studentId: true }
            });
            enrollments.forEach(e => {
                if (!notifications.find(n => n.userId === e.studentId)) {
                    notifications.push({
                        userId: e.studentId,
                        title: 'Document Shared with You',
                        message: `"${doc.name}" has been shared with your class.`
                    });
                }
            });
        } else if (target.type === 'group') {
            shareData.targetGroupId = target.id;

            // Get all members of the group for notifications
            const members = await prisma.groupMember.findMany({
                where: { groupId: target.id },
                select: { studentId: true }
            });
            members.forEach(m => {
                if (!notifications.find(n => n.userId === m.studentId)) {
                    notifications.push({
                        userId: m.studentId,
                        title: 'Document Shared with You',
                        message: `"${doc.name}" has been shared with your group.`
                    });
                }
            });
        } else if (target.type === 'instructor' || target.type === 'admin') {
            shareData.targetUserId = target.id;

            notifications.push({
                userId: target.id,
                title: 'Document Shared with You',
                message: `"${doc.name}" has been shared with you by ${req.user.firstName} ${req.user.lastName}.`
            });
        } else if (target.type === 'student') {
            shareData.targetUserId = target.id;

            notifications.push({
                userId: target.id,
                title: 'Document Shared with You',
                message: `"${doc.name}" has been shared with you by ${req.user.firstName} ${req.user.lastName}.`
            });
        }

        shares.push(shareData);
    }

    // Create all shares
    console.log('Creating shares:', JSON.stringify(shares, null, 2));
    try {
        const createdShares = await prisma.documentShare.createMany({
            data: shares
        });

        // Create notifications for recipients
        if (notifications.length > 0) {
            await prisma.notification.createMany({
                data: notifications
            });
        }

        res.status(201).json({
            success: true,
            message: `Document shared with ${targets.length} target(s)`,
            data: { sharesCreated: createdShares.count }
        });
    } catch (dbError) {
        console.error('Document share error:', dbError);
        console.error('Share data:', JSON.stringify(shares, null, 2));
        return res.status(500).json({
            success: false,
            message: dbError.message || 'Failed to share document',
            error: dbError.code || 'UNKNOWN',
            details: dbError.meta || null
        });
    }
}));

/**
 * @route   GET /api/documents/shared
 * @desc    Get documents shared with the current user
 * @access  Private
 */
router.get('/shared', authenticate, asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const schoolId = req.user.schoolId;

        console.log('[GET /documents/shared] userId:', userId, 'role:', userRole);

        // Build query conditions based on user role
        const orConditions = [];

        // If user is a student, check class and group shares
        if (userRole === 'student') {
            // Get student's class IDs
            const enrollments = await prisma.classEnrollment.findMany({
                where: { studentId: userId, status: 'active' },
                select: { classId: true }
            });
            const classIds = enrollments.map(e => e.classId);
            console.log('[GET /documents/shared] Student classIds:', classIds);

            // Get student's group IDs
            const groupMembers = await prisma.groupMember.findMany({
                where: { studentId: userId },
                select: { groupId: true }
            });
            const groupIds = groupMembers.map(g => g.groupId);
            console.log('[GET /documents/shared] Student groupIds:', groupIds);

            if (classIds.length > 0) {
                orConditions.push({ targetType: 'class', targetClassId: { in: classIds } });
            }
            if (groupIds.length > 0) {
                orConditions.push({ targetType: 'group', targetGroupId: { in: groupIds } });
            }
            // Direct user shares for students - enum value is 'student'
            orConditions.push({ targetType: 'student', targetUserId: userId });
        } else {
            // For non-students, use their role as targetType
            const targetTypeForUser = userRole; // 'instructor', 'admin', etc.
            orConditions.push({ targetType: targetTypeForUser, targetUserId: userId });
            orConditions.push({ sharedById: userId });
        }

        console.log('[GET /documents/shared] orConditions count:', orConditions.length);

        // Even with just direct shares, we should query
        const shares = await prisma.documentShare.findMany({
            where: {
                OR: orConditions,
                document: { schoolId }
            },
            include: {
                document: {
                    include: {
                        uploadedBy: { select: { id: true, firstName: true, lastName: true } }
                    }
                },
                sharedBy: { select: { id: true, firstName: true, lastName: true } },
                targetClass: { select: { id: true, name: true } },
                targetGroup: { select: { id: true, name: true } }
            },
            orderBy: { sharedAt: 'desc' }
        });

        console.log('[GET /documents/shared] Found', shares.length, 'shares');

        // Format the response
        const documents = shares.map(share => ({
            shareId: share.id,
            sharedAt: share.sharedAt,
            message: share.message,
            sharedBy: share.sharedBy,
            targetType: share.targetType,
            targetClass: share.targetClass,
            targetGroup: share.targetGroup,
            document: {
                ...share.document,
                fileSizeFormatted: formatSize(share.document.fileSize)
            }
        }));

        res.json({
            success: true,
            data: { documents }
        });
    } catch (error) {
        console.error('[GET /documents/shared] ERROR:', error.message);
        console.error('[GET /documents/shared] STACK:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to load shared documents: ' + error.message
        });
    }
}));

/**
 * @route   GET /api/documents/:id/shares
 * @desc    Get all shares for a document
 * @access  Private (Admin/Principal/Owner)
 */
router.get('/:id/shares', authenticate, asyncHandler(async (req, res) => {
    const doc = await prisma.document.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId }
    });

    if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const shares = await prisma.documentShare.findMany({
        where: { documentId: req.params.id },
        include: {
            sharedBy: { select: { id: true, firstName: true, lastName: true } },
            targetClass: { select: { id: true, name: true } },
            targetGroup: { select: { id: true, name: true } },
            targetUser: { select: { id: true, firstName: true, lastName: true, role: true } }
        },
        orderBy: { sharedAt: 'desc' }
    });

    res.json({
        success: true,
        data: { shares }
    });
}));

/**
 * @route   DELETE /api/documents/shares/:shareId
 * @desc    Remove a share
 * @access  Private (Admin/Principal/Owner)
 */
router.delete('/shares/:shareId', authenticate, authorize('admin', 'principal', 'lab_assistant', 'instructor'), asyncHandler(async (req, res) => {
    const share = await prisma.documentShare.findFirst({
        where: { id: req.params.shareId },
        include: {
            document: { select: { schoolId: true } }
        }
    });

    if (!share || share.document.schoolId !== req.user.schoolId) {
        return res.status(404).json({ success: false, message: 'Share not found' });
    }

    await prisma.documentShare.delete({
        where: { id: req.params.shareId }
    });

    res.json({
        success: true,
        message: 'Share removed successfully'
    });
}));

module.exports = router;
