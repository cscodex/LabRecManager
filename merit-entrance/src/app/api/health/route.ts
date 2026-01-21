import { NextResponse } from 'next/server';
import { getEnvDebugInfo } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Get debug info about environment variables
        const envInfo = getEnvDebugInfo();

        // Also check raw env vars
        const rawEnvCheck = {
            MERIT_DATABASE_URL_exists: !!process.env.MERIT_DATABASE_URL,
            MERIT_DATABASE_URL_length: process.env.MERIT_DATABASE_URL?.length || 0,
            MERIT_DIRECT_URL_exists: !!process.env.MERIT_DIRECT_URL,
            DATABASE_URL_exists: !!process.env.DATABASE_URL,
            NODE_ENV: process.env.NODE_ENV,
            totalEnvVars: Object.keys(process.env).length,
            // Show some env var names (not values for security)
            sampleEnvKeys: Object.keys(process.env)
                .filter(k => !k.includes('SECRET') && !k.includes('PASSWORD') && !k.includes('KEY'))
                .slice(0, 30),
        };

        return NextResponse.json({
            status: 'ok',
            prismaEnvInfo: envInfo,
            rawEnvCheck,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}
