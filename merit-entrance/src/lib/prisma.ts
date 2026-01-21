import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

function getConnectionString(): string {
    // Check multiple possible environment variable names
    const connectionString = process.env.MERIT_DATABASE_URL
        || process.env.MERIT_DIRECT_URL
        || process.env.DATABASE_URL
        || process.env.DIRECT_URL;

    // Log which variable was found (for debugging)
    console.log('[Prisma] Checking env vars:',
        'MERIT_DATABASE_URL:', !!process.env.MERIT_DATABASE_URL,
        'MERIT_DIRECT_URL:', !!process.env.MERIT_DIRECT_URL,
        'DATABASE_URL:', !!process.env.DATABASE_URL
    );

    if (!connectionString) {
        console.error('[Prisma] Available env vars:', Object.keys(process.env).filter(k =>
            k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('NEON') || k.includes('MERIT')
        ));
        throw new Error('Database connection string not found. Set MERIT_DATABASE_URL or DATABASE_URL.');
    }

    return connectionString;
}

function createPrismaClient(): PrismaClient {
    const connectionString = getConnectionString();

    // Use neon() function which is the HTTP-based driver
    const sql = neon(connectionString);

    // @ts-ignore - Prisma adapter type
    const adapter = new PrismaNeon(sql);

    // @ts-ignore - adapter type
    return new PrismaClient({ adapter });
}

// Lazy getter function - creates client on first access
function getPrismaClient(): PrismaClient {
    if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = createPrismaClient();
    }
    return globalForPrisma.prisma;
}

// Create a getter-based export that delays initialization
const prismaHandler = {
    get client(): PrismaClient {
        return getPrismaClient();
    }
};

// For backwards compatibility with existing imports
export const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop: string | symbol) {
        const client = getPrismaClient();
        const value = (client as any)[prop];
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    }
});

export default prisma;
