import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get assigned students
        const assignments = await sql`
      SELECT 
        ea.id,
        ea.student_id,
        ea.assigned_at,
        ea.max_attempts,
        ea.schedule_id,
        s.roll_number,
        s.name,
        es.start_time,
        es.end_time
      FROM exam_assignments ea
      JOIN students s ON ea.student_id = s.id
      LEFT JOIN exam_schedules es ON es.id = ea.schedule_id
      WHERE ea.exam_id = ${params.id}
      ORDER BY s.roll_number
    `;

        // Get all students for selection
        const allStudents = await sql`
      SELECT id, roll_number, name, class
      FROM students
      WHERE is_active = true
      ORDER BY roll_number
    `;

        return NextResponse.json({
            success: true,
            assignments,
            allStudents,
        });
    } catch (error) {
        console.error('Error fetching assignments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { studentIds, maxAttempts = 1, scheduleId = null } = body;

        if (!studentIds || !Array.isArray(studentIds)) {
            return NextResponse.json({ error: 'Student IDs are required' }, { status: 400 });
        }

        // Insert new assignments with maxAttempts and scheduleId
        for (const studentId of studentIds) {
            try {
                await sql`
          INSERT INTO exam_assignments (exam_id, student_id, max_attempts, schedule_id)
          VALUES (${params.id}, ${studentId}, ${maxAttempts}, ${scheduleId})
          ON CONFLICT (exam_id, student_id, schedule_id) DO UPDATE SET max_attempts = ${maxAttempts}
        `;
            } catch (e) {
                // Ignore errors
                console.error('Assignment error:', e);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error creating assignments:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get('studentId');

        if (studentId) {
            await sql`DELETE FROM exam_assignments WHERE exam_id = ${params.id} AND student_id = ${studentId}`;
        } else {
            await sql`DELETE FROM exam_assignments WHERE exam_id = ${params.id}`;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting assignment:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
