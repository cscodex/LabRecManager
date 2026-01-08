const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/folders
 * @desc    Get all folders for current user (with optional parent filter)
 * @access  Private
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const { parentId, search } = req.query;

    const where = {
        schoolId: req.user.schoolId,
        deletedAt: null
    };

    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
        // When searching, we ignore parentId to search globally
    } else {
        where.parentId = parentId || null;
    }

    const folders = await prisma.documentFolder.findMany({
        where,
        include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            shares: {
                select: {
                    id: true,
                    targetType: true,
                    targetClassId: true,
                    targetGroupId: true,
                    targetUserId: true,
                    targetClass: { select: { id: true, name: true } },
                    targetGroup: { select: { id: true, name: true } },
                    targetUser: { select: { id: true, firstName: true, lastName: true, role: true } },
                    sharedAt: true
                }
            },
            _count: {
                select: {
                    documents: { where: { deletedAt: null } },
                    children: { where: { deletedAt: null } }
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    // Helper function to recursively calculate folder size
    const calculateFolderSize = async (folderId) => {
        // Get direct documents size
        const directDocs = await prisma.document.aggregate({
            where: { folderId, deletedAt: null },
            _sum: { fileSize: true }
        });
        // Handle BigInt - convert to Number
        let totalSize = Number(directDocs._sum.fileSize || 0);

        // Get child folders and calculate their sizes recursively
        const childFolders = await prisma.documentFolder.findMany({
            where: { parentId: folderId, deletedAt: null },
            select: { id: true }
        });

        for (const child of childFolders) {
            totalSize += await calculateFolderSize(child.id);
        }

        return totalSize;
    };

    // Format file size helper
    const formatSize = (bytes) => {
        if (!bytes || bytes === 0) return '-';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    };

    // Calculate sizes for all folders
    const foldersWithSize = await Promise.all(folders.map(async (f) => {
        const totalSize = await calculateFolderSize(f.id);

        // Format share info for frontend display
        const shareInfo = (f.shares || []).map(share => {
            let type, targetId, name;
            if (share.targetClassId) {
                type = 'class';
                targetId = share.targetClassId;
                name = share.targetClass?.name || 'Class';
            } else if (share.targetGroupId) {
                type = 'group';
                targetId = share.targetGroupId;
                name = share.targetGroup?.name || 'Group';
            } else if (share.targetUserId) {
                type = share.targetUser?.role || share.targetType;
                targetId = share.targetUserId;
                name = share.targetUser ? `${share.targetUser.firstName} ${share.targetUser.lastName}` : 'User';
            } else {
                return null;
            }
            return { type, targetId, name, sharedAt: share.sharedAt };
        }).filter(Boolean);

        return {
            ...f,
            documentCount: f._count.documents,
            subfolderCount: f._count.children,
            totalSize,
            totalSizeFormatted: formatSize(totalSize),
            shareInfo
        };
    }));

    res.json({
        success: true,
        data: {
            folders: foldersWithSize
        }
    });
}));

/**
 * @route   GET /api/folders/:id
 * @desc    Get folder details with contents
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
    const folder = await prisma.documentFolder.findFirst({
        where: {
            id: req.params.id,
            schoolId: req.user.schoolId,
            deletedAt: null
        },
        include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            parent: { select: { id: true, name: true } }
        }
    });

    if (!folder) {
        return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    // Get breadcrumb path
    const breadcrumbs = [];
    let currentFolder = folder;
    while (currentFolder) {
        breadcrumbs.unshift({ id: currentFolder.id, name: currentFolder.name });
        if (currentFolder.parent) {
            currentFolder = await prisma.documentFolder.findUnique({
                where: { id: currentFolder.parent.id },
                include: { parent: { select: { id: true, name: true } } }
            });
        } else {
            break;
        }
    }

    res.json({
        success: true,
        data: { folder, breadcrumbs }
    });
}));

/**
 * @route   POST /api/folders
 * @desc    Create a new folder
 * @access  Private (Admin/Principal/Lab Assistant/Instructor)
 */
router.post('/', authenticate, authorize('admin', 'principal', 'lab_assistant', 'instructor'), asyncHandler(async (req, res) => {
    const { name, parentId } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Folder name is required' });
    }

    // Validate parent exists if provided
    if (parentId) {
        const parent = await prisma.documentFolder.findFirst({
            where: { id: parentId, schoolId: req.user.schoolId, deletedAt: null }
        });
        if (!parent) {
            return res.status(404).json({ success: false, message: 'Parent folder not found' });
        }
    }

    const folder = await prisma.documentFolder.create({
        data: {
            schoolId: req.user.schoolId,
            createdById: req.user.id,
            name: name.trim(),
            parentId: parentId || null
        },
        include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });

    res.status(201).json({
        success: true,
        message: 'Folder created',
        data: { folder }
    });
}));

/**
 * @route   PUT /api/folders/:id
 * @desc    Rename or move a folder
 * @access  Private (Admin/Principal/Lab Assistant/Instructor)
 */
router.put('/:id', authenticate, authorize('admin', 'principal', 'lab_assistant', 'instructor'), asyncHandler(async (req, res) => {
    const { name, parentId } = req.body;

    const folder = await prisma.documentFolder.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId, deletedAt: null }
    });

    if (!folder) {
        return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    // Prevent moving folder into itself or its descendants
    if (parentId) {
        if (parentId === req.params.id) {
            return res.status(400).json({ success: false, message: 'Cannot move folder into itself' });
        }
        // Check for circular reference
        let checkId = parentId;
        while (checkId) {
            const checkFolder = await prisma.documentFolder.findUnique({
                where: { id: checkId },
                select: { parentId: true }
            });
            if (checkFolder?.parentId === req.params.id) {
                return res.status(400).json({ success: false, message: 'Cannot move folder into its own subfolder' });
            }
            checkId = checkFolder?.parentId;
        }
    }

    const updated = await prisma.documentFolder.update({
        where: { id: req.params.id },
        data: {
            name: name !== undefined ? name.trim() : folder.name,
            parentId: parentId !== undefined ? (parentId || null) : folder.parentId
        }
    });

    res.json({
        success: true,
        message: 'Folder updated',
        data: { folder: updated }
    });
}));

/**
 * @route   DELETE /api/folders/:id
 * @desc    Delete a folder (soft delete)
 * @access  Private (Admin/Principal)
 */
router.delete('/:id', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const folder = await prisma.documentFolder.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId, deletedAt: null },
        include: { _count: { select: { documents: true, children: true } } }
    });

    if (!folder) {
        return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    // Move contents to parent folder or root
    await prisma.$transaction([
        prisma.document.updateMany({
            where: { folderId: req.params.id, deletedAt: null },
            data: { folderId: folder.parentId }
        }),
        prisma.documentFolder.updateMany({
            where: { parentId: req.params.id, deletedAt: null },
            data: { parentId: folder.parentId }
        }),
        prisma.documentFolder.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() }
        })
    ]);

    res.json({
        success: true,
        message: 'Folder deleted. Contents moved to parent folder.'
    });
}));

/**
 * @route   POST /api/folders/:id/move-documents
 * @desc    Move documents into a folder
 * @access  Private (Admin/Principal/Lab Assistant/Instructor)
 */
router.post('/:id/move-documents', authenticate, authorize('admin', 'principal', 'lab_assistant', 'instructor'), asyncHandler(async (req, res) => {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Document IDs required' });
    }

    // Validate target folder (null = root)
    const targetFolderId = req.params.id === 'root' ? null : req.params.id;
    if (targetFolderId) {
        const folder = await prisma.documentFolder.findFirst({
            where: { id: targetFolderId, schoolId: req.user.schoolId, deletedAt: null }
        });
        if (!folder) {
            return res.status(404).json({ success: false, message: 'Target folder not found' });
        }
    }

    const result = await prisma.document.updateMany({
        where: {
            id: { in: documentIds },
            schoolId: req.user.schoolId,
            deletedAt: null
        },
        data: { folderId: targetFolderId }
    });

    res.json({
        success: true,
        message: `Moved ${result.count} document(s)`,
        data: { movedCount: result.count }
    });
}));

/**
 * @route   POST /api/folders/:id/copy
 * @desc    Copy a folder and its contents to a target folder
 * @access  Private (Admin/Principal/Lab Assistant/Instructor)
 */
router.post('/:id/copy', authenticate, authorize('admin', 'principal', 'lab_assistant', 'instructor'), asyncHandler(async (req, res) => {
    const { targetFolderId } = req.body;
    const sourceFolderId = req.params.id;

    // Get source folder
    const sourceFolder = await prisma.documentFolder.findFirst({
        where: { id: sourceFolderId, schoolId: req.user.schoolId, deletedAt: null }
    });

    if (!sourceFolder) {
        return res.status(404).json({ success: false, message: 'Source folder not found' });
    }

    // Validate target (null = root)
    const targetId = targetFolderId === 'root' ? null : targetFolderId;
    if (targetId) {
        const targetFolder = await prisma.documentFolder.findFirst({
            where: { id: targetId, schoolId: req.user.schoolId, deletedAt: null }
        });
        if (!targetFolder) {
            return res.status(404).json({ success: false, message: 'Target folder not found' });
        }
        // Prevent copying into itself or its descendants
        if (targetId === sourceFolderId) {
            return res.status(400).json({ success: false, message: 'Cannot copy folder into itself' });
        }
    }

    // Recursive copy function
    const copyFolder = async (folderId, newParentId) => {
        const folder = await prisma.documentFolder.findUnique({ where: { id: folderId } });
        if (!folder) return null;

        // Create new folder
        const newFolder = await prisma.documentFolder.create({
            data: {
                schoolId: req.user.schoolId,
                createdById: req.user.id,
                name: `${folder.name} (Copy)`,
                parentId: newParentId
            }
        });

        // Copy documents in this folder
        const documents = await prisma.document.findMany({
            where: { folderId: folder.id, deletedAt: null }
        });

        for (const doc of documents) {
            await prisma.document.create({
                data: {
                    schoolId: req.user.schoolId,
                    folderId: newFolder.id,
                    name: doc.name,
                    description: doc.description,
                    fileType: doc.fileType,
                    fileSize: doc.fileSize,
                    url: doc.url,
                    publicId: doc.publicId,
                    category: doc.category,
                    isPublic: doc.isPublic,
                    uploadedById: req.user.id
                }
            });
        }

        // Recursively copy child folders
        const childFolders = await prisma.documentFolder.findMany({
            where: { parentId: folder.id, deletedAt: null }
        });

        for (const child of childFolders) {
            await copyFolder(child.id, newFolder.id);
        }

        return newFolder;
    };

    const copiedFolder = await copyFolder(sourceFolderId, targetId);

    res.json({
        success: true,
        message: 'Folder copied successfully',
        data: { folder: copiedFolder }
    });
}));

/**
 * @route   POST /api/folders/bulk-move
 * @desc    Move multiple folders to a target folder
 * @access  Private (Admin/Principal/Lab Assistant/Instructor)
 */
router.post('/bulk-move', authenticate, authorize('admin', 'principal', 'lab_assistant', 'instructor'), asyncHandler(async (req, res) => {
    const { folderIds, targetFolderId } = req.body;

    if (!folderIds || !Array.isArray(folderIds) || folderIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Folder IDs required' });
    }

    const targetId = targetFolderId === 'root' ? null : targetFolderId;

    // Validate target folder
    if (targetId) {
        const targetFolder = await prisma.documentFolder.findFirst({
            where: { id: targetId, schoolId: req.user.schoolId, deletedAt: null }
        });
        if (!targetFolder) {
            return res.status(404).json({ success: false, message: 'Target folder not found' });
        }
    }

    // Move each folder (skip if trying to move into itself or its descendants)
    let movedCount = 0;
    for (const folderId of folderIds) {
        // Skip if trying to move to itself
        if (folderId === targetId) continue;

        // Check for circular reference
        let isDescendant = false;
        let checkId = targetId;
        while (checkId) {
            const checkFolder = await prisma.documentFolder.findUnique({
                where: { id: checkId },
                select: { parentId: true }
            });
            if (checkFolder?.parentId === folderId) {
                isDescendant = true;
                break;
            }
            checkId = checkFolder?.parentId;
        }

        if (isDescendant) continue;

        await prisma.documentFolder.update({
            where: { id: folderId },
            data: { parentId: targetId }
        });
        movedCount++;
    }

    res.json({
        success: true,
        message: `Moved ${movedCount} folder(s)`,
        data: { movedCount }
    });
}));

/**
 * @route   POST /api/folders/:id/share
 * @desc    Share a folder with classes, groups, or users
 * @access  Private (admin, principal, lab_assistant, instructor)
 */
router.post('/:id/share', authenticate, authorize('admin', 'principal', 'lab_assistant', 'instructor'), asyncHandler(async (req, res) => {
    const { targets, message } = req.body;
    // targets: [{ type: 'class'|'group'|'instructor'|'admin'|'student', id: 'uuid' }]

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one target is required' });
    }

    const folder = await prisma.documentFolder.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId, deletedAt: null }
    });

    if (!folder) {
        return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const shares = [];
    const notifications = [];
    const VALID_TYPES = ['class', 'group', 'instructor', 'admin', 'student'];

    for (const target of targets) {
        if (!VALID_TYPES.includes(target.type)) {
            return res.status(400).json({ success: false, message: `Invalid target type: ${target.type}` });
        }

        let shareData = {
            folderId: folder.id,
            sharedById: req.user.id,
            targetType: target.type,
            message: message || null
        };

        if (target.type === 'class') {
            shareData.targetClassId = target.id;

            // Notify students in the class
            const enrollments = await prisma.classEnrollment.findMany({
                where: { classId: target.id, status: 'active' },
                select: { studentId: true }
            });
            enrollments.forEach(e => {
                if (!notifications.find(n => n.userId === e.studentId)) {
                    notifications.push({
                        userId: e.studentId,
                        title: 'Folder Shared with You',
                        message: `Folder "${folder.name}" has been shared with your class.`
                    });
                }
            });
        } else if (target.type === 'group') {
            shareData.targetGroupId = target.id;

            // Notify group members
            const members = await prisma.groupMember.findMany({
                where: { groupId: target.id },
                select: { studentId: true }
            });
            members.forEach(m => {
                if (!notifications.find(n => n.userId === m.studentId)) {
                    notifications.push({
                        userId: m.studentId,
                        title: 'Folder Shared with You',
                        message: `Folder "${folder.name}" has been shared with your group.`
                    });
                }
            });
        } else if (['instructor', 'admin', 'student'].includes(target.type)) {
            shareData.targetUserId = target.id;
            notifications.push({
                userId: target.id,
                title: 'Folder Shared with You',
                message: `Folder "${folder.name}" has been shared with you by ${req.user.firstName} ${req.user.lastName}.`
            });
        }

        shares.push(shareData);
    }

    try {
        const createdShares = await prisma.folderShare.createMany({ data: shares });

        if (notifications.length > 0) {
            await prisma.notification.createMany({ data: notifications });
        }

        res.status(201).json({
            success: true,
            message: `Folder shared with ${targets.length} target(s)`,
            data: { sharesCreated: createdShares.count }
        });
    } catch (dbError) {
        console.error('Folder share error:', dbError);
        return res.status(500).json({
            success: false,
            message: dbError.message || 'Failed to share folder'
        });
    }
}));

/**
 * @route   GET /api/folders/:id/shares
 * @desc    Get all shares for a folder
 * @access  Private
 */
router.get('/:id/shares', authenticate, asyncHandler(async (req, res) => {
    const folder = await prisma.documentFolder.findFirst({
        where: { id: req.params.id, schoolId: req.user.schoolId, deletedAt: null }
    });

    if (!folder) {
        return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    const shares = await prisma.folderShare.findMany({
        where: { folderId: req.params.id },
        include: {
            sharedBy: { select: { id: true, firstName: true, lastName: true } },
            targetClass: { select: { id: true, name: true } },
            targetGroup: { select: { id: true, name: true } },
            targetUser: { select: { id: true, firstName: true, lastName: true, role: true } }
        },
        orderBy: { sharedAt: 'desc' }
    });

    res.json({ success: true, data: { shares } });
}));

/**
 * @route   DELETE /api/folders/:id/shares/:shareId
 * @desc    Remove a share from a folder
 * @access  Private
 */
router.delete('/:id/shares/:shareId', authenticate, asyncHandler(async (req, res) => {
    const share = await prisma.folderShare.findFirst({
        where: { id: req.params.shareId, folderId: req.params.id },
        include: { folder: true }
    });

    if (!share) {
        return res.status(404).json({ success: false, message: 'Share not found' });
    }

    // Only allow folder creator, share creator, or admin to remove
    if (share.folder.createdById !== req.user.id && share.sharedById !== req.user.id && !['admin', 'principal'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Not authorized to remove this share' });
    }

    await prisma.folderShare.delete({ where: { id: req.params.shareId } });

    res.json({ success: true, message: 'Share removed' });
}));

module.exports = router;
