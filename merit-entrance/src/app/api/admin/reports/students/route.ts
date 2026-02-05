
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

        // Main student list with aggregated attempt stats
        const students = await sql`
            SELECT 
                s.id,
                s.name,
                s.email,
                s.roll_number,
                s.phone,
                s.class,
                s.school,
                s.state,
                s.district,
                s.is_active,
                s.created_at,
                COUNT(ea.id) as total_attempts,
                COALESCE(AVG(ea.total_score), 0) as avg_score,
                MAX(ea.started_at) as last_active
            FROM students s
            LEFT JOIN exam_attempts ea ON s.id = ea.student_id AND ea.status = 'submitted'
            GROUP BY s.id
            ORDER BY last_active DESC NULLS LAST, s.name ASC
        `;

        // Get best and worst exams for each student
        const bestWorstExams = await sql`
            WITH ranked_attempts AS (
                SELECT 
                    ea.student_id,
                    e.title as exam_title,
                    ea.total_score,
                    e.total_marks,
                    CASE WHEN e.total_marks > 0 THEN (ea.total_score::float / e.total_marks * 100) ELSE 0 END as percentage,
                    ROW_NUMBER() OVER (PARTITION BY ea.student_id ORDER BY (ea.total_score::float / NULLIF(e.total_marks, 0)) DESC) as best_rank,
                    ROW_NUMBER() OVER (PARTITION BY ea.student_id ORDER BY (ea.total_score::float / NULLIF(e.total_marks, 0)) ASC) as worst_rank
                FROM exam_attempts ea
                JOIN exams e ON ea.exam_id = e.id
                WHERE ea.status = 'submitted'
            )
            SELECT 
                student_id,
                MAX(CASE WHEN best_rank = 1 THEN exam_title END) as best_exam_title,
                MAX(CASE WHEN best_rank = 1 THEN percentage END) as best_exam_percentage,
                MAX(CASE WHEN worst_rank = 1 THEN exam_title END) as worst_exam_title,
                MAX(CASE WHEN worst_rank = 1 THEN percentage END) as worst_exam_percentage
            FROM ranked_attempts
            WHERE best_rank = 1 OR worst_rank = 1
            GROUP BY student_id
        `;

        // Create a map for quick lookup
        const examDataMap = new Map();
        for (const row of bestWorstExams) {
            examDataMap.set(row.student_id, {
                bestExam: row.best_exam_title ? {
                    title: typeof row.best_exam_title === 'string' ? JSON.parse(row.best_exam_title) : row.best_exam_title,
                    percentage: parseFloat(row.best_exam_percentage || 0).toFixed(1)
                } : null,
                worstExam: row.worst_exam_title ? {
                    title: typeof row.worst_exam_title === 'string' ? JSON.parse(row.worst_exam_title) : row.worst_exam_title,
                    percentage: parseFloat(row.worst_exam_percentage || 0).toFixed(1)
                } : null
            });
        }

        return NextResponse.json({
            success: true,
            students: students.map(s => {
                const examData = examDataMap.get(s.id) || { bestExam: null, worstExam: null };
                return {
                    id: s.id,
                    name: s.name,
                    email: s.email,
                    rollNumber: s.roll_number,
                    phone: s.phone,
                    class: s.class,
                    school: s.school,
                    state: s.state,
                    district: s.district,
                    isActive: s.is_active,
                    createdAt: s.created_at,
                    totalAttempts: parseInt(s.total_attempts) || 0,
                    avgScore: parseFloat(s.avg_score).toFixed(1),
                    lastActive: s.last_active,
                    bestExam: examData.bestExam,
                    worstExam: examData.worstExam
                };
            })
        });

    } catch (error) {
        console.error('Error fetching student report:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
