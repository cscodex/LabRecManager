const { PrismaClient } = require('@prisma/client');

// Create a single instance of Prisma Client
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['info', 'warn', 'error']  // Removed 'query' to reduce noise
        : ['error'],
});

// Track database status
let isDatabaseConnected = false;

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
