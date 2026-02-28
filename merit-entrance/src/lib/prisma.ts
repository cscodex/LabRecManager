// Prisma Client Singleton Pattern
import { PrismaClient } from '@prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeonHttp } from '@prisma/adapter-neon';

// Helper to get connection string
export function getConnectionString(): string {
    // Fallback for Next.js dev server hot-reload dropping env vars
    if (!process.env.MERIT_DATABASE_URL && process.env.NODE_ENV !== 'production') {
        const dotenv = require('dotenv');
        dotenv.config({ path: '.env' });
    }

    const connectionString = process.env.MERIT_DATABASE_URL
        || process.env.MERIT_DIRECT_URL
        || process.env.DATABASE_URL;

    console.log("getConnectionString resolved. Type:", typeof connectionString, "Length:", connectionString?.length, "Starts with:", connectionString?.substring(0, 15));

    if (!connectionString) {
        throw new Error('Database connection string not found');
    }

    // Fix for Next.js .env loading trailing invisible \r chars or strict quotes which break the pg URI parser
    let cleanDbUrl = connectionString.trim().replace(/^["']|["']$/g, '');

    // Ensure `postgres://` scheme is used, as `postgresql://` can sometimes break Neon's pg-connection-string polyfill
    if (cleanDbUrl.startsWith('postgresql://')) {
        cleanDbUrl = 'postgres://' + cleanDbUrl.substring(13);
    }

    return cleanDbUrl;
}

// Create a neon SQL client (HTTP)
import { neon } from '@neondatabase/serverless';
export function createSqlClient() {
    return neon(getConnectionString());
}

const prismaClientSingleton = () => {
    const connectionString = getConnectionString();
    process.env.DATABASE_URL = connectionString;

    console.log("☁️ INITIALIZING NEON HTTP ADAPTER");

    try {
        const adapter = new PrismaNeonHttp(connectionString, {
            fetchOptions: { cache: 'no-store' }
        });

        console.log("✅ PrismaNeonHttp initialized successfully");
        return new PrismaClient({ adapter, log: ['query', 'info', 'warn', 'error'] });
    } catch (e: any) {
        console.error("❌ PrismaNeonHttp initialization FAILED:", e.message);
        throw e;
    }
};

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// Export a shared sql client as default or named
let sqlClient: any;
try {
    sqlClient = neon(getConnectionString());
    console.log("✅ export const sql initialized successfully");
} catch (e: any) {
    console.error("❌ export const sql initialization FAILED:", e.message);
    sqlClient = null;
}
export const sql = sqlClient;
export default sql;
