
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

        const students = await sql`
            SELECT 
                s.id,
                s.name,
                s.email,
                s.roll_number,
                s.is_active,
                COUNT(ea.id) as total_attempts,
                COALESCE(AVG(ea.total_score), 0) as avg_score,
                MAX(ea.started_at) as last_active
            FROM students s
            LEFT JOIN exam_attempts ea ON s.id = ea.student_id AND ea.status = 'submitted'
            GROUP BY s.id
            ORDER BY last_active DESC NULLS LAST, s.name ASC
        `;

        return NextResponse.json({
            success: true,
            students: students.map(s => ({
                id: s.id,
                name: s.name,
                email: s.email,
                rollNumber: s.roll_number,
                isActive: s.is_active,
                totalAttempts: parseInt(s.total_attempts) || 0,
                avgScore: parseFloat(s.avg_score).toFixed(1),
                lastActive: s.last_active
            }))
        });

    } catch (error) {
        console.error('Error fetching student report:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
