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
            _count: {
                select: {
                    documents: { where: { deletedAt: null } },
                    children: { where: { deletedAt: null } }
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    res.json({
        success: true,
        data: {
            folders: folders.map(f => ({
                ...f,
                documentCount: f._count.documents,
                subfolderCount: f._count.children
            }))
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

module.exports = router;
