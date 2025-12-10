const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { jwt: jwtConfig } = require('../config/constants');

/**
 * Middleware to authenticate JWT tokens
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
                messageHindi: 'पहुँच अस्वीकृत। कोई टोकन प्रदान नहीं किया गया।'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, jwtConfig.secret);

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                schoolId: true,
                email: true,
                role: true,
                firstName: true,
                lastName: true,
                preferredLanguage: true,
                isActive: true
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. User not found.',
                messageHindi: 'अमान्य टोकन। उपयोगकर्ता नहीं मिला।'
            });
        }

        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Contact administrator.',
                messageHindi: 'खाता निष्क्रिय है। प्रशासक से संपर्क करें।'
            });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.',
                messageHindi: 'अमान्य टोकन।'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired.',
                messageHindi: 'टोकन की समय सीमा समाप्त हो गई है।'
            });
        }
        next(error);
    }
};

/**
 * Middleware to authorize specific roles
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.',
                messageHindi: 'प्रमाणीकरण आवश्यक है।'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.',
                messageHindi: 'पहुँच अस्वीकृत। अपर्याप्त अनुमतियाँ।'
            });
        }

        next();
    };
};

/**
 * Middleware to check if user belongs to the same school
 */
const sameSchool = async (req, res, next) => {
    try {
        const { schoolId } = req.params;

        if (schoolId && req.user.schoolId !== schoolId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Not authorized for this school.',
                messageHindi: 'पहुँच अस्वीकृत। इस स्कूल के लिए अधिकृत नहीं।'
            });
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Optional authentication - continues even if no token
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jwtConfig.secret);

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                schoolId: true,
                email: true,
                role: true,
                firstName: true,
                lastName: true,
                preferredLanguage: true,
                isActive: true
            }
        });

        if (user && user.isActive) {
            req.user = user;
        }

        next();
    } catch (error) {
        // Continue without authentication on errors
        next();
    }
};

module.exports = {
    authenticate,
    authorize,
    sameSchool,
    optionalAuth
};
