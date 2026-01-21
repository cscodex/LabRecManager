import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { setSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
    try {
        const { type, identifier, password } = await request.json();

        if (!type || !identifier || !password) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Get prisma client
        const prisma = getPrisma();

        if (type === 'admin') {
            // Admin login with email
            const admin = await prisma.admin.findUnique({
                where: { email: identifier },
            });

            if (!admin) {
                return NextResponse.json(
                    { error: 'Invalid credentials' },
                    { status: 401 }
                );
            }

            const isValid = await bcrypt.compare(password, admin.passwordHash);
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
            // Student login with roll number
            const student = await prisma.student.findUnique({
                where: { rollNumber: identifier },
            });

            if (!student) {
                return NextResponse.json(
                    { error: 'Invalid credentials' },
                    { status: 401 }
                );
            }

            if (!student.isActive) {
                return NextResponse.json(
                    { error: 'Account is disabled. Contact admin.' },
                    { status: 403 }
                );
            }

            const isValid = await bcrypt.compare(password, student.passwordHash);
            if (!isValid) {
                return NextResponse.json(
                    { error: 'Invalid credentials' },
                    { status: 401 }
                );
            }

            const user = {
                id: student.id,
                rollNumber: student.rollNumber,
                name: student.name,
                role: 'student' as const,
                photoUrl: student.photoUrl || undefined,
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
        const errorStack = error instanceof Error ? error.stack : undefined;
        return NextResponse.json(
            {
                error: 'Internal server error',
                debug: process.env.NODE_ENV !== 'production' ? { message: errorMessage, stack: errorStack } : undefined,
                // Temporarily expose error for debugging - remove after fixing
                _debugMessage: errorMessage
            },
            { status: 500 }
        );
    }
}
