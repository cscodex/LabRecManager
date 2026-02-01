import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const examId = searchParams.get('examId');
        const studentId = searchParams.get('studentId');
        const status = searchParams.get('status'); // 'submitted' | 'in_progress' | 'all'
        const attemptNumber = searchParams.get('attemptNumber'); // '1', '2', '3+'
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');

        // Fetch all attempts with computed attempt_number
        // We'll handle pagination and attempt filtering after the fetch
        const allAttempts = await sql`
            SELECT 
                ea.id,
                ea.exam_id,
                ea.student_id,
                ea.started_at,
                ea.submitted_at,
                ea.status,
                ea.total_score,
                e.title as exam_title,
                e.total_marks,
                e.passing_marks,
                s.name as student_name,
                s.roll_number,
                s.class,
                (
                    SELECT COALESCE(AVG(q.difficulty), 1)
                    FROM questions q
                    JOIN sections sec ON q.section_id = sec.id
                    WHERE sec.exam_id = e.id
                ) as exam_difficulty,
                (
                    SELECT COUNT(*)
                    FROM exam_attempts ea2
                    WHERE ea2.exam_id = ea.exam_id 
                    AND ea2.student_id = ea.student_id
                    AND ea2.started_at <= ea.started_at
                ) as attempt_number
            FROM exam_attempts ea
            JOIN exams e ON ea.exam_id = e.id
            JOIN students s ON ea.student_id = s.id
            ORDER BY ea.started_at DESC
        `;

        // Apply filters in memory
        let filteredAttempts = allAttempts.filter(a => {
            // Status filter
            if (status && status !== 'all' && a.status !== status) return false;
            // Exam filter
            if (examId && a.exam_id !== examId) return false;
            // Student filter
            if (studentId && a.student_id !== studentId) return false;
            // Date filters
            if (dateFrom && new Date(a.started_at) < new Date(dateFrom)) return false;
            if (dateTo && new Date(a.started_at) > new Date(dateTo)) return false;
            // Attempt number filter
            const attemptNum = parseInt(a.attempt_number) || 1;
            if (attemptNumber === '1' && attemptNum !== 1) return false;
            if (attemptNumber === '2' && attemptNum !== 2) return false;
            if (attemptNumber === '3+' && attemptNum < 3) return false;
            return true;
        });

        const totalCount = filteredAttempts.length;

        // Apply pagination
        const offset = (page - 1) * limit;
        const paginatedAttempts = filteredAttempts.slice(offset, offset + limit);

        // Format response
        const formattedAttempts = paginatedAttempts.map(a => {
            const percentage = a.total_marks > 0 && a.total_score !== null
                ? Math.round((parseFloat(a.total_score) / a.total_marks) * 100)
                : null;

            return {
                id: a.id,
                examId: a.exam_id,
                studentId: a.student_id,
                studentName: a.student_name,
                rollNumber: a.roll_number,
                class: a.class,
                examTitle: typeof a.exam_title === 'string' ? JSON.parse(a.exam_title) : a.exam_title,
                attemptNumber: parseInt(a.attempt_number) || 1,
                startedAt: a.started_at,
                submittedAt: a.submitted_at,
                status: a.status,
                score: a.total_score !== null ? parseFloat(a.total_score) : null,
                totalMarks: a.total_marks,
                passingMarks: a.passing_marks,
                percentage,
                passed: a.passing_marks ? (a.total_score >= a.passing_marks) : null,
                examDifficulty: parseFloat(a.exam_difficulty) || 1,
            };
        });

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
        console.error('Error fetching attempts:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
