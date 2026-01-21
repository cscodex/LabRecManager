import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Check environment variables
        const envInfo = {
            MERIT_DATABASE_URL: process.env.MERIT_DATABASE_URL ? 'SET' : 'NOT SET',
            MERIT_DIRECT_URL: process.env.MERIT_DIRECT_URL ? 'SET' : 'NOT SET',
            DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
            NODE_ENV: process.env.NODE_ENV,
            envCount: Object.keys(process.env).length,
        };

        return NextResponse.json({
            status: 'ok',
            envInfo,
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
