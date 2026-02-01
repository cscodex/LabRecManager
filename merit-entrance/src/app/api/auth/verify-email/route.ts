import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.redirect(new URL('/?error=InvalidToken', request.url));
        }

        // Find student with this verification token
        const students = await sql`
            SELECT id, email, name, verification_expires
            FROM students
            WHERE verification_token = ${token}
        `;

        if (students.length === 0) {
            return NextResponse.redirect(new URL('/?error=InvalidToken', request.url));
        }

        const student = students[0];

        // Check if token has expired
        if (student.verification_expires && new Date(student.verification_expires) < new Date()) {
            return NextResponse.redirect(new URL('/student/verify-email?expired=true&email=' + encodeURIComponent(student.email), request.url));
        }

        // Mark email as verified
        await sql`
            UPDATE students
            SET email_verified = true,
                verification_token = NULL,
                verification_expires = NULL
            WHERE id = ${student.id}
        `;

        // Redirect to login with success message
        return NextResponse.redirect(new URL('/?verified=true', request.url));
    } catch (error) {
        console.error('Error verifying email:', error);
        return NextResponse.redirect(new URL('/?error=VerificationFailed', request.url));
    }
}
