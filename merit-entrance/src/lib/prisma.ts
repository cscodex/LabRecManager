// Prisma Client Singleton Pattern
import { PrismaClient } from '@prisma/client';
import { neon } from '@neondatabase/serverless';

// Helper to get connection string
export function getConnectionString(): string {
    const connectionString = process.env.MERIT_DATABASE_URL
        || process.env.MERIT_DIRECT_URL
        || process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error('Database connection string not found');
    }

    return connectionString;
}

// Create a neon SQL client
export function createSqlClient() {
    return neon(getConnectionString());
}

const prismaClientSingleton = () => {
    return new PrismaClient({
        datasources: {
            db: {
                url: getConnectionString(),
            },
        },
    });
};

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// Export a shared sql client as default or named
export const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || process.env.DATABASE_URL || '');
export default sql;
