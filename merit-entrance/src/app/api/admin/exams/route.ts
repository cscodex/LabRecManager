import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET() {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const exams = await sql`
      SELECT 
        e.id,
        e.title,
        e.description,
        e.duration,
        e.total_marks,
        e.passing_marks,
        e.status,
        e.created_at,
        e.updated_at,
        a.name as created_by_name,
        (SELECT COUNT(*) FROM sections WHERE exam_id = e.id) as section_count,
        (SELECT COUNT(*) FROM questions q JOIN sections s ON q.section_id = s.id WHERE s.exam_id = e.id) as question_count,
        (SELECT COUNT(*) FROM exam_assignments WHERE exam_id = e.id) as assigned_count
      FROM exams e
      LEFT JOIN admins a ON e.created_by = a.id
      ORDER BY e.created_at DESC
    `;

        return NextResponse.json({
            success: true,
            exams: exams.map(exam => ({
                ...exam,
                title: typeof exam.title === 'string' ? JSON.parse(exam.title) : exam.title,
                description: exam.description ? (typeof exam.description === 'string' ? JSON.parse(exam.description) : exam.description) : null,
            })),
        });
    } catch (error) {
        console.error('Error fetching exams:', error);
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
        const { title, description, duration, totalMarks, passingMarks, negativeMarking, shuffleQuestions } = body;

        if (!title?.en || !duration || !totalMarks) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const now = new Date().toISOString();
        const result = await sql`
      INSERT INTO exams (title, description, duration, total_marks, passing_marks, negative_marking, shuffle_questions, status, security_mode, created_by, created_at, updated_at)
      VALUES (
        ${JSON.stringify(title)}::jsonb,
        ${description ? JSON.stringify(description) : null}::jsonb,
        ${duration},
        ${totalMarks},
        ${passingMarks || null},
        ${negativeMarking || null},
        ${shuffleQuestions || false},
        'draft',
        ${body.securityMode || false},
        ${session.id},
        ${now},
        ${now}
      )
      RETURNING id
    `;

        await logActivity('create_exam', `Created exam: ${title.en}`, { examId: result[0].id });

        return NextResponse.json({
            success: true,
            examId: result[0].id,
        });
    } catch (error) {
        console.error('Error creating exam:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
