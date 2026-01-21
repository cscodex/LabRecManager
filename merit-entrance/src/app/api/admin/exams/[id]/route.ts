import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;

        // Get exam details
        const exams = await sql`
      SELECT 
        e.*,
        a.name as created_by_name
      FROM exams e
      LEFT JOIN admins a ON e.created_by = a.id
      WHERE e.id = ${id}
    `;

        if (exams.length === 0) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        }

        // Get sections with questions
        const sections = await sql`
      SELECT 
        s.id,
        s.name,
        s."order",
        s.duration,
        (SELECT COUNT(*) FROM questions WHERE section_id = s.id) as question_count
      FROM sections s
      WHERE s.exam_id = ${id}
      ORDER BY s."order"
    `;

        // Get schedules
        const schedules = await sql`
      SELECT id, start_time, end_time
      FROM exam_schedules
      WHERE exam_id = ${id}
      ORDER BY start_time
    `;

        const exam = exams[0];
        return NextResponse.json({
            success: true,
            exam: {
                ...exam,
                title: typeof exam.title === 'string' ? JSON.parse(exam.title) : exam.title,
                description: exam.description ? (typeof exam.description === 'string' ? JSON.parse(exam.description) : exam.description) : null,
                sections: sections.map(s => ({
                    ...s,
                    name: typeof s.name === 'string' ? JSON.parse(s.name) : s.name,
                })),
                schedules,
            },
        });
    } catch (error) {
        console.error('Error fetching exam:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;
        const body = await request.json();
        const { title, description, instructions, duration, totalMarks, passingMarks, negativeMarking, shuffleQuestions, status } = body;

        const now = new Date().toISOString();
        await sql`
      UPDATE exams SET
        title = ${JSON.stringify(title)}::jsonb,
        description = ${description ? JSON.stringify(description) : null}::jsonb,
        instructions = ${instructions ? JSON.stringify(instructions) : null}::jsonb,
        duration = ${duration},
        total_marks = ${totalMarks},
        passing_marks = ${passingMarks || null},
        negative_marking = ${negativeMarking || null},
        shuffle_questions = ${shuffleQuestions || false},
        status = ${status || 'draft'},
        updated_at = ${now}
      WHERE id = ${id}
    `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating exam:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;

        // Cascading delete will handle sections, questions, etc.
        await sql`DELETE FROM exams WHERE id = ${id}`;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting exam:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
