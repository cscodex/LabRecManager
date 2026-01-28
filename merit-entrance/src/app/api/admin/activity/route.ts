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

        const logs = await sql`
            SELECT 
                al.id,
                al.action,
                al.message,
                al.metadata,
                al.created_at,
                a.name as admin_name
            FROM activity_logs al
            LEFT JOIN admins a ON al.admin_id = a.id
            ORDER BY al.created_at DESC
            LIMIT 100
        `;

        return NextResponse.json({
            success: true,
            logs: logs.map(log => ({
                id: log.id,
                action: log.action,
                message: log.message,
                metadata: log.metadata,
                createdAt: log.created_at,
                adminName: log.admin_name || 'System'
            }))
        });
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
