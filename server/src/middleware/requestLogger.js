/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log request
    console.log(`→ ${req.method} ${req.path}`);

    // Log response on finish
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
        console.log(`← ${statusColor}${res.statusCode}\x1b[0m ${req.method} ${req.path} (${duration}ms)`);
    });

    next();
};

module.exports = { requestLogger };
