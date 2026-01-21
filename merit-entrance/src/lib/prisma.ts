import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
    // Check multiple possible environment variable names
    const connectionString = process.env.MERIT_DATABASE_URL
        || process.env.MERIT_DIRECT_URL
        || process.env.DATABASE_URL
        || process.env.DIRECT_URL;

    // Log which variable was found (for debugging)
    console.log('[Prisma] Connection string found from:',
        process.env.MERIT_DATABASE_URL ? 'MERIT_DATABASE_URL' :
            process.env.MERIT_DIRECT_URL ? 'MERIT_DIRECT_URL' :
                process.env.DATABASE_URL ? 'DATABASE_URL' :
                    process.env.DIRECT_URL ? 'DIRECT_URL' : 'NONE'
    );

    if (!connectionString) {
        console.error('[Prisma] Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('NEON') || k.includes('MERIT')));
        throw new Error('Database connection string not found. Set MERIT_DATABASE_URL or DATABASE_URL.');
    }

    // For Prisma 7 with Neon - use Pool with type assertion
    const pool = new Pool({ connectionString });
    // @ts-ignore - Prisma adapter type mismatch between versions
    const adapter = new PrismaNeon(pool);

    // @ts-ignore - adapter type
    return new PrismaClient({ adapter });
}

// Use a getter to ensure lazy initialization at runtime, not build time
function getPrismaClient(): PrismaClient {
    if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = createPrismaClient();
    }
    return globalForPrisma.prisma;
}

// Export a proxy object that lazily initializes Prisma on first access
const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop) {
        const client = getPrismaClient();
        return Reflect.get(client, prop);
    }
});

export { prisma };
export default prisma;
