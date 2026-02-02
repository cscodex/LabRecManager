import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL!);

export async function GET() {
    try {
        const session = await getSession();

        if (!session || session.role !== 'student') {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const studentId = session.id;

        // Get exam results for this student
        const results = await sql`
            SELECT 
                ea.id,
                ea.exam_id,
                ea.total_score as score,
                ea.submitted_at,
                e.title,
                e.total_marks
            FROM exam_attempts ea
            JOIN exams e ON e.id = ea.exam_id
            WHERE ea.student_id = ${studentId}
            AND ea.submitted_at IS NOT NULL
            ORDER BY ea.submitted_at DESC
        `;

        // Get student details (phone info)
        const studentInfo = await sql`
            SELECT phone, phone_verified 
            FROM students 
            WHERE id = ${studentId}
        `;

        const examResults = results.map(r => ({
            id: r.exam_id,
            title: typeof r.title === 'string' ? JSON.parse(r.title) : r.title,
            score: parseFloat(r.score) || 0,
            totalMarks: r.total_marks,
            submittedAt: r.submitted_at
        }));

        return NextResponse.json({
            success: true,
            examResults,
            student: studentInfo[0] || {}
        });
    } catch (error) {
        console.error('Profile API error:', error);
        return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
    }
}
