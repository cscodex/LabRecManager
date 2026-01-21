import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// One-time migration endpoint - run this once then delete
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ error: 'Unauthorized - superadmin only' }, { status: 401 });
        }

        // Add instructions column to exams table
        await sql`
            ALTER TABLE exams 
            ADD COLUMN IF NOT EXISTS instructions JSONB
        `;

        return NextResponse.json({
            success: true,
            message: 'Migration completed: instructions column added to exams table'
        });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({
            error: 'Migration failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
