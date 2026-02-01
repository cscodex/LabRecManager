import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// GET - Get auto-assign settings for an exam
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const exams = await sql`
            SELECT auto_assign, auto_assign_attempts
            FROM exams
            WHERE id = ${params.id}
        `;

        if (exams.length === 0) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            autoAssign: exams[0].auto_assign,
            attempts: exams[0].auto_assign_attempts
        });
    } catch (error) {
        console.error('Error fetching auto-assign settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH - Update auto-assign settings
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { autoAssign, attempts = 3 } = body;

        // Validate attempts
        if (attempts < 1 || attempts > 10) {
            return NextResponse.json({ error: 'Attempts must be between 1 and 10' }, { status: 400 });
        }

        await sql`
            UPDATE exams
            SET auto_assign = ${autoAssign},
                auto_assign_attempts = ${attempts}
            WHERE id = ${params.id}
        `;

        return NextResponse.json({
            success: true,
            message: autoAssign
                ? `Exam will be auto-assigned to new students with ${attempts} attempts`
                : 'Auto-assign disabled for this exam'
        });
    } catch (error) {
        console.error('Error updating auto-assign settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
