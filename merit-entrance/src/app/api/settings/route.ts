import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET() {
    try {
        // Fetch only safe, public settings
        const settings = await sql`SELECT key, value FROM system_settings WHERE key IN ('siteName', 'siteLogoUrl')`;

        const settingsObj: Record<string, any> = {
            siteName: 'Merit Entrance',
            siteLogoUrl: '/default-logo.png'
        };

        settings.forEach((s: any) => {
            try {
                settingsObj[s.key] = JSON.parse(s.value);
            } catch {
                settingsObj[s.key] = s.value;
            }
        });

        // Ensure defaults if missing or empty
        if (!settingsObj.siteName) settingsObj.siteName = 'Merit Entrance';
        if (!settingsObj.siteLogoUrl) settingsObj.siteLogoUrl = '/default-logo.png';

        return NextResponse.json(
            { success: true, settings: settingsObj },
            { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
        );
    } catch (error) {
        console.error('Error fetching public settings:', error);
        return NextResponse.json(
            { success: true, settings: { siteName: 'Merit Entrance', siteLogoUrl: '/default-logo.png' } },
            { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
        );
    }
}
