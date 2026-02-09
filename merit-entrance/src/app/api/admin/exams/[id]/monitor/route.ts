import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

// Get live monitoring data for an exam
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: examId } = await params;

        // Get exam info
        const exams = await sql`
            SELECT title, duration FROM exams WHERE id = ${examId}
        `;

        if (exams.length === 0) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        }

        const exam = exams[0];
        const durationSeconds = exam.duration * 60;

        // Get all in-progress attempts with student info and progress
        // Try with current_question_id first, fall back without it
        let attempts;
        try {
            attempts = await sql`
                SELECT 
                    ea.id as attempt_id,
                    ea.started_at,
                    ea.current_question_id,
                    s.name as student_name,
                    s.roll_number,
                    (SELECT COUNT(*) FROM question_responses qr WHERE qr.attempt_id = ea.id AND qr.answer IS NOT NULL AND qr.answer::text != 'null' AND qr.answer::text != '[]') as answered_count
                FROM exam_attempts ea
                JOIN students s ON ea.student_id = s.id
                WHERE ea.exam_id = ${examId} AND ea.status = 'in_progress'
                ORDER BY ea.started_at ASC
            `;
        } catch (err) {
            console.warn('current_question_id column may not exist, falling back:', err);
            attempts = await sql`
                SELECT 
                    ea.id as attempt_id,
                    ea.started_at,
                    s.name as student_name,
                    s.roll_number,
                    (SELECT COUNT(*) FROM question_responses qr WHERE qr.attempt_id = ea.id AND qr.answer IS NOT NULL AND qr.answer::text != 'null' AND qr.answer::text != '[]') as answered_count
                FROM exam_attempts ea
                JOIN students s ON ea.student_id = s.id
                WHERE ea.exam_id = ${examId} AND ea.status = 'in_progress'
                ORDER BY ea.started_at ASC
            `;
        }

        // Get total questions count for this exam
        const questionCountResult = await sql`
            SELECT COUNT(*) as total FROM questions q
            JOIN sections s ON q.section_id = s.id
            WHERE s.exam_id = ${examId}
        `;
        const totalQuestions = parseInt(questionCountResult[0]?.total || '0');

        // Calculate remaining time and format data
        const now = Date.now();
        const activeStudents = attempts.map((attempt: any) => {
            const startedAt = new Date(attempt.started_at).getTime();
            const elapsedSeconds = Math.floor((now - startedAt) / 1000);
            const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);

            return {
                attemptId: attempt.attempt_id,
                studentName: attempt.student_name,
                rollNumber: attempt.roll_number,
                startedAt: attempt.started_at,
                remainingSeconds,
                answeredCount: parseInt(attempt.answered_count || '0'),
                currentQuestionId: attempt.current_question_id || null, // Ensure explicit null if undefined
                totalQuestions
            };
        });

        return NextResponse.json({
            success: true,
            examTitle: typeof exam.title === 'string' ? JSON.parse(exam.title) : exam.title,
            duration: exam.duration,
            totalQuestions,
            activeCount: activeStudents.length,
            students: activeStudents
        });
    } catch (error) {
        console.error('Error fetching monitor data:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
