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
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');

        const offset = (page - 1) * limit;

        // Build dynamic query conditions
        let whereConditions = [];
        if (examId) whereConditions.push(`ea.exam_id = '${examId}'`);
        if (studentId) whereConditions.push(`ea.student_id = '${studentId}'`);
        if (status && status !== 'all') whereConditions.push(`ea.status = '${status}'`);
        if (dateFrom) whereConditions.push(`ea.started_at >= '${dateFrom}'::timestamptz`);
        if (dateTo) whereConditions.push(`ea.started_at <= '${dateTo}'::timestamptz`);

        const whereClause = whereConditions.length > 0
            ? `WHERE ${whereConditions.join(' AND ')}`
            : '';

        // Get total count for pagination
        const countResult = await sql`
            SELECT COUNT(*) as total 
            FROM exam_attempts ea
            ${sql.unsafe(whereClause)}
        `;
        const totalCount = parseInt(countResult[0]?.total || '0');

        // Get attempts with all required data
        const attempts = await sql`
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
            ${sql.unsafe(whereClause)}
            ORDER BY ea.started_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        // Format response
        const formattedAttempts = attempts.map(a => {
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
