import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool } from '@neondatabase/serverless';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
    // For Prisma 7 with Neon, use the adapter
    const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL;

    if (!connectionString) {
        throw new Error('Database connection string not found');
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);

    return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
