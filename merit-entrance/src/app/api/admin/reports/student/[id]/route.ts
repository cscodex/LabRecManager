import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Fetch Student Details
        const student = await sql`
            SELECT id, name, roll_number, email, created_at 
            FROM students 
            WHERE id = ${id}
        `;

        if (student.length === 0) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // Fetch All Attempts
        const attempts = await sql`
            SELECT 
                ea.id,
                ea.exam_id,
                e.title as exam_title,
                ea.total_score,
                e.total_marks,
                ea.status,
                ea.submitted_at,
                ea.started_at,
                (
                    SELECT AVG(q.difficulty)
                    FROM questions q
                    JOIN sections s ON q.section_id = s.id
                    WHERE s.exam_id = e.id
                ) as avg_difficulty
            FROM exam_attempts ea
            JOIN exams e ON ea.exam_id = e.id
            WHERE ea.student_id = ${id}
            ORDER BY ea.submitted_at DESC NULLS FIRST, ea.started_at DESC
        `;

        // Calculate Stats
        const completedAttempts = attempts.filter(a => a.status === 'submitted');
        const avgScore = completedAttempts.length > 0
            ? completedAttempts.reduce((sum, a) => sum + (a.total_score || 0), 0) / completedAttempts.length
            : 0;

        // Calculate Avg Percentage
        const avgPercentage = completedAttempts.length > 0
            ? completedAttempts.reduce((sum, a) => sum + ((a.total_score / a.total_marks) * 100), 0) / completedAttempts.length
            : 0;

        const report = {
            student: student[0],
            stats: {
                totalAttempts: attempts.length,
                completedAttempts: completedAttempts.length,
                averageScore: Math.round(avgScore),
                averagePercentage: Math.round(avgPercentage),
            },
            history: attempts.map(a => ({
                id: a.id,
                examTitle: typeof a.exam_title === 'string' ? JSON.parse(a.exam_title) : a.exam_title,
                score: a.total_score,
                totalMarks: a.total_marks,
                percentage: a.total_score ? Math.round((a.total_score / a.total_marks) * 100) : 0,
                avgDifficulty: a.avg_difficulty ? parseFloat(a.avg_difficulty).toFixed(1) : '1.0',
                performanceRating: (a.total_score && a.avg_difficulty)
                    ? ((a.total_score / a.total_marks) * a.avg_difficulty).toFixed(2)
                    : '0.00',
                status: a.status,
                date: a.submitted_at || a.started_at
            }))
        };

        return NextResponse.json({ success: true, report });
    } catch (error) {
        console.error('Error fetching student report:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
