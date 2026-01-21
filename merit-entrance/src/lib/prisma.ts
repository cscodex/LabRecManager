import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';

// Singleton storage
let prismaInstance: PrismaClient | null = null;

// Get connection string at runtime
function getConnectionString(): string {
    // Check each variable explicitly and log
    const meritDbUrl = process.env.MERIT_DATABASE_URL;
    const meritDirectUrl = process.env.MERIT_DIRECT_URL;
    const dbUrl = process.env.DATABASE_URL;

    console.log('[Prisma] ENV CHECK:', {
        MERIT_DATABASE_URL: meritDbUrl ? `exists (${meritDbUrl.length} chars)` : 'undefined',
        MERIT_DIRECT_URL: meritDirectUrl ? `exists (${meritDirectUrl.length} chars)` : 'undefined',
        DATABASE_URL: dbUrl ? `exists (${dbUrl.length} chars)` : 'undefined',
    });

    let connectionString = meritDbUrl || meritDirectUrl || dbUrl;

    if (!connectionString) {
        // Last resort - log all env vars with DB/URL in name
        const envKeys = Object.keys(process.env);
        console.log('[Prisma] All env keys:', envKeys.slice(0, 50));
        console.log('[Prisma] DB-related keys:', envKeys.filter(k =>
            k.toLowerCase().includes('database') ||
            k.toLowerCase().includes('postgres') ||
            k.toLowerCase().includes('merit') ||
            k.toLowerCase().includes('url')
        ));
        throw new Error('Database connection string not found');
    }

    // Remove any surrounding quotes that might have been added accidentally
    connectionString = connectionString.trim().replace(/^["']|["']$/g, '');

    console.log('[Prisma] Connection string starts with:', connectionString.substring(0, 30));

    return connectionString;
}

// Create Prisma client
function createClient(): PrismaClient {
    console.log('[Prisma] Creating new PrismaClient...');

    const connectionString = getConnectionString();

    try {
        // Use neon HTTP driver
        console.log('[Prisma] Calling neon() with connection string...');
        const sql = neon(connectionString);
        console.log('[Prisma] Neon client created successfully');

        // @ts-ignore
        const adapter = new PrismaNeon(sql);
        console.log('[Prisma] Neon adapter created');

        // @ts-ignore
        const client = new PrismaClient({ adapter });
        console.log('[Prisma] PrismaClient created successfully');

        return client;
    } catch (error) {
        console.error('[Prisma] Error creating client:', error);
        throw error;
    }
}

// Export getter function
export function getPrisma(): PrismaClient {
    if (!prismaInstance) {
        prismaInstance = createClient();
    }
    return prismaInstance;
}

// Proxy for lazy init
type AnyObject = { [key: string]: unknown };

export const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop: string | symbol) {
        if (prop === 'then') {
            return undefined;
        }
        const client = getPrisma();
        const value = (client as unknown as AnyObject)[prop as string];
        if (typeof value === 'function') {
            return (value as (...args: unknown[]) => unknown).bind(client);
        }
        return value;
    }
});

export default prisma;
