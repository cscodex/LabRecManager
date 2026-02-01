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

        // Find student with this reset token
        const students = await sql`
            SELECT id, email, name, verification_expires
            FROM students
            WHERE verification_token = ${token}
        `;

        if (students.length === 0) {
            return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
        }

        const student = students[0];

        // Check if token has expired
        if (student.verification_expires && new Date(student.verification_expires) < new Date()) {
            return NextResponse.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 400 });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(password, 10);

        // Update password and clear reset token
        await sql`
            UPDATE students
            SET password_hash = ${passwordHash},
                verification_token = NULL,
                verification_expires = NULL
            WHERE id = ${student.id}
        `;

        return NextResponse.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
