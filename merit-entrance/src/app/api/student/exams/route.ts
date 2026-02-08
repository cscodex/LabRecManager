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

        // Cleanup: Auto-submit "in_progress" exams that have exceeded duration + 5 mins buffer
        // Note: pause functionality was removed, so we no longer check paused_at
        try {
            await sql`
                UPDATE exam_attempts ea
                SET 
                    status = 'submitted',
                    submitted_at = NOW(),
                    auto_submit = true
                FROM exams e
                WHERE ea.exam_id = e.id
                AND ea.student_id = ${studentId}
                AND ea.status = 'in_progress'
                AND (ea.started_at + (e.duration * interval '1 minute') + interval '5 minutes') < NOW()
            `;
        } catch (cleanupErr) {
            console.warn('Cleanup query failed (non-critical):', cleanupErr);
        }

        // Get exams assigned to this student - each assignment is a separate entry
        // If schedule_id is NULL, the exam is "always open" (no time restrictions)
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
                es.start_time,
                es.end_time,
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
            WHERE ea.student_id = ${studentId}
              AND e.status = 'published'
            ORDER BY es.start_time ASC NULLS FIRST
        `;

        const formattedExams = assignments.map((a: any) => {
            // If no schedule (schedule_id is NULL), the exam is "always open"
            const isAlwaysOpen = !a.schedule_id || (!a.start_time && !a.end_time);

            return {
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
                isAlwaysOpen,
                schedule: isAlwaysOpen ? null : {
                    startTime: a.start_time,
                    endTime: a.end_time,
                },
                hasAttempted: a.last_attempt_status === 'submitted',
                lastAttemptStatus: a.last_attempt_status,
                canAttempt: (parseInt(a.attempt_count) || 0) < a.max_attempts,
            };
        });

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
