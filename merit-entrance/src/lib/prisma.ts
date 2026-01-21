import { PrismaClient } from '@prisma/client';

// Singleton storage
let prismaInstance: PrismaClient | null = null;

// Create Prisma client - first try simple client, then Neon adapter
async function createClient(): Promise<PrismaClient> {
    console.log('[Prisma] Creating PrismaClient...');
    console.log('[Prisma] NODE_ENV:', process.env.NODE_ENV);
    console.log('[Prisma] MERIT_DATABASE_URL exists:', !!process.env.MERIT_DATABASE_URL);
    console.log('[Prisma] DATABASE_URL exists:', !!process.env.DATABASE_URL);

    // Try using standard Prisma client first (reads from schema.prisma)
    try {
        const client = new PrismaClient({
            log: ['error', 'warn'],
        });

        // Test the connection
        console.log('[Prisma] Testing connection...');
        await client.$connect();
        console.log('[Prisma] Standard PrismaClient connected successfully!');
        return client;
    } catch (standardError) {
        console.log('[Prisma] Standard client failed:', standardError instanceof Error ? standardError.message : standardError);

        // Fallback to Neon adapter for serverless
        console.log('[Prisma] Trying Neon adapter...');

        const connectionString = process.env.MERIT_DATABASE_URL
            || process.env.MERIT_DIRECT_URL
            || process.env.DATABASE_URL;

        if (!connectionString) {
            console.error('[Prisma] No connection string found!');
            console.error('[Prisma] Env keys:', Object.keys(process.env).filter(k =>
                k.includes('DATABASE') || k.includes('MERIT') || k.includes('POSTGRES')
            ));
            throw new Error('Database connection string not found');
        }

        // Dynamic import Neon
        const { neon } = await import('@neondatabase/serverless');
        const { PrismaNeon } = await import('@prisma/adapter-neon');

        const sql = neon(connectionString);
        // @ts-ignore
        const adapter = new PrismaNeon(sql);

        // @ts-ignore
        const neonClient = new PrismaClient({ adapter });
        console.log('[Prisma] Neon adapter client created');

        return neonClient;
    }
}

// Async getter
let clientPromise: Promise<PrismaClient> | null = null;

export async function getPrismaAsync(): Promise<PrismaClient> {
    if (prismaInstance) {
        return prismaInstance;
    }

    if (!clientPromise) {
        clientPromise = createClient().then(client => {
            prismaInstance = client;
            return client;
        }).catch(err => {
            clientPromise = null; // Reset on error so we can retry
            throw err;
        });
    }

    return clientPromise;
}

// Backwards compatible export - use getPrismaAsync in new code
type AnyObject = { [key: string]: unknown };

export const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop: string | symbol) {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
            return undefined;
        }

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
