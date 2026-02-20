import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { token, password } = await request.json();

        if (!token || !password) {
            return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
        }

        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return NextResponse.json({
                error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
            }, { status: 400 });
        }

        // Find user with this reset token in both tables
        let user: any = null;
        let type = 'student';

        const students = await sql`
            SELECT id, email, name, verification_expires
            FROM students
            WHERE verification_token = ${token}
        `;

        if (students.length > 0) {
            user = students[0];
        } else {
            const admins = await sql`
                SELECT id, email, name, verification_expires
                FROM admins
                WHERE verification_token = ${token}
            `;
            if (admins.length > 0) {
                user = admins[0];
                type = 'admin';
            }
        }

        if (!user) {
            console.log(`Password Reset Failed: Token not found in DB. Received: ${token.substring(0, 10)}...`);
            return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
        }

        // Check if token has expired
        if (user.verification_expires) {
            const expiryDate = new Date(user.verification_expires);
            // 24 hours expiry to account for any timezone drifts
            const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const now = new Date();

            console.log('Password Reset Check:', {
                expiry: expiryDate.toISOString(),
                now: now.toISOString(),
                isExpired: expiryDate < now,
                diffMinutes: (expiryDate.getTime() - now.getTime()) / 1000 / 60
            });

            if (expiryDate < now) {
                return NextResponse.json({
                    error: `Reset link has expired. (Expires: ${expiryDate.toLocaleString()}, Now: ${now.toLocaleString()})`
                }, { status: 400 });
            }
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(password, 10);

        // Update password and clear reset token
        if (type === 'admin') {
            await sql`
                UPDATE admins
                SET password_hash = ${passwordHash},
                    verification_token = NULL,
                    verification_expires = NULL
                WHERE id = ${user.id}
            `;
        } else {
            await sql`
                UPDATE students
                SET password_hash = ${passwordHash},
                    verification_token = NULL,
                    verification_expires = NULL
                WHERE id = ${user.id}
            `;
        }

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
