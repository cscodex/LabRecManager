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
      SELECT 
        q.*, 
        p.content as paragraph_text,
        COALESCE(
          (
            SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name))
            FROM question_tags qt
            JOIN tags t ON qt.tag_id = t.id
            WHERE qt.question_id = q.id
          ), 
          '[]'::jsonb
        ) as tags
      FROM questions q
      LEFT JOIN paragraphs p ON q.paragraph_id = p.id
      WHERE q.section_id = ${params.sectionId}
      ORDER BY q."order"
    `;

        return NextResponse.json({
            success: true,
            questions: questions.map(q => ({
                ...q,
                text: typeof q.text === 'string' ? JSON.parse(q.text) : q.text,
                options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null,
                correct_answer: typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer,
                explanation: q.explanation ? (typeof q.explanation === 'string' ? JSON.parse(q.explanation) : q.explanation) : null,
                paragraph_text: q.paragraph_text ? (typeof q.paragraph_text === 'string' ? JSON.parse(q.paragraph_text) : q.paragraph_text) : null,
                tags: q.tags || [],
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
        const { type, text, options, correctAnswer, explanation, marks, difficulty, negativeMarks, imageUrl, order, parentId, paragraphText, tags } = body;

        // For paragraph type, paragraph_text is required; for sub-questions, parent_id is required
        if (type === 'paragraph') {
            if (!paragraphText?.en) {
                return NextResponse.json({ error: 'Paragraph text is required' }, { status: 400 });
            }
        } else if (!text?.en || !correctAnswer) {
            return NextResponse.json({ error: 'Question text and answer are required' }, { status: 400 });
        }

        let paragraphId = null;
        if (type === 'paragraph') {
            const [pEntry] = await sql`
                INSERT INTO paragraphs (text, content, image_url)
                VALUES (
                    ${text ? JSON.stringify(text) : JSON.stringify({ en: '', pa: '' })}::jsonb,
                    ${paragraphText ? JSON.stringify(paragraphText) : null}::jsonb,
                    ${imageUrl || null}
                ) RETURNING id
            `;
            paragraphId = pEntry.id;
        }

        const result = await sql`
      INSERT INTO questions (section_id, type, text, options, correct_answer, explanation, marks, difficulty, negative_marks, image_url, "order", parent_id, paragraph_id)
      VALUES (
        ${params.sectionId},
        ${type || 'mcq_single'},
        ${text ? JSON.stringify(text) : JSON.stringify({ en: '', pa: '' })}::jsonb,
        ${options ? JSON.stringify(options) : null}::jsonb,
        ${correctAnswer ? JSON.stringify(correctAnswer) : '[]'}::jsonb,
        ${explanation ? JSON.stringify(explanation) : null}::jsonb,
        ${marks || 1},
        ${difficulty || 1},
        ${negativeMarks || null},
        ${imageUrl || null},
        ${order || 1},
        ${parentId || null},
        ${paragraphId}
      )
      RETURNING id
    `;

        const questionId = result[0].id;

        // Insert tags if present
        if (tags && Array.isArray(tags) && tags.length > 0) {
            for (const tagId of tags) {
                await sql`
                    INSERT INTO question_tags (question_id, tag_id)
                    VALUES (${questionId}, ${tagId})
                    ON CONFLICT (question_id, tag_id) DO NOTHING
                `;
            }
        }

        return NextResponse.json({
            success: true,
            questionId: questionId,
        });
    } catch (error) {
        console.error('Error creating question:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

