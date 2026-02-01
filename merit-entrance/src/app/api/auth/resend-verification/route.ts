import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { sendVerificationEmail, generateVerificationToken, getVerificationExpiry } from '@/lib/email';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Find student with this email
        const students = await sql`
            SELECT id, email, name, email_verified, verification_expires
            FROM students
            WHERE email = ${email}
        `;

        if (students.length === 0) {
            return NextResponse.json({ error: 'Email not found' }, { status: 404 });
        }

        const student = students[0];

        if (student.email_verified) {
            return NextResponse.json({ error: 'Email already verified' }, { status: 400 });
        }

        // Generate new verification token
        const token = generateVerificationToken();
        const expires = getVerificationExpiry();

        // Update student with new token
        await sql`
            UPDATE students
            SET verification_token = ${token},
                verification_expires = ${expires.toISOString()}
            WHERE id = ${student.id}
        `;

        // Send verification email
        const sent = await sendVerificationEmail(student.email, student.name, token);

        if (!sent) {
            return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Verification email sent',
            expiresAt: expires.toISOString()
        });
    } catch (error) {
        console.error('Error resending verification:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
