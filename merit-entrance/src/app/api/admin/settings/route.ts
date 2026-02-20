
import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/logger';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all settings
        const settings = await sql`SELECT key, value FROM system_settings`;

        // Transform array to object
        const settingsObj: Record<string, any> = {};
        settings.forEach((s: any) => {
            try {
                settingsObj[s.key] = JSON.parse(s.value);
            } catch {
                settingsObj[s.key] = s.value;
            }
        });

        return NextResponse.json({ success: true, settings: settingsObj });
    } catch (error) {
        console.error('Error fetching settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { settings } = body;

        if (!settings || typeof settings !== 'object') {
            return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 });
        }

        const now = new Date().toISOString();

        // Upsert each setting
        for (const [key, value] of Object.entries(settings)) {
            await sql`
                INSERT INTO system_settings (key, value, updated_at)
                VALUES (${key}, ${JSON.stringify(value)}, ${now})
                ON CONFLICT (key) 
                DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
            `;
        }

        await logActivity('update_settings', 'Updated system settings', { adminId: session.id });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
