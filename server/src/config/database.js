const { PrismaClient } = require('@prisma/client');

// Create a single instance of Prisma Client with query logging
const prisma = new PrismaClient({
    log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
    ],
});

// Track database status
let isDatabaseConnected = false;

// Store recent queries for debugging (in-memory, last 100)
const recentQueries = [];
const MAX_RECENT_QUERIES = 100;

// Listen for query events and capture actual SQL
prisma.$on('query', (e) => {
    const queryInfo = {
        query: e.query,
        params: e.params,
        duration: e.duration,
        timestamp: new Date().toISOString()
    };

    // Store in memory for debugging
    recentQueries.push(queryInfo);
    if (recentQueries.length > MAX_RECENT_QUERIES) {
        recentQueries.shift();
    }

    // Log slow queries (>500ms)
    if (e.duration > 500) {
        console.log(`⚠️ Slow query (${e.duration}ms):`, e.query.substring(0, 200));
    }
});

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
    // Log all operations now, not just writes
    if (isDatabaseConnected) {
        const paramsStr = JSON.stringify(params.args || {});

        prisma.queryLog.create({
            data: {
                query: `${params.model}.${params.action}`,
                params: paramsStr.substring(0, 5000),
                duration,
                error: error ? `${error.message}\n${error.stack || ''}`.substring(0, 2000) : null,
                success: !error,
                model: params.model,
                action: params.action,
            }
        }).catch(logError => {
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

// Export recent queries for debugging API
prisma.getRecentQueries = () => [...recentQueries];

module.exports = prisma;
