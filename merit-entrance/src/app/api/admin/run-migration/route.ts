import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET() {
    try {
        const sql = neon(process.env.MERIT_DIRECT_URL || '');
        await sql`ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "verification_token" TEXT`;
        await sql`ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "verification_expires" TIMESTAMP(3)`;
        return NextResponse.json({ success: true, message: 'Migration applied successfully' });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
