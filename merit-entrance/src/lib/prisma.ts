import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure WebSocket for Node.js environment (required for Neon Pool)
neonConfig.webSocketConstructor = ws;

// Singleton storage
let prismaInstance: PrismaClient | null = null;
let initError: Error | null = null;

function getConnectionString(): string {
    const meritDbUrl = process.env.MERIT_DATABASE_URL;
    const meritDirectUrl = process.env.MERIT_DIRECT_URL;
    const dbUrl = process.env.DATABASE_URL;

    console.log('[Prisma] Checking env vars at runtime:');
    console.log('  MERIT_DATABASE_URL:', meritDbUrl ? `set (${meritDbUrl.length} chars)` : 'NOT SET');
    console.log('  MERIT_DIRECT_URL:', meritDirectUrl ? `set (${meritDirectUrl.length} chars)` : 'NOT SET');
    console.log('  DATABASE_URL:', dbUrl ? `set (${dbUrl.length} chars)` : 'NOT SET');

    const connectionString = meritDbUrl || meritDirectUrl || dbUrl;

    if (!connectionString) {
        throw new Error('MERIT_DATABASE_URL environment variable is not set');
    }

    return connectionString.trim();
}

function createClient(): PrismaClient {
    console.log('[Prisma] Initializing PrismaClient with Neon Pool adapter...');

    const connectionString = getConnectionString();
    console.log('[Prisma] Connection string starts with:', connectionString.substring(0, 30) + '...');

    // Create a Neon Pool with the connection string
    const pool = new Pool({ connectionString });
    console.log('[Prisma] Neon Pool created with WebSocket support');

    // Create adapter with the Pool
    // @ts-ignore - PrismaNeon types
    const adapter = new PrismaNeon(pool);
    console.log('[Prisma] Neon adapter created');

    // Create Prisma client with adapter
    // @ts-ignore - adapter type compatibility
    const client = new PrismaClient({ adapter });
    console.log('[Prisma] PrismaClient created successfully');

    return client;
}

// Initialize on first use
export function getPrisma(): PrismaClient {
    if (initError) {
        throw initError;
    }

    if (!prismaInstance) {
        try {
            prismaInstance = createClient();
        } catch (error) {
            initError = error instanceof Error ? error : new Error(String(error));
            console.error('[Prisma] Initialization failed:', initError.message);
            throw initError;
        }
    }

    return prismaInstance;
}

// Async version for compatibility
export async function getPrismaAsync(): Promise<PrismaClient> {
    return getPrisma();
}

// Debug function to check env vars
export function getEnvDebugInfo() {
    return {
        MERIT_DATABASE_URL: process.env.MERIT_DATABASE_URL ? 'SET' : 'NOT SET',
        MERIT_DIRECT_URL: process.env.MERIT_DIRECT_URL ? 'SET' : 'NOT SET',
        DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
        NODE_ENV: process.env.NODE_ENV,
        envCount: Object.keys(process.env).length,
    };
}

// Default export for backwards compatibility
export const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop: string | symbol) {
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
            return undefined;
        }
        const client = getPrisma();
        // @ts-ignore - dynamic property access
        const value = client[prop];
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    }
});

export default prisma;
