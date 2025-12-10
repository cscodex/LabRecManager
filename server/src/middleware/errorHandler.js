/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Prisma errors
    if (err.code) {
        switch (err.code) {
            case 'P2002':
                return res.status(409).json({
                    success: false,
                    message: `A record with this ${err.meta?.target?.join(', ') || 'field'} already exists.`,
                    messageHindi: `इस ${err.meta?.target?.join(', ') || 'फ़ील्ड'} के साथ एक रिकॉर्ड पहले से मौजूद है।`
                });
            case 'P2025':
                return res.status(404).json({
                    success: false,
                    message: 'Record not found.',
                    messageHindi: 'रिकॉर्ड नहीं मिला।'
                });
            case 'P2003':
                return res.status(400).json({
                    success: false,
                    message: 'Invalid reference. Related record does not exist.',
                    messageHindi: 'अमान्य संदर्भ। संबंधित रिकॉर्ड मौजूद नहीं है।'
                });
        }
    }

    // Validation errors from express-validator
    if (err.array && typeof err.array === 'function') {
        return res.status(400).json({
            success: false,
            message: 'Validation failed.',
            messageHindi: 'सत्यापन विफल।',
            errors: err.array()
        });
    }

    // Custom application errors
    if (err.statusCode) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            messageHindi: err.messageHindi || err.message
        });
    }

    // Default server error
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development'
            ? err.message
            : 'Internal server error.',
        messageHindi: 'आंतरिक सर्वर त्रुटि।',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

/**
 * Custom Error class with multi-language support
 */
class AppError extends Error {
    constructor(message, statusCode, messageHindi = null) {
        super(message);
        this.statusCode = statusCode;
        this.messageHindi = messageHindi;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Async handler to wrap async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    AppError,
    asyncHandler
};
