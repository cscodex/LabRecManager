/**
 * Request logging middleware - logs all API activities to database
 */
const prisma = require('../config/database');

// Routes to skip logging (health checks, static, etc.)
const SKIP_ROUTES = ['/api/health', '/favicon.ico', '/_next'];

// Map HTTP methods to action types
const METHOD_TO_ACTION = {
    'GET': 'view',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
};

// Extract entity type from path
const getEntityType = (path) => {
    const parts = path.replace('/api/', '').split('/');
    if (parts[0]) {
        const entity = parts[0].replace(/-/g, '_');
        if (entity === 'auth') {
            if (parts[1] === 'login') return 'session';
            if (parts[1] === 'logout') return 'session';
            return 'auth';
        }
        return entity.replace(/s$/, '');
    }
    return 'unknown';
};

// Get action type from method and path
const getActionType = (method, path) => {
    if (path.includes('/login')) return 'login';
    if (path.includes('/logout')) return 'logout';
    if (path.includes('/upload')) return 'upload';
    if (path.includes('/download')) return 'download';
    if (path.includes('/publish')) return 'publish';
    if (path.includes('/approve')) return 'approve';
    if (path.includes('/reject')) return 'reject';
    if (path.includes('/submit')) return 'submit';
    if (path.includes('/assign')) return 'assign';
    if (path.includes('/grade')) return 'grade';
    return METHOD_TO_ACTION[method] || 'unknown';
};

const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Skip certain routes
    if (SKIP_ROUTES.some(r => req.path.startsWith(r))) {
        return next();
    }

    // Log request to console
    console.log(`→ ${req.method} ${req.path}`);

    // Capture original end to log after response
    const originalEnd = res.end;
    res.end = function (...args) {
        const duration = Date.now() - start;
        const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
        console.log(`← ${statusColor}${res.statusCode}\x1b[0m ${req.method} ${req.path} (${duration}ms)`);

        // Log to database (async, don't wait)
        if (req.path.startsWith('/api/') && req.method !== 'OPTIONS' && req.user?.id) {
            const entityType = getEntityType(req.path);
            const actionType = getActionType(req.method, req.path);
            const pathParts = req.path.split('/');
            const entityId = pathParts.find(p => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p));

            let description = `${req.method} ${req.path}`;
            if (res.statusCode >= 400) {
                description += ` (Error: ${res.statusCode})`;
            }

            prisma.activityLog.create({
                data: {
                    userId: req.user.id,
                    schoolId: req.user.schoolId || null,
                    actionType: actionType,
                    action_type: actionType,
                    entityType: entityType,
                    entityId: entityId || null,
                    description: description.substring(0, 500),
                    ipAddress: req.ip || req.connection?.remoteAddress || null,
                    userAgent: (req.headers['user-agent'] || '').substring(0, 255),
                    metadata: {
                        method: req.method,
                        path: req.path,
                        statusCode: res.statusCode,
                        duration: duration
                    }
                }
            }).catch(err => {
                console.error('Activity log failed:', err.message);
            });
        }

        return originalEnd.apply(res, args);
    };

    next();
};

module.exports = { requestLogger };
