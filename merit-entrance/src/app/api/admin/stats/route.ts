import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET() {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date().toISOString();

        const [examsResult, studentsResult, questionsResult, activeExamsResult] = await Promise.all([
            sql`SELECT COUNT(*) as count FROM exams`,
            sql`SELECT COUNT(*) as count FROM students`,
            sql`SELECT COUNT(*) as count FROM questions`,
            sql`
                SELECT COUNT(DISTINCT e.id) as count 
                FROM exams e
                JOIN exam_schedules es ON e.id = es.exam_id
                WHERE e.status = 'published'
                AND es.start_time <= ${now}::timestamptz
                AND es.end_time >= ${now}::timestamptz
            `,
        ]);

        return NextResponse.json({
            success: true,
            stats: {
                totalExams: Number(examsResult[0]?.count || 0),
                totalStudents: Number(studentsResult[0]?.count || 0),
                totalQuestions: Number(questionsResult[0]?.count || 0),
                activeExams: Number(activeExamsResult[0]?.count || 0),
            },
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
