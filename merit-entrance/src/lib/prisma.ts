import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';

// Singleton storage
let prismaInstance: PrismaClient | null = null;

// Get connection string at runtime
function getConnectionString(): string {
    // Log ALL environment variables for debugging
    const allEnvKeys = Object.keys(process.env);
    console.log('[Prisma Debug] Total env vars:', allEnvKeys.length);
    console.log('[Prisma Debug] Relevant env vars:', allEnvKeys.filter(k =>
        k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('NEON') ||
        k.includes('MERIT') || k.includes('NODE') || k.includes('URL')
    ));

    // Check each variable explicitly
    const meritDbUrl = process.env.MERIT_DATABASE_URL;
    const meritDirectUrl = process.env.MERIT_DIRECT_URL;
    const dbUrl = process.env.DATABASE_URL;

    console.log('[Prisma Debug] MERIT_DATABASE_URL exists:', !!meritDbUrl, 'length:', meritDbUrl?.length);
    console.log('[Prisma Debug] MERIT_DIRECT_URL exists:', !!meritDirectUrl, 'length:', meritDirectUrl?.length);
    console.log('[Prisma Debug] DATABASE_URL exists:', !!dbUrl, 'length:', dbUrl?.length);

    const connectionString = meritDbUrl || meritDirectUrl || dbUrl;

    if (!connectionString) {
        throw new Error(`Database connection string not found. Checked: MERIT_DATABASE_URL, MERIT_DIRECT_URL, DATABASE_URL`);
    }

    return connectionString;
}

// Create Prisma client - only called at runtime
function createClient(): PrismaClient {
    console.log('[Prisma] Creating new PrismaClient...');

    const connectionString = getConnectionString();
    console.log('[Prisma] Connection string obtained, length:', connectionString.length);

    // Use neon HTTP driver
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

// Export getter function that lazily creates client
export function getPrisma(): PrismaClient {
    if (!prismaInstance) {
        prismaInstance = createClient();
    }
    return prismaInstance;
}

// For backwards compatibility - use direct getter call in API routes instead
export const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop: string | symbol) {
        if (prop === 'then') {
            // Prevent Promise detection
            return undefined;
        }
        const client = getPrisma();
        const value = (client as Record<string | symbol, unknown>)[prop];
        if (typeof value === 'function') {
            return (value as Function).bind(client);
        }
        return value;
    }
});

export default prisma;
