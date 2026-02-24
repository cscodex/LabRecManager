import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { auth } from '@/lib/next-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // First try the custom JWT token
        const customSession = await getSession();

        if (customSession) {
            return NextResponse.json({
                user: {
                    id: customSession.id,
                    name: customSession.name,
                    email: customSession.email,
                    rollNumber: customSession.rollNumber,
                    role: customSession.role,
                }
            });
        }

        // If no custom token, try standard NextAuth
        const nextAuthSession = await auth();
        if (nextAuthSession?.user) {
            return NextResponse.json({
                user: {
                    id: nextAuthSession.user.id || '',
                    email: nextAuthSession.user.email || undefined,
                    rollNumber: (nextAuthSession.user as any).rollNumber || undefined,
                    name: nextAuthSession.user.name || 'Student',
                    role: 'student',
                }
            });
        }

    } catch (error) {
        console.error('Error getting session:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
