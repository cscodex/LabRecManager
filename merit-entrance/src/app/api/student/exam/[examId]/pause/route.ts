import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function POST(
    request: NextRequest,
    { params }: { params: { examId: string } }
) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { examId } = params;
        const studentId = session.id;

        // Get current attempt
        const attempts = await sql`
            SELECT id, started_at, paused_at FROM exam_attempts
            WHERE exam_id = ${examId} AND student_id = ${studentId} AND status = 'in_progress'
        `;

        if (attempts.length === 0) {
            return NextResponse.json({ error: 'No active attempt found' }, { status: 404 });
        }

        const attempt = attempts[0];

        // If already paused, do nothing
        if (attempt.paused_at) {
            return NextResponse.json({ success: true, message: 'Already paused' });
        }

        // Calculate time spent so far
        // time_spent = NOW - started_at
        const now = new Date();
        const startedAt = new Date(attempt.started_at);
        const timeSpentSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

        // Update DB
        await sql`
            UPDATE exam_attempts
            SET 
                paused_at = NOW(),
                time_spent = ${timeSpentSeconds}
            WHERE id = ${attempt.id}
        `;

        return NextResponse.json({ success: true, timeSpent: timeSpentSeconds });

    } catch (error) {
        console.error('Error pausing exam:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
