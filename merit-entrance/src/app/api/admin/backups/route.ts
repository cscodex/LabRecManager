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

        const backups = await sql`
            SELECT 
                bl.id,
                bl.type,
                bl.action,
                bl.status,
                bl.filename,
                bl.size,
                bl.created_at,
                a.name as admin_name
            FROM backup_logs bl
            LEFT JOIN admins a ON bl.admin_id = a.id
            ORDER BY bl.created_at DESC
            LIMIT 50
        `;

        return NextResponse.json({
            success: true,
            backups: backups.map(b => ({
                id: b.id,
                type: b.type,
                action: b.action,
                status: b.status,
                filename: b.filename,
                size: b.size,
                createdAt: b.created_at,
                adminName: b.admin_name || 'System'
            }))
        });
    } catch (error) {
        console.error('Error fetching backups:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
