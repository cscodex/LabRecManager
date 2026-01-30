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

        // Parallel queries for efficiency
        const [
            studentCount,
            examCount,
            attemptStats,
            recentActivity
        ] = await Promise.all([
            // Total Students
            sql`SELECT COUNT(*) as count FROM students`,

            // Total Published Exams
            sql`SELECT COUNT(*) as count FROM exams WHERE status = 'published'`,

            // Attempt Stats (Total, Avg Score, Pass Rate)
            sql`
                SELECT 
                    COUNT(*) as total_attempts,
                    AVG(total_score) as avg_score,
                    COUNT(CASE WHEN total_score >= (
                        SELECT passing_marks FROM exams WHERE id = exam_attempts.exam_id
                    ) THEN 1 END) as passed_count
                FROM exam_attempts 
                WHERE status = 'submitted'
            `,

            // Recent Activity
            sql`
                SELECT action_type, description, created_at
                FROM activity_logs
                ORDER BY created_at DESC
                LIMIT 5
            `
        ]);

        console.log('DEBUG: Stats Query Results:', {
            studentCount,
            examCount,
            attemptStats,
        });

        const totalAttempts = parseInt(attemptStats[0].total_attempts) || 0;
        const passedCount = parseInt(attemptStats[0].passed_count) || 0;

        const stats = {
            totalStudents: parseInt(studentCount[0].count) || 0,
            totalExams: parseInt(examCount[0].count) || 0,
            totalAttempts: totalAttempts,
            avgScore: Math.round(attemptStats[0].avg_score || 0),
            passRate: totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0,
            recentActivity: recentActivity.map(a => ({
                action: a.action_type,
                description: a.description,
                timestamp: a.created_at
            }))
        };

        return NextResponse.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching global stats:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
