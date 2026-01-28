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

        // Fetch exam attempts with exam details
        const attempts = await sql`
            SELECT 
                ea.id as attempt_id,
                ea.exam_id,
                ea.started_at,
                ea.submitted_at,
                ea.status,
                ea.total_score as score,
                e.title,
                e.total_marks,
                (
                    SELECT COUNT(*)
                    FROM question_responses qr
                    WHERE qr.attempt_id = ea.id
                ) as attempted_questions,
                (
                     SELECT COUNT(*) 
                     FROM questions q 
                     JOIN sections s ON q.section_id = s.id 
                     WHERE s.exam_id = e.id AND q.type != 'paragraph'
                ) as total_questions
            FROM exam_attempts ea
            JOIN exams e ON ea.exam_id = e.id
            WHERE ea.student_id = ${studentId}
            ORDER BY ea.started_at DESC
        `;

        console.log(`Found ${attempts.length} attempts for student ${studentId}`);

        const formattedAttempts = attempts.map((attempt) => ({
            id: attempt.attempt_id,
            examId: attempt.exam_id,
            title: attempt.title,
            startedAt: attempt.started_at,
            submittedAt: attempt.submitted_at,
            status: attempt.status,
            score: attempt.score,
            totalMarks: attempt.total_marks,
            attemptedQuestions: parseInt(attempt.attempted_questions) || 0,
            totalQuestions: parseInt(attempt.total_questions) || 0,
        }));

        return NextResponse.json({
            success: true,
            attempts: formattedAttempts,
        });
    } catch (error) {
        console.error('Error fetching exam history:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
