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

        const schedules = await sql`
      SELECT id, start_time, end_time
      FROM exam_schedules
      WHERE exam_id = ${params.id}
      ORDER BY start_time
    `;

        return NextResponse.json({
            success: true,
            schedules,
        });
    } catch (error) {
        console.error('Error fetching schedules:', error);
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
        const { startTime, endTime } = body;

        if (!startTime || !endTime) {
            return NextResponse.json({ error: 'Start and end times are required' }, { status: 400 });
        }

        const result = await sql`
      INSERT INTO exam_schedules (exam_id, start_time, end_time)
      VALUES (${params.id}, ${startTime}, ${endTime})
      RETURNING id
    `;

        return NextResponse.json({
            success: true,
            scheduleId: result[0].id,
        });
    } catch (error) {
        console.error('Error creating schedule:', error);
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
        const scheduleId = searchParams.get('scheduleId');

        if (scheduleId) {
            await sql`DELETE FROM exam_schedules WHERE id = ${scheduleId} AND exam_id = ${params.id}`;
        } else {
            await sql`DELETE FROM exam_schedules WHERE exam_id = ${params.id}`;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
