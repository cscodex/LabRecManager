import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import * as jose from 'jose';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL!);

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth-token')?.value;

        if (!token) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'default-secret');
        const { payload } = await jose.jwtVerify(token, secret);

        if (payload.role !== 'student') {
            return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
        }

        const studentId = payload.userId as string;

        // Get exam results for this student
        const results = await sql`
            SELECT 
                ea.id,
                ea.exam_id,
                ea.total_score as score,
                ea.submitted_at,
                e.title,
                e.total_marks
            FROM exam_attempts ea
            JOIN exams e ON e.id = ea.exam_id
            WHERE ea.student_id = ${studentId}
            AND ea.submitted_at IS NOT NULL
            ORDER BY ea.submitted_at DESC
        `;

        const examResults = results.map(r => ({
            id: r.exam_id,
            title: typeof r.title === 'string' ? JSON.parse(r.title) : r.title,
            score: parseFloat(r.score) || 0,
            totalMarks: r.total_marks,
            submittedAt: r.submitted_at
        }));

        return NextResponse.json({
            success: true,
            examResults
        });
    } catch (error) {
        console.error('Profile API error:', error);
        return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
    }
}
