import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    trustHost: true,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: '/',
        error: '/',
    },
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === 'google' && user.email) {
                try {
                    // Check if student with this email exists
                    const existing = await sql`
                        SELECT id, roll_number, name, email, email_verified, google_id
                        FROM students 
                        WHERE email = ${user.email}
                    `;

                    if (existing.length === 0) {
                        // User not registered - redirect to registration page
                        // We return a URL to redirect to
                        return `/student/register?email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name || '')}&googleId=${encodeURIComponent(account.providerAccountId)}&needsRegistration=true`;
                    }

                    const student = existing[0];

                    // Check if email is verified
                    if (!student.email_verified) {
                        // Redirect to verification page
                        return `/student/verify-email?email=${encodeURIComponent(user.email)}&pending=true`;
                    }

                    // Update google_id if not set
                    if (!student.google_id) {
                        await sql`
                            UPDATE students
                            SET google_id = ${account.providerAccountId}
                            WHERE id = ${student.id}
                        `;
                    }

                    return true;
                } catch (error) {
                    console.error('Error in Google sign-in:', error);
                    return false;
                }
            }
            return true;
        },
        async jwt({ token, user, account }) {
            if (account?.provider === 'google' && user?.email) {
                // Get student data from DB
                const students = await sql`
                    SELECT id, roll_number, name, email, email_verified
                    FROM students 
                    WHERE email = ${user.email}
                `;

                if (students.length > 0) {
                    const student = students[0];
                    token.id = student.id;
                    token.rollNumber = student.roll_number;
                    token.name = student.name;
                    token.email = student.email;
                    token.role = 'student';
                    token.emailVerified = student.email_verified;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id as string;
                session.user.rollNumber = token.rollNumber as string;
                session.user.name = token.name as string;
                session.user.email = token.email as string;
                session.user.role = 'student';
            }
            return session;
        },
    },
    session: {
        strategy: 'jwt',
    },
});
