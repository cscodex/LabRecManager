import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, sectionId } = await params;

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
      WHERE q.section_id = ${sectionId}
      ORDER BY q."order"
    `;

        const safeParse = (val: any) => {
            if (typeof val === 'string') {
                try {
                    const parsed = JSON.parse(val);
                    // If result is string again (double encoded), return it?
                    // Usually we just want to ensure we don't crash.
                    // But if val is "A", JSON.parse("A") crashes.
                    // If val is '"A"', JSON.parse('"A"') -> "A".
                    // If val is "", JSON.parse("") crashes.
                    return parsed;
                } catch (e) {
                    return val;
                }
            }
            return val;
        };

        return NextResponse.json({
            success: true,
            questions: questions.map(q => ({
                ...q,
                text: safeParse(q.text),
                options: q.options ? safeParse(q.options) : null,
                correct_answer: safeParse(q.correct_answer),
                model_answer: q.model_answer ? safeParse(q.model_answer) : null,
                explanation: q.explanation ? safeParse(q.explanation) : null,
                paragraph_text: q.paragraph_text ? safeParse(q.paragraph_text) : null,
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
    { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, sectionId } = await params;
        const body = await request.json();
        const { type, text, options, correctAnswer, explanation, marks, difficulty, negativeMarks, imageUrl, order, parentId, paragraphText, tags, modelAnswer } = body;

        // For paragraph type, paragraph_text is required; for sub-questions, parent_id is required
        if (type === 'paragraph') {
            if (!paragraphText?.en) {
                return NextResponse.json({ error: 'Paragraph text is required' }, { status: 400 });
            }
        } else if (type === 'short_answer' || type === 'long_answer') {
            // Short/long answers don't need correctAnswer (AI graded)
            if (!text?.en) {
                return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
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
      INSERT INTO questions (section_id, type, text, options, correct_answer, model_answer, explanation, marks, difficulty, negative_marks, image_url, "order", parent_id, paragraph_id)
      VALUES (
        ${sectionId},
        ${type || 'mcq_single'},
        ${text ? JSON.stringify(text) : JSON.stringify({ en: '', pa: '' })}::jsonb,
        ${options ? JSON.stringify(options) : null}::jsonb,
        ${correctAnswer ? JSON.stringify(correctAnswer) : '[]'}::jsonb,
        ${modelAnswer ? JSON.stringify(modelAnswer) : null}::jsonb,
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

        // Insert tags if present (Multi-tag)
        if (tags && Array.isArray(tags) && tags.length > 0) {
            for (const tagId of tags) {
                // Ensure tags exist? Or just insert.
                await sql`
                    INSERT INTO question_tags (question_id, tag_id)
                    VALUES (${questionId}, ${tagId})
                    ON CONFLICT (question_id, tag_id) DO NOTHING
                `;
            }
        }

        // Handle Sub-Questions for Paragraph
        if (type === 'paragraph' && body.subQuestions && Array.isArray(body.subQuestions)) {
            let subOrder = 1;
            for (const sq of body.subQuestions) {
                await sql`
                    INSERT INTO questions (
                        section_id, type, text, options, correct_answer, explanation, 
                        marks, difficulty, negative_marks, image_url, "order", parent_id, paragraph_id
                    ) VALUES (
                        ${sectionId},
                        ${sq.type},
                        ${sq.text ? JSON.stringify(sq.text) : JSON.stringify({ en: '', pa: '' })}::jsonb,
                        ${sq.options ? JSON.stringify(sq.options) : null}::jsonb,
                        ${sq.correctAnswer ? JSON.stringify(sq.correctAnswer) : '[]'}::jsonb,
                        ${sq.explanation ? JSON.stringify(sq.explanation) : null}::jsonb,
                        ${sq.marks || 1},
                        ${sq.difficulty || 1},
                        ${sq.negativeMarks || null},
                        ${sq.imageUrl || null},
                        ${subOrder++},
                        ${questionId},
                        ${paragraphId}
                    )
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

