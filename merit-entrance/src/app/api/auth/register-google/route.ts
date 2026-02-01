import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { sendVerificationEmail, generateVerificationToken, getVerificationExpiry } from '@/lib/email';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { name, email, phone, class: studentClass, school, googleId } = await request.json();

        if (!name || !email) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
        }

        // Check if email already exists
        const existing = await sql`
            SELECT id FROM students WHERE email = ${email}
        `;

        if (existing.length > 0) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
        }

        // Generate roll number and verification token
        const rollNumber = `GOOGLE${Date.now().toString().slice(-8)}`;
        const tempPassword = await bcrypt.hash(Math.random().toString(36), 10);
        const verificationToken = generateVerificationToken();
        const verificationExpires = getVerificationExpiry();

        // Create student account
        await sql`
            INSERT INTO students (
                roll_number, 
                name, 
                email, 
                phone,
                class,
                school,
                password_hash, 
                is_active,
                email_verified,
                verification_token,
                verification_expires,
                google_id
            )
            VALUES (
                ${rollNumber}, 
                ${name}, 
                ${email}, 
                ${phone || null},
                ${studentClass || null},
                ${school || null},
                ${tempPassword}, 
                true,
                false,
                ${verificationToken},
                ${verificationExpires.toISOString()},
                ${googleId || null}
            )
        `;

        // Send verification email
        const emailSent = await sendVerificationEmail(email, name, verificationToken);

        if (!emailSent) {
            console.error('Failed to send verification email to:', email);
            // Still return success but note the email issue
            return NextResponse.json({
                success: true,
                message: 'Account created but verification email failed to send. Please try resending.',
                rollNumber,
                emailSent: false
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Account created successfully. Please check your email to verify.',
            rollNumber,
            emailSent: true,
            expiresAt: verificationExpires.toISOString()
        });
    } catch (error) {
        console.error('Error registering with Google:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
