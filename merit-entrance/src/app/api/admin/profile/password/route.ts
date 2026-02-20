import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
        }

        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return NextResponse.json({
                error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
            }, { status: 400 });
        }

        const adminId = session.id;

        const admins = await sql`SELECT password_hash FROM admins WHERE id = ${adminId}`;
        if (admins.length === 0) {
            return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
        }

        const admin = admins[0];
        const isValid = await bcrypt.compare(currentPassword, admin.password_hash);

        if (!isValid) {
            return NextResponse.json({ error: 'Incorrect current password' }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await sql`
            UPDATE admins 
            SET password_hash = ${passwordHash}
            WHERE id = ${adminId}
        `;

        return NextResponse.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error updating admin password:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
