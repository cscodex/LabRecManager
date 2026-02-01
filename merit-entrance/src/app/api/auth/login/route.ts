import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { setSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function POST(request: NextRequest) {
    try {
        const { type, identifier, password } = await request.json();

        if (!type || !identifier || !password) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (type === 'admin') {
            // Admin login with email
            const admins = await sql`
                SELECT id, email, password_hash, name, role 
                FROM admins 
                WHERE email = ${identifier}
                LIMIT 1
            `;

            if (admins.length === 0) {
                return NextResponse.json(
                    { error: 'Invalid credentials' },
                    { status: 401 }
                );
            }

            const admin = admins[0];
            const isValid = await bcrypt.compare(password, admin.password_hash);
            if (!isValid) {
                return NextResponse.json(
                    { error: 'Invalid credentials' },
                    { status: 401 }
                );
            }

            const user = {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role as 'admin' | 'superadmin',
            };

            await setSession(user);

            return NextResponse.json({
                success: true,
                user,
            });
        } else {
            // Student login with roll number OR email
            const students = await sql`
                SELECT id, roll_number, password_hash, name, is_active, photo_url, email_verified
                FROM students 
                WHERE roll_number = ${identifier} OR email = ${identifier}
                LIMIT 1
            `;

            if (students.length === 0) {
                return NextResponse.json(
                    { error: 'Invalid credentials' },
                    { status: 401 }
                );
            }

            const student = students[0];

            if (!student.is_active) {
                return NextResponse.json(
                    { error: 'Account is disabled. Contact admin.' },
                    { status: 403 }
                );
            }

            // Check if email is verified
            if (student.email_verified === false) {
                return NextResponse.json(
                    {
                        error: 'Please verify your email before logging in.',
                        needsVerification: true
                    },
                    { status: 403 }
                );
            }

            const isValid = await bcrypt.compare(password, student.password_hash);
            if (!isValid) {
                return NextResponse.json(
                    { error: 'Invalid credentials' },
                    { status: 401 }
                );
            }

            const user = {
                id: student.id,
                rollNumber: student.roll_number,
                name: student.name,
                role: 'student' as const,
                photoUrl: student.photo_url || undefined,
            };

            await setSession(user);

            return NextResponse.json({
                success: true,
                user,
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            {
                error: 'Internal server error',
                _debugMessage: errorMessage
            },
            { status: 500 }
        );
    }
}
