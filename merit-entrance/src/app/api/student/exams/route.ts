import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const studentId = session.id;

        // Get exams assigned to this student with their schedules
        const exams = await sql`
            SELECT 
                e.id,
                e.title,
                e.duration,
                e.total_marks,
                e.status,
                es.start_time,
                es.end_time,
                (
                    SELECT status FROM exam_attempts 
                    WHERE exam_id = e.id AND student_id = ${studentId}
                    ORDER BY started_at DESC LIMIT 1
                ) as attempt_status
            FROM exam_assignments ea
            JOIN exams e ON ea.exam_id = e.id
            LEFT JOIN (
                SELECT DISTINCT ON (exam_id) exam_id, start_time, end_time
                FROM exam_schedules
                ORDER BY exam_id, start_time ASC
            ) es ON es.exam_id = e.id
            WHERE ea.student_id = ${studentId}
              AND e.status = 'published'
            ORDER BY es.start_time ASC
        `;

        const formattedExams = exams
            .filter((exam: any) => exam.start_time && exam.end_time)
            .map((exam: any) => ({
                id: exam.id,
                title: exam.title as Record<string, string>,
                duration: exam.duration,
                totalMarks: exam.total_marks,
                schedule: {
                    startTime: exam.start_time,
                    endTime: exam.end_time,
                },
                hasAttempted: exam.attempt_status === 'submitted',
            }));

        return NextResponse.json({
            success: true,
            exams: formattedExams,
        });
    } catch (error) {
        console.error('Error fetching student exams:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
