import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const success = searchParams.get('success');
        const route = searchParams.get('route');
        const search = searchParams.get('search');
        const offset = (page - 1) * limit;

        // Build query conditions
        let whereClause = 'WHERE 1=1';
        if (success !== null && success !== '') {
            whereClause += ` AND success = ${success === 'true'}`;
        }
        if (route) {
            whereClause += ` AND route ILIKE '%${route}%'`;
        }
        if (search) {
            whereClause += ` AND (route ILIKE '%${search}%' OR error ILIKE '%${search}%' OR query ILIKE '%${search}%')`;
        }

        // Get logs
        const logs = await sql`
            SELECT id, route, method, query, params, success, error, duration, user_id, created_at
            FROM query_logs
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        // Get total count
        const countResult = await sql`SELECT COUNT(*) as total FROM query_logs`;
        const total = parseInt(countResult[0]?.total || '0');

        // Get stats
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

        const stats = await sql`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE success = false) as errors,
                COUNT(*) FILTER (WHERE created_at >= ${last24h.toISOString()}) as last_24h,
                COUNT(*) FILTER (WHERE created_at >= ${last24h.toISOString()} AND success = false) as last_24h_errors,
                COUNT(*) FILTER (WHERE created_at >= ${lastHour.toISOString()}) as last_hour,
                AVG(duration) FILTER (WHERE created_at >= ${last24h.toISOString()}) as avg_duration
            FROM query_logs
        `;

        const s = stats[0];

        return NextResponse.json({
            success: true,
            data: {
                logs,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                },
                stats: {
                    total: parseInt(s.total) || 0,
                    totalErrors: parseInt(s.errors) || 0,
                    errorRate: s.total > 0 ? ((s.errors / s.total) * 100).toFixed(2) : '0',
                    last24h: {
                        total: parseInt(s.last_24h) || 0,
                        errors: parseInt(s.last_24h_errors) || 0,
                        errorRate: s.last_24h > 0 ? ((s.last_24h_errors / s.last_24h) * 100).toFixed(2) : '0'
                    },
                    lastHour: parseInt(s.last_hour) || 0,
                    avgDurationMs: Math.round(parseFloat(s.avg_duration) || 0)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching query logs:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ error: 'Unauthorized - superadmin only' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const days = parseFloat(searchParams.get('days') || '7');

        let deletedCount = 0;
        if (days >= 9999) {
            // Delete all
            const result = await sql`DELETE FROM query_logs`;
            deletedCount = result.length;
        } else {
            // Delete logs older than X days
            const cutoff = new Date();
            cutoff.setTime(cutoff.getTime() - days * 24 * 60 * 60 * 1000);
            const result = await sql`DELETE FROM query_logs WHERE created_at >= ${cutoff.toISOString()}`;
            deletedCount = result.length;
        }

        return NextResponse.json({
            success: true,
            message: `Cleared ${deletedCount} logs`
        });
    } catch (error) {
        console.error('Error clearing query logs:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
    }
}
