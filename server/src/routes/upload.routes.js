const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { uploadImage, uploadVideo } = require('../utils/cloudinary');

/**
 * @route   POST /api/upload/document
 * @desc    Upload a document (PDF/image) for procurement
 */
router.post('/document', authenticate, uploadImage.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const fileUrl = req.file.path;
        const fileName = req.file.originalname || req.file.filename;

        res.json({
            success: true,
            data: {
                url: fileUrl,
                name: fileName,
                publicId: req.file.filename
            },
            message: 'File uploaded successfully'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
    }
});

/**
 * @route   POST /api/upload/video
 * @desc    Upload a video for receiving verification
 */
router.post('/video', authenticate, uploadVideo.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No video uploaded' });
        }

        const fileUrl = req.file.path;
        const fileName = req.file.originalname || req.file.filename;

        res.json({
            success: true,
            data: {
                url: fileUrl,
                name: fileName,
                publicId: req.file.filename
            },
            message: 'Video uploaded successfully'
        });
    } catch (error) {
        console.error('Video upload error:', error);
        res.status(500).json({ success: false, message: 'Video upload failed', error: error.message });
    }
});

/**
 * @route   POST /api/upload/procurement/:requestId/:field
 * @desc    Upload and save to specific procurement field
 */
router.post('/procurement/:requestId/:field', authenticate, uploadImage.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const { requestId, field } = req.params;
        const fileUrl = req.file.path;
        const fileName = req.file.originalname || req.file.filename;

        // Map field names to DB columns
        const fieldMap = {
            'purchaseLetter': { urlField: 'purchaseLetterUrl', nameField: 'purchaseLetterName' },
            'po': { urlField: 'poUrl', nameField: null },
            'bill': { urlField: 'billUrl', nameField: null },
            'cheque': { urlField: 'chequeUrl', nameField: null },
            'receivingVideo': { urlField: 'receivingVideoUrl', nameField: null }
        };

        const mapping = fieldMap[field];
        if (!mapping) {
            return res.status(400).json({ success: false, message: 'Invalid field type' });
        }

        // Build update data
        const updateData = { [mapping.urlField]: fileUrl };
        if (mapping.nameField) {
            updateData[mapping.nameField] = fileName;
        }

        // Update the procurement request
        const request = await prisma.procurementRequest.update({
            where: { id: requestId },
            data: updateData
        });

        res.json({
            success: true,
            data: {
                url: fileUrl,
                name: fileName,
                request
            },
            message: `${field} uploaded successfully`
        });
    } catch (error) {
        console.error('Procurement upload error:', error);
        res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
    }
});

/**
 * @route   POST /api/upload/quotation/:quotationId
 * @desc    Upload quotation document for a specific quotation
 */
router.post('/quotation/:quotationId', authenticate, uploadImage.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const { quotationId } = req.params;
        const fileUrl = req.file.path;

        const quotation = await prisma.vendorQuotation.update({
            where: { id: quotationId },
            data: { documentUrl: fileUrl }
        });

        res.json({
            success: true,
            data: {
                url: fileUrl,
                quotation
            },
            message: 'Quotation document uploaded'
        });
    } catch (error) {
        console.error('Quotation upload error:', error);
        res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
    }
});

module.exports = router;
