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
        id, roll_number, name, name_regional, email, phone, "class", school, is_active, email_verified, created_at
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
      INSERT INTO students (roll_number, name, name_regional, email, phone, "class", school, password_hash, is_active)
      VALUES (${rollNumber}, ${name}, ${nameRegional || null}, ${email || null}, ${phone || null}, ${studentClass || null}, ${school || null}, ${passwordHash}, true)
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

export async function PUT(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, rollNumber, name, nameRegional, email, phone, studentClass, school, password, isActive } = body;

        if (!id || !rollNumber || !name) {
            return NextResponse.json({ error: 'ID, Roll number, and name are required' }, { status: 400 });
        }

        // Check roll number uniqueness if changed
        const existing = await sql`SELECT id FROM students WHERE roll_number = ${rollNumber} AND id != ${id}`;
        if (existing.length > 0) {
            return NextResponse.json({ error: 'Roll number already taken by another student' }, { status: 400 });
        }

        let passwordQuery = sql``;
        if (password && password.trim() !== '') {
            const passwordHash = await bcrypt.hash(password, 10);
            passwordQuery = sql`, password_hash = ${passwordHash}`;
        }

        await sql`
            UPDATE students
            SET 
                roll_number = ${rollNumber},
                name = ${name},
                name_regional = ${nameRegional || null},
                email = ${email || null},
                phone = ${phone || null},
                "class" = ${studentClass || null},
                school = ${school || null},
                is_active = ${isActive},
                email_verified = ${body.emailVerified !== undefined ? body.emailVerified : true}
                ${passwordQuery}
            WHERE id = ${id}
        `;

        return NextResponse.json({
            success: true,
            message: 'Student updated successfully'
        });
    } catch (error) {
        console.error('Error updating student:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let ids: string[] = [];

        // Check for single ID in query params
        const { searchParams } = new URL(request.url);
        const queryId = searchParams.get('id');
        if (queryId) ids.push(queryId);

        // Check for IDs in body (for bulk delete)
        if (ids.length === 0) {
            try {
                const body = await request.json();
                if (body.ids && Array.isArray(body.ids)) {
                    ids = body.ids;
                }
            } catch (e) {
                // Ignore JSON parse error if body is empty
            }
        }

        if (ids.length === 0) {
            return NextResponse.json({ error: 'No student IDs provided' }, { status: 400 });
        }

        await sql`DELETE FROM students WHERE id = ANY(${ids})`;

        return NextResponse.json({
            success: true,
            message: `Deleted ${ids.length} student(s)`
        });
    } catch (error) {
        console.error('Error deleting student:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
