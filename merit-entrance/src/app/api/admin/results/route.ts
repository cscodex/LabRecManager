import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get exam-wise results
        const examResults = await sql`
            SELECT 
                e.id,
                e.title,
                e.total_marks,
                e.passing_marks,
                COUNT(DISTINCT ea.id) as total_attempts,
                COUNT(DISTINCT CASE WHEN ea.status = 'submitted' THEN ea.id END) as completed_attempts,
                AVG(CASE WHEN ea.status = 'submitted' THEN ea.total_score END) as avg_score,
                MAX(CASE WHEN ea.status = 'submitted' THEN ea.total_score END) as highest_score,
                MIN(CASE WHEN ea.status = 'submitted' THEN ea.total_score END) as lowest_score
            FROM exams e
            LEFT JOIN exam_attempts ea ON ea.exam_id = e.id
            WHERE e.status = 'published'
            GROUP BY e.id, e.title, e.total_marks, e.passing_marks
            ORDER BY e.created_at DESC
        `;

        const formattedExamResults = examResults.map((exam: any) => {
            const totalMarks = exam.total_marks || 100;
            const passingMarks = exam.passing_marks || Math.round(totalMarks * 0.4);
            const avgScore = exam.avg_score || 0;
            const completedCount = parseInt(exam.completed_attempts) || 0;

            // Calculate pass count (we need another query for this)
            const passRate = completedCount > 0
                ? Math.round((avgScore / totalMarks) * 100)
                : 0;

            return {
                id: exam.id,
                title: typeof exam.title === 'string' ? JSON.parse(exam.title) : exam.title,
                totalAttempts: parseInt(exam.total_attempts) || 0,
                completedAttempts: completedCount,
                averageScore: avgScore ? Math.round((avgScore / totalMarks) * 100) : 0,
                highestScore: exam.highest_score || 0,
                lowestScore: exam.lowest_score || 0,
                passRate: passRate,
                totalMarks: totalMarks,
            };
        });

        // Get recent attempts including paused/in-progress
        const recentAttempts = await sql`
            WITH AttemptCounts AS (
                SELECT 
                    id,
                    ROW_NUMBER() OVER (PARTITION BY student_id, exam_id ORDER BY started_at ASC) as attempt_number
                FROM exam_attempts
            )
            SELECT 
                ea.id,
                ea.student_id,
                s.name as student_name,
                s.roll_number,
                ea.exam_id,
                e.title as exam_title,
                e.total_marks,
                e.passing_marks,
                ea.total_score,
                ea.submitted_at,
                ea.started_at,
                ea.status,
                ea.paused_at,
                ac.attempt_number
            FROM exam_attempts ea
            JOIN students s ON ea.student_id = s.id
            JOIN exams e ON ea.exam_id = e.id
            JOIN AttemptCounts ac ON ea.id = ac.id
            ORDER BY ea.submitted_at DESC NULLS FIRST, ea.started_at DESC
            LIMIT 100
        `;

        const formattedAttempts = recentAttempts.map((attempt: any) => {
            const totalMarks = attempt.total_marks || 100;
            const passingMarks = attempt.passing_marks || Math.round(totalMarks * 0.4);
            const score = attempt.total_score || 0;
            const percentage = Math.round((score / totalMarks) * 100);

            // Calculate time taken
            let timeTaken = 0;
            if (attempt.started_at && attempt.submitted_at) {
                const start = new Date(attempt.started_at);
                const end = new Date(attempt.submitted_at);
                timeTaken = Math.round((end.getTime() - start.getTime()) / 60000);
            } else if (attempt.status === 'in_progress' && attempt.started_at) {
                // For in-progress, maybe show duration so far?
                const start = new Date(attempt.started_at);
                const now = new Date();
                timeTaken = Math.round((now.getTime() - start.getTime()) / 60000);
            }

            return {
                id: attempt.id,
                studentId: attempt.student_id,
                studentName: attempt.student_name,
                rollNumber: attempt.roll_number,
                examId: attempt.exam_id,
                examTitle: typeof attempt.exam_title === 'string' ? JSON.parse(attempt.exam_title) : attempt.exam_title,
                score: score,
                totalMarks: totalMarks,
                percentage: percentage,
                passed: attempt.status === 'submitted' ? (passingMarks ? score >= passingMarks : null) : null,
                submittedAt: attempt.submitted_at,
                startedAt: attempt.started_at,
                timeTaken: timeTaken > 0 ? timeTaken : 1,
                status: attempt.status,
                attemptNumber: parseInt(attempt.attempt_number) || 1,
            };
        });

        return NextResponse.json({
            success: true,
            examResults: formattedExamResults,
            recentAttempts: formattedAttempts,
        });
    } catch (error) {
        console.error('Error fetching results:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
