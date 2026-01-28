import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/next-auth';
import { setSession } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function POST(req: NextRequest) {
    try {
        // 1. Verify NextAuth Session (Google)
        const session = await auth();

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'No active Google session' }, { status: 401 });
        }

        // 2. Fetch Student details from DB
        // NextAuth auto-creation logic ensures user exists by now
        const students = await sql`
            SELECT id, email, name, roll_number, is_active 
            FROM students 
            WHERE email = ${session.user.email}
        `;

        if (students.length === 0) {
            return NextResponse.json({ error: 'Student account not found' }, { status: 404 });
        }

        const student = students[0];

        if (!student.is_active) {
            return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
        }

        // 3. Create Custom Session (Merit Token)
        await setSession({
            id: student.id,
            email: student.email,
            name: student.name,
            rollNumber: student.roll_number,
            role: 'student'
        });

        return NextResponse.json({ success: true, user: student });

    } catch (error) {
        console.error('Auth Sync Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
