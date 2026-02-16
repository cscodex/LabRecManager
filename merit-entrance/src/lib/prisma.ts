// Prisma Client Singleton Pattern
import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

// Required for Neon adapter in Node.js environments
neonConfig.webSocketConstructor = ws;

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

// Create a neon SQL client (HTTP)
import { neon } from '@neondatabase/serverless';
export function createSqlClient() {
    return neon(getConnectionString());
}

const prismaClientSingleton = () => {
    const connectionString = getConnectionString();
    const pool = new Pool({ connectionString });
    // @ts-ignore
    const adapter = new PrismaNeon(pool);

    return new PrismaClient({ adapter });
};

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// Export a shared sql client as default or named
export const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || process.env.DATABASE_URL || '');
export default sql;
