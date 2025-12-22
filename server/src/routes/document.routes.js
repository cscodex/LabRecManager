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
            uploadedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.json({
        success: true,
        data: {
            documents: documents.map(d => ({
                ...d,
                fileSizeFormatted: formatSize(d.fileSize)
            }))
        }
    });
}));

/**
 * @route   GET /api/documents/:id
 * @desc    Get a single document
 * @access  Private
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
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

module.exports = router;
