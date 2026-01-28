import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const logs = await sql`
            SELECT 
                eal.id,
                eal.action,
                eal.max_attempts,
                eal.created_at,
                s.name as student_name,
                s.roll_number,
                a.name as admin_name
            FROM exam_assignment_logs eal
            LEFT JOIN students s ON eal.student_id = s.id
            LEFT JOIN admins a ON eal.assigned_by = a.id
            WHERE eal.exam_id = ${params.id}
            ORDER BY eal.created_at DESC
            LIMIT 100
        `;

        return NextResponse.json({
            success: true,
            logs: logs.map(log => ({
                id: log.id,
                action: log.action,
                maxAttempts: log.max_attempts,
                createdAt: log.created_at,
                studentName: log.student_name,
                rollNumber: log.roll_number,
                adminName: log.admin_name || 'System'
            }))
        });
    } catch (error) {
        console.error('Error fetching assignment logs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
