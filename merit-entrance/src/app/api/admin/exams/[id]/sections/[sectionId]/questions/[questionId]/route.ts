import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string; sectionId: string; questionId: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { type, text, options, correctAnswer, explanation, marks, negativeMarks, imageUrl, order, parentId, paragraphText } = body;

        await sql`
      UPDATE questions SET
        type = ${type || 'mcq_single'},
        text = ${text ? JSON.stringify(text) : JSON.stringify({ en: '', pa: '' })}::jsonb,
        options = ${options ? JSON.stringify(options) : null}::jsonb,
        correct_answer = ${correctAnswer ? JSON.stringify(correctAnswer) : '[]'}::jsonb,
        explanation = ${explanation ? JSON.stringify(explanation) : null}::jsonb,
        marks = ${marks || 1},
        negative_marks = ${negativeMarks || null},
        image_url = ${imageUrl || null},
        "order" = ${order || 1},
        parent_id = ${parentId || null},
        paragraph_text = ${paragraphText ? JSON.stringify(paragraphText) : null}::jsonb
      WHERE id = ${params.questionId} AND section_id = ${params.sectionId}
    `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating question:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string; sectionId: string; questionId: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await sql`DELETE FROM questions WHERE id = ${params.questionId} AND section_id = ${params.sectionId}`;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting question:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
