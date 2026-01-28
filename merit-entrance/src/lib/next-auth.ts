import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    trustHost: true,
    pages: {
        signIn: '/',
        error: '/',
    },
    callbacks: {
        async signIn({ user, account, profile }) {
            if (account?.provider === 'google' && user.email) {
                try {
                    // Check if student with this email exists
                    const existing = await sql`
                        SELECT id, roll_number, name, email FROM students 
                        WHERE email = ${user.email}
                    `;

                    if (existing.length === 0) {
                        // Create new student account
                        const rollNumber = `GOOGLE${Date.now().toString().slice(-8)}`;
                        const tempPassword = await bcrypt.hash(Math.random().toString(36), 10);

                        await sql`
                            INSERT INTO students (roll_number, name, email, password_hash, is_active)
                            VALUES (${rollNumber}, ${user.name || 'Google User'}, ${user.email}, ${tempPassword}, true)
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
                    SELECT id, roll_number, name, email FROM students 
                    WHERE email = ${user.email}
                `;

                if (students.length > 0) {
                    const student = students[0];
                    token.id = student.id;
                    token.rollNumber = student.roll_number;
                    token.name = student.name;
                    token.email = student.email;
                    token.role = 'student';
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
