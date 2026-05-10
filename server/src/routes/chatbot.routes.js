/**
 * Admin AI Chatbot Routes
 * POST /api/admin/chatbot/chat    — Send a message to the AI
 * POST /api/admin/chatbot/upload  — Upload a document for AI to read
 * GET  /api/admin/chatbot/schema  — Get/refresh the database schema
 * POST /api/admin/chatbot/execute — Execute a SQL query from the chat
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const chatbotService = require('../services/chatbot.service');
const prisma = require('../config/database');

// File upload config — 10MB limit
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'text/plain', 'text/csv', 'application/json',
            'application/pdf', 'text/markdown',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (allowedTypes.includes(file.mimetype) ||
            file.originalname.match(/\.(txt|csv|json|pdf|md|sql|log)$/i)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
        }
    }
});

/**
 * @route   POST /api/admin/chatbot/chat
 * @desc    Send a message to the AI chatbot
 * @access  Private (Admin only)
 */
router.post('/chat', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const { message, conversationHistory = [], documentContext = '' } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length < 1) {
        return res.status(400).json({
            success: false,
            message: 'Message is required'
        });
    }

    try {
        const result = await chatbotService.chat(message.trim(), {
            conversationHistory,
            documentContext,
            userId: req.user.id
        });

        // Log AI chatbot usage
        prisma.activityLog.create({
            data: {
                userId: req.user.id,
                schoolId: req.user.schoolId,
                actionType: 'other',
                action_type: 'ai_chatbot',
                description: `AI Chatbot: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
                entityType: 'ai_chatbot',
                metadata: {
                    messageLength: message.length,
                    hadSQL: !!result.sql,
                    hadQueryResult: !!result.queryResult
                }
            }
        }).catch(err => console.warn('[ChatBot] Activity log failed:', err.message));

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[ChatBot Route] Error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message || 'AI chat failed'
        });
    }
}));

/**
 * @route   POST /api/admin/chatbot/upload
 * @desc    Upload a document for the AI to read
 * @access  Private (Admin only)
 */
router.post('/upload', authenticate, authorize('admin', 'principal'), upload.single('document'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'Please upload a document'
        });
    }

    try {
        const text = chatbotService.extractDocumentText(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname
        );

        res.json({
            success: true,
            data: {
                fileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                extractedText: text,
                charCount: text.length,
                preview: text.substring(0, 500) + (text.length > 500 ? '...' : '')
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Failed to process document: ${error.message}`
        });
    }
}));

/**
 * @route   GET /api/admin/chatbot/schema
 * @desc    Get or refresh the database schema
 * @access  Private (Admin only)
 */
router.get('/schema', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const forceRefresh = req.query.refresh === 'true';

    let schema;
    if (forceRefresh) {
        schema = await chatbotService.refreshSchema();
    } else {
        schema = await chatbotService.getSchema();
    }

    res.json({
        success: true,
        data: {
            schema,
            cachedAt: chatbotService.schemaCachedAt
                ? new Date(chatbotService.schemaCachedAt).toISOString()
                : null,
            refreshed: forceRefresh
        }
    });
}));

/**
 * @route   POST /api/admin/chatbot/execute
 * @desc    Execute a SQL query from the chat interface
 * @access  Private (Admin only)
 */
router.post('/execute', authenticate, authorize('admin'), asyncHandler(async (req, res) => {
    const { sql } = req.body;

    if (!sql || typeof sql !== 'string' || sql.trim().length < 3) {
        return res.status(400).json({
            success: false,
            message: 'SQL query is required'
        });
    }

    // Log this operation
    console.warn(`[ChatBot SQL] Admin ${req.user.email} executing:`, sql.substring(0, 100));

    const result = await chatbotService.executeSQL(sql.trim());

    // Audit log
    prisma.activityLog.create({
        data: {
            userId: req.user.id,
            schoolId: req.user.schoolId,
            actionType: 'other',
            action_type: 'ai_chatbot_sql',
            description: `AI Chatbot SQL: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`,
            entityType: 'sql_execution',
            metadata: { sql: sql.substring(0, 500), success: result.success, rowCount: result.rowCount }
        }
    }).catch(err => console.warn('[ChatBot] Activity log failed:', err.message));

    if (result.success) {
        res.json({ success: true, data: result });
    } else {
        res.status(400).json({
            success: false,
            message: result.error,
            detail: result.detail,
            hint: result.hint
        });
    }
}));

module.exports = router;
