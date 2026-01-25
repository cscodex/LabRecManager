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

        // Get exams assigned to this student - each assignment is a separate entry
        const assignments = await sql`
            SELECT 
                ea.id as assignment_id,
                ea.max_attempts,
                ea.schedule_id,
                e.id as exam_id,
                e.title,
                e.duration,
                e.total_marks,
                e.status,
                e.instructions,
                COALESCE(es.start_time, es_default.start_time) as start_time,
                COALESCE(es.end_time, es_default.end_time) as end_time,
                (
                    SELECT COUNT(*) FROM exam_attempts 
                    WHERE exam_id = e.id AND student_id = ${studentId}
                ) as attempt_count,
                (
                    SELECT status FROM exam_attempts 
                    WHERE exam_id = e.id AND student_id = ${studentId}
                    ORDER BY started_at DESC LIMIT 1
                ) as last_attempt_status,
                (
                    SELECT COUNT(*) FROM sections WHERE exam_id = e.id
                ) as section_count,
                (
                    SELECT COUNT(*) FROM questions q 
                    JOIN sections s ON q.section_id = s.id 
                    WHERE s.exam_id = e.id AND q.type != 'paragraph'
                ) as question_count
            FROM exam_assignments ea
            JOIN exams e ON ea.exam_id = e.id
            LEFT JOIN exam_schedules es ON es.id = ea.schedule_id
            LEFT JOIN LATERAL (
                SELECT start_time, end_time FROM exam_schedules 
                WHERE exam_id = e.id 
                ORDER BY start_time ASC LIMIT 1
            ) es_default ON es.id IS NULL
            WHERE ea.student_id = ${studentId}
              AND e.status = 'published'
            ORDER BY COALESCE(es.start_time, es_default.start_time) ASC
        `;

        const formattedExams = assignments
            .filter((a: any) => a.start_time && a.end_time)
            .map((a: any) => ({
                id: a.exam_id,
                assignmentId: a.assignment_id,
                title: a.title as Record<string, string>,
                duration: a.duration,
                totalMarks: a.total_marks,
                instructions: a.instructions,
                sectionCount: parseInt(a.section_count) || 0,
                questionCount: parseInt(a.question_count) || 0,
                maxAttempts: a.max_attempts,
                attemptCount: parseInt(a.attempt_count) || 0,
                schedule: {
                    startTime: a.start_time,
                    endTime: a.end_time,
                },
                hasAttempted: a.last_attempt_status === 'submitted',
                canAttempt: (parseInt(a.attempt_count) || 0) < a.max_attempts,
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
