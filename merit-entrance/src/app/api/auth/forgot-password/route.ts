import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { generateVerificationToken, getVerificationExpiry } from '@/lib/email';
import nodemailer from 'nodemailer';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

const transporter = nodemailer.createTransport({
    // Use explicit host and port 587 (STARTTLS) to avoid timeouts on Render
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
    // Add timeouts and force IPv4 to prevent hanging
    connectionTimeout: 10000,
    socketTimeout: 10000,
    family: 4, // Force IPv4
    debug: true, // Show basic debug info
    logger: true, // Log SMTP traffic to console
} as any);

// Verify connection configuration
transporter.verify(function (error, success) {
    if (error) {
        console.error('SMTP Connection Error (Startup):', error);
        console.log('SMTP Configuration Check:', {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            ipv4Forced: true,
            userConfigured: !!process.env.GMAIL_USER,
        });
    } else {
        console.log('SMTP Server is ready to take our messages');
    }
});

async function sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
    const resetUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/student/reset-password?token=${token}`;

    const mailOptions = {
        from: `"Merit Entrance" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Reset your Merit Entrance password',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fb;">
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Password Reset</h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Merit Entrance</p>
                    </div>
                    
                    <div style="background: white; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">Hello, ${name}!</h2>
                        
                        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
                            We received a request to reset your password. Click the button below to create a new password.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                Reset Password
                            </a>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 25px 0 0 0;">
                            This link will expire in <strong>1 hour</strong>.
                        </p>
                        
                        <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 20px 0 0 0;">
                            If you didn't request a password reset, you can safely ignore this email.
                        </p>
                        
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                        
                        <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                            If the button doesn't work, copy and paste this link:<br>
                            <a href="${resetUrl}" style="color: #dc2626; word-break: break-all;">${resetUrl}</a>
                        </p>
                    </div>
                    
                    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
                        © 2026 Merit Entrance. All rights reserved.
                    </p>
                </div>
            </body>
            </html>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        console.log('--- Forgot Password Request Started ---');
        const { identifier } = await request.json();
        console.log('Identifier received:', identifier);

        if (!identifier) {
            return NextResponse.json({ error: 'Email or roll number is required' }, { status: 400 });
        }

        // Find student by email or roll number
        const students = await sql`
            SELECT id, email, name, roll_number
            FROM students
            WHERE email = ${identifier} OR roll_number = ${identifier}
        `;

        if (students.length === 0) {
            console.log('Student not found for identifier:', identifier);
            return NextResponse.json({ error: 'No account found with this email or roll number' }, { status: 404 });
        }

        const student = students[0];
        console.log('Student found:', { id: student.id, hasEmail: !!student.email });

        if (!student.email) {
            return NextResponse.json({ error: 'No email associated with this account' }, { status: 400 });
        }

        // Clean email
        const targetEmail = student.email.trim();
        console.log(`Preparing to email: '${targetEmail}' (Length: ${targetEmail.length})`);

        // Generate reset token (expires in 1 hour)
        const resetToken = generateVerificationToken();
        // Use milliseconds to add 1 hour - more reliable than setHours
        // 24 hours expiry
        const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        console.log('=== PASSWORD RESET DEBUG ===');
        console.log('Current Date.now():', Date.now());
        console.log('Current time:', new Date().toISOString());
        console.log('Reset expires:', resetExpires.toISOString());
        console.log('===========================');

        // Update student with reset token
        await sql`
            UPDATE students
            SET verification_token = ${resetToken},
                verification_expires = ${resetExpires.toISOString()}
            WHERE id = ${student.id}
        `;
        console.log('Database updated with token.');

        // Send password reset email
        const emailSent = await sendPasswordResetEmail(targetEmail, student.name, resetToken);

        if (!emailSent) {
            return NextResponse.json({
                error: 'Failed to send reset email. Please try again.'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'If an account exists with this email/roll number, a password reset link has been sent.'
        });
    } catch (error) {
        console.error('Error in forgot password:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
