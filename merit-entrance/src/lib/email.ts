import { resend } from './resend';

// Helper to determine the sender address
// If RESEND_VERIFIED_DOMAIN is set, use it. Otherwise default to user's registered email via Resend's onboarding domain
// Note: Onboarding domain only allows sending to the registered email address.
const SENDER_EMAIL = process.env.RESEND_VERIFIED_DOMAIN_EMAIL || 'onboarding@resend.dev';
const SENDER_NAME = 'Merit Entrance';

export async function sendVerificationEmail(
    email: string,
    name: string,
    token: string
): Promise<boolean> {
    const verificationUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}`;

    try {
        console.log(`Sending verification email via Resend to: ${email}`);

        const { data, error } = await resend.emails.send({
            from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
            to: email, // Must be the registered email if using onboarding@resend.dev
            subject: 'Verify your Merit Entrance account',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fb;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                        <div style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Merit Entrance</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Online Exam Platform</p>
                        </div>
                        
                        <div style="background: white; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 22px;">Welcome, ${name}!</h2>
                            
                            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 25px 0;">
                                Thank you for registering with Merit Entrance. Please verify your email address to complete your registration and start taking exams.
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                    Verify Email Address
                                </a>
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 25px 0 0 0;">
                                This verification link will expire in <strong>24 hours</strong>.
                            </p>
                            
                            <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 20px 0 0 0;">
                                If you didn't create an account, you can safely ignore this email.
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                            
                            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                                If the button doesn't work, copy and paste this link:<br>
                                <a href="${verificationUrl}" style="color: #2563eb; word-break: break-all;">${verificationUrl}</a>
                            </p>
                        </div>
                        
                        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
                            © 2026 Merit Entrance. All rights reserved.
                        </p>
                    </div>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('Error sending verification email via Resend:', error);
            return false;
        }

        console.log(`Verification email sent successfully! ID: ${data?.id}`);
        return true;
    } catch (error) {
        console.error('Error sending verification email:', error);
        return false;
    }
}

export function generateVerificationToken(): string {
    return crypto.randomUUID() + '-' + Date.now().toString(36);
}

export function getVerificationExpiry(): Date {
    // Use milliseconds to add 24 hours - more reliable than setHours
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
}
