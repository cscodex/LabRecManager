import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
    const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL;

    if (!connectionString) {
        throw new Error('Database connection string not found');
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
