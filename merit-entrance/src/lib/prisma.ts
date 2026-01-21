import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
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

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
