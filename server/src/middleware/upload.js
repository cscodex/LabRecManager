const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { upload: uploadConfig } = require('../config/constants');

// Ensure upload directories exist
const createUploadDirs = () => {
    const dirs = [
        'uploads/assignments',
        'uploads/submissions',
        'uploads/profiles',
        'uploads/viva-recordings',
        'uploads/reports'
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

createUploadDirs();

// Storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'uploads/';

        // Determine upload path based on route
        if (req.baseUrl.includes('assignments')) {
            uploadPath += 'assignments/';
        } else if (req.baseUrl.includes('submissions')) {
            uploadPath += 'submissions/';
        } else if (req.baseUrl.includes('users') || req.baseUrl.includes('profile')) {
            uploadPath += 'profiles/';
        } else if (req.baseUrl.includes('viva')) {
            uploadPath += 'viva-recordings/';
        } else {
            uploadPath += 'misc/';
        }

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const ext = path.extname(file.originalname);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${uniqueId}-${safeName}`);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const allAllowed = [
        ...uploadConfig.allowedTypes.document,
        ...uploadConfig.allowedTypes.code,
        ...uploadConfig.allowedTypes.image,
        ...uploadConfig.allowedTypes.archive
    ];

    if (allAllowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type .${ext} is not allowed. Allowed types: ${allAllowed.join(', ')}`), false);
    }
};

// Create multer upload instances
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: uploadConfig.maxFileSize
    }
});

// Different upload configurations
const uploadSingle = upload.single('file');
const uploadMultiple = upload.array('files', 10);
const uploadFields = upload.fields([
    { name: 'code', maxCount: 1 },
    { name: 'output', maxCount: 5 },
    { name: 'attachments', maxCount: 10 }
]);

// Middleware wrapper with error handling
const handleUpload = (uploadFn) => (req, res, next) => {
    uploadFn(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: `File too large. Maximum size is ${uploadConfig.maxFileSize / (1024 * 1024)}MB`,
                    messageHindi: `फ़ाइल बहुत बड़ी है। अधिकतम आकार ${uploadConfig.maxFileSize / (1024 * 1024)}MB है`
                });
            }
            return res.status(400).json({
                success: false,
                message: err.message,
                messageHindi: 'फ़ाइल अपलोड त्रुटि'
            });
        } else if (err) {
            return res.status(400).json({
                success: false,
                message: err.message,
                messageHindi: 'फ़ाइल अपलोड विफल'
            });
        }
        next();
    });
};

module.exports = {
    uploadSingle: handleUpload(uploadSingle),
    uploadMultiple: handleUpload(uploadMultiple),
    uploadFields: handleUpload(uploadFields)
};
