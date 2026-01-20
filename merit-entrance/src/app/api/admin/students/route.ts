import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET() {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const students = await sql`
      SELECT 
        id, roll_number, name, name_regional, email, phone, class, school, is_active, created_at,
        (SELECT COUNT(*) FROM exam_attempts WHERE student_id = students.id) as attempt_count
      FROM students
      ORDER BY created_at DESC
    `;

        return NextResponse.json({
            success: true,
            students,
        });
    } catch (error) {
        console.error('Error fetching students:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { rollNumber, name, nameRegional, email, phone, studentClass, school, password } = body;

        if (!rollNumber || !name || !password) {
            return NextResponse.json({ error: 'Roll number, name, and password are required' }, { status: 400 });
        }

        // Check if roll number exists
        const existing = await sql`SELECT id FROM students WHERE roll_number = ${rollNumber}`;
        if (existing.length > 0) {
            return NextResponse.json({ error: 'Roll number already exists' }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await sql`
      INSERT INTO students (roll_number, name, name_regional, email, phone, class, school, password_hash)
      VALUES (${rollNumber}, ${name}, ${nameRegional || null}, ${email || null}, ${phone || null}, ${studentClass || null}, ${school || null}, ${passwordHash})
      RETURNING id
    `;

        return NextResponse.json({
            success: true,
            studentId: result[0].id,
        });
    } catch (error) {
        console.error('Error creating student:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
