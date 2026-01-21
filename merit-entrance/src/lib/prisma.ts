import { PrismaClient } from '@prisma/client';

// Singleton storage
let prismaInstance: PrismaClient | null = null;

// Get connection string at runtime
function getConnectionString(): string {
    const meritDbUrl = process.env.MERIT_DATABASE_URL;
    const meritDirectUrl = process.env.MERIT_DIRECT_URL;
    const dbUrl = process.env.DATABASE_URL;

    console.log('[Prisma] ENV CHECK:', {
        MERIT_DATABASE_URL: meritDbUrl ? `exists (${meritDbUrl.length} chars)` : 'undefined',
        MERIT_DIRECT_URL: meritDirectUrl ? `exists (${meritDirectUrl.length} chars)` : 'undefined',
        DATABASE_URL: dbUrl ? `exists (${dbUrl.length} chars)` : 'undefined',
    });

    const connectionString = meritDbUrl || meritDirectUrl || dbUrl;

    if (!connectionString) {
        const envKeys = Object.keys(process.env);
        console.log('[Prisma] All env keys count:', envKeys.length);
        console.log('[Prisma] DB-related keys:', envKeys.filter(k =>
            k.toLowerCase().includes('database') ||
            k.toLowerCase().includes('postgres') ||
            k.toLowerCase().includes('merit')
        ));
        throw new Error('Database connection string not found');
    }

    return connectionString.trim();
}

// Create Prisma client with dynamic imports
async function createClientAsync(): Promise<PrismaClient> {
    console.log('[Prisma] Creating new PrismaClient with dynamic imports...');

    const connectionString = getConnectionString();
    console.log('[Prisma] Connection string obtained, length:', connectionString.length);

    // Dynamic import to defer module loading to runtime
    const { neon } = await import('@neondatabase/serverless');
    const { PrismaNeon } = await import('@prisma/adapter-neon');

    console.log('[Prisma] Modules imported dynamically');

    const sql = neon(connectionString);
    console.log('[Prisma] Neon client created');

    // @ts-ignore
    const adapter = new PrismaNeon(sql);
    console.log('[Prisma] Neon adapter created');

    // @ts-ignore
    const client = new PrismaClient({ adapter });
    console.log('[Prisma] PrismaClient created successfully');

    return client;
}

// Synchronous getter that initializes async under the hood
let clientPromise: Promise<PrismaClient> | null = null;

export function getPrisma(): PrismaClient {
    // Return existing instance if available
    if (prismaInstance) {
        return prismaInstance;
    }

    // Start async initialization if not already started
    if (!clientPromise) {
        clientPromise = createClientAsync().then(client => {
            prismaInstance = client;
            return client;
        });
    }

    // For first call, throw to indicate async init needed
    throw new Error('Prisma client not yet initialized. Use getPrismaAsync() instead.');
}

// Async getter - preferred method
export async function getPrismaAsync(): Promise<PrismaClient> {
    if (prismaInstance) {
        return prismaInstance;
    }

    if (!clientPromise) {
        clientPromise = createClientAsync().then(client => {
            prismaInstance = client;
            return client;
        });
    }

    return clientPromise;
}

// For backwards compatibility - will be async-initialized
type AnyObject = { [key: string]: unknown };

export const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop: string | symbol) {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
            return undefined;
        }

        // Return async wrapper for all methods
        return async (...args: unknown[]) => {
            const client = await getPrismaAsync();
            const value = (client as unknown as AnyObject)[prop as string];
            if (typeof value === 'function') {
                return (value as (...a: unknown[]) => unknown).apply(client, args);
            }
            return value;
        };
    }
});

export default prisma;
