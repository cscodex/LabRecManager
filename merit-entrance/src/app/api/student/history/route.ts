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
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;

        // Get total count for pagination
        const countResult = await sql`
            SELECT COUNT(*) as total 
            FROM exam_attempts 
            WHERE student_id = ${studentId}
        `;
        const totalCount = parseInt(countResult[0]?.total || '0');

        // Fetch exam attempts with exam details, attempt numbers, and difficulty
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
                    FROM exam_attempts ea2
                    WHERE ea2.exam_id = ea.exam_id 
                    AND ea2.student_id = ea.student_id
                    AND ea2.started_at <= ea.started_at
                ) as attempt_number,
                (
                    SELECT COALESCE(AVG(q.difficulty), 1)
                    FROM questions q
                    JOIN sections sec ON q.section_id = sec.id
                    WHERE sec.exam_id = e.id
                ) as exam_difficulty,
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
            LIMIT ${limit} OFFSET ${offset}
        `;

        const formattedAttempts = attempts.map((attempt) => ({
            id: attempt.attempt_id,
            examId: attempt.exam_id,
            title: attempt.title,
            startedAt: attempt.started_at,
            submittedAt: attempt.submitted_at,
            status: attempt.status,
            score: attempt.score,
            totalMarks: attempt.total_marks,
            attemptNumber: parseInt(attempt.attempt_number) || 1,
            examDifficulty: parseFloat(attempt.exam_difficulty) || 1,
            attemptedQuestions: parseInt(attempt.attempted_questions) || 0,
            totalQuestions: parseInt(attempt.total_questions) || 0,
            percentage: attempt.total_marks > 0 && attempt.score !== null
                ? Math.round((parseFloat(attempt.score) / attempt.total_marks) * 100)
                : null,
        }));

        return NextResponse.json({
            success: true,
            attempts: formattedAttempts,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit),
            }
        });
    } catch (error) {
        console.error('Error fetching exam history:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

