const { PrismaClient } = require('@prisma/client');

// Create a single instance of Prisma Client
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['info', 'warn', 'error']
        : ['error'],
});

// Track database status
let isDatabaseConnected = false;

// Query logging middleware (logs to query_logs table)
prisma.$use(async (params, next) => {
    // Skip logging for QueryLog operations to prevent infinite loop
    if (params.model === 'QueryLog') {
        return next(params);
    }

    const startTime = Date.now();
    let error = null;
    let result;

    try {
        result = await next(params);
    } catch (err) {
        error = err;
    }

    const duration = Date.now() - startTime;

    // Log to database asynchronously (don't await to avoid slowing down requests)
    // Only log if DB is connected and we're logging significant operations
    if (isDatabaseConnected && ['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'].includes(params.action)) {
        prisma.queryLog.create({
            data: {
                query: `${params.model}.${params.action}`,
                params: JSON.stringify(params.args || {}).substring(0, 5000), // Limit params size
                duration,
                error: error ? (error.message || String(error)).substring(0, 2000) : null,
                success: !error,
                model: params.model,
                action: params.action,
                // userId and userEmail would need to be passed via context - skipping for now
            }
        }).catch(logError => {
            // Silently fail query logging to avoid affecting main operations
            console.error('Query log failed:', logError.message);
        });
    }

    // Rethrow error if there was one
    if (error) {
        throw error;
    }

    return result;
});

// Test database connection with retries
async function testConnection(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await prisma.$connect();
            isDatabaseConnected = true;
            console.log('✅ Database connected successfully');
            return true;
        } catch (error) {
            console.error(`⚠️ Database connection attempt ${i + 1}/${retries} failed:`, error.message);
            if (i < retries - 1) {
                console.log('Retrying in 5 seconds...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }
    console.error('❌ Database connection failed after', retries, 'attempts');
    console.log('⚠️ Server will continue running - DB will reconnect when available');
    isDatabaseConnected = false;
    return false;
}

// Don't crash the server if DB is unavailable
testConnection().catch(() => {
    console.log('⚠️ Starting server without database connection');
});

// Handle graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

// Export connection status check function
prisma.isConnected = () => isDatabaseConnected;

// Reconnect function
prisma.reconnect = async () => {
    return testConnection(1);
};

module.exports = prisma;
