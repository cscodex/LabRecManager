import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string; sectionId: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const questions = await sql`
      SELECT *
      FROM questions
      WHERE section_id = ${params.sectionId}
      ORDER BY "order"
    `;

        return NextResponse.json({
            success: true,
            questions: questions.map(q => ({
                ...q,
                text: typeof q.text === 'string' ? JSON.parse(q.text) : q.text,
                options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null,
                correct_answer: typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer,
                explanation: q.explanation ? (typeof q.explanation === 'string' ? JSON.parse(q.explanation) : q.explanation) : null,
            })),
        });
    } catch (error) {
        console.error('Error fetching questions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string; sectionId: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { type, text, options, correctAnswer, explanation, marks, negativeMarks, imageUrl, order } = body;

        if (!text?.en || !correctAnswer) {
            return NextResponse.json({ error: 'Question text and answer are required' }, { status: 400 });
        }

        const result = await sql`
      INSERT INTO questions (section_id, type, text, options, correct_answer, explanation, marks, negative_marks, image_url, "order")
      VALUES (
        ${params.sectionId},
        ${type || 'mcq_single'},
        ${JSON.stringify(text)}::jsonb,
        ${options ? JSON.stringify(options) : null}::jsonb,
        ${JSON.stringify(correctAnswer)}::jsonb,
        ${explanation ? JSON.stringify(explanation) : null}::jsonb,
        ${marks || 1},
        ${negativeMarks || null},
        ${imageUrl || null},
        ${order || 1}
      )
      RETURNING id
    `;

        return NextResponse.json({
            success: true,
            questionId: result[0].id,
        });
    } catch (error) {
        console.error('Error creating question:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
