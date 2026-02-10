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
        const { type, text, options, correctAnswer, explanation, marks, difficulty, negativeMarks, imageUrl, order, parentId, paragraphText, tags } = body;

        // 1. Handle Paragraph Content Update
        // Fetch existing question data to determine paragraph_id and current type
        const [existingQuestion] = await sql`SELECT paragraph_id, type FROM questions WHERE id = ${params.questionId}`;

        let paragraphId = existingQuestion?.paragraph_id;

        // Handle Paragraph Content Update
        if (type === 'paragraph') {
            if (paragraphId) {
                // Update existing paragraph
                await sql`
                    UPDATE paragraphs
                    SET text = ${text ? JSON.stringify(text) : JSON.stringify({ en: '', pa: '' })}::jsonb,
                        content = ${paragraphText ? JSON.stringify(paragraphText) : null}::jsonb,
                        image_url = ${imageUrl || null}
                    WHERE id = ${paragraphId}
                `;
            } else {
                // Create new paragraph if question type changed to paragraph and no existing one
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
        } else if (existingQuestion?.type === 'paragraph' && type !== 'paragraph') {
            // If question type changed from paragraph to non-paragraph, disassociate paragraph
            paragraphId = null;
        }


        await sql`
      UPDATE questions SET
        type = ${type || 'mcq_single'},
        text = ${text ? JSON.stringify(text) : JSON.stringify({ en: '', pa: '' })}::jsonb,
        options = ${options ? JSON.stringify(options) : null}::jsonb,
        correct_answer = ${correctAnswer ? JSON.stringify(correctAnswer) : '[]'}::jsonb,
        explanation = ${explanation ? JSON.stringify(explanation) : null}::jsonb,
        marks = ${marks || 1},
        difficulty = ${difficulty || 1},
        negative_marks = ${negativeMarks || null},
        image_url = ${imageUrl || null},
        "order" = ${order || 1},
        parent_id = ${parentId || null},
        paragraph_id = ${paragraphId}
      WHERE id = ${params.questionId} AND section_id = ${params.sectionId}
    `;

        // Update tags (Multi-tag)
        if (tags && Array.isArray(tags)) {
            // Replace tags: delete existing and insert new
            await sql`DELETE FROM question_tags WHERE question_id = ${params.questionId}`;
            if (tags.length > 0) {
                for (const tagId of tags) {
                    await sql`
                         INSERT INTO question_tags (question_id, tag_id)
                         VALUES (${params.questionId}, ${tagId})
                         ON CONFLICT (question_id, tag_id) DO NOTHING
                     `;
                }
            }
        }

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

        // Check if it's a paragraph question and get its dependencies
        const [qData] = await sql`SELECT paragraph_id FROM questions WHERE id = ${params.questionId}`;

        // 1. Delete associated responses (if any) - Manual Cascade
        await sql`DELETE FROM question_responses WHERE question_id = ${params.questionId}`;

        // 2. Delete children dependencies
        // If this is a parent, its children might have responses too!
        // We need to find children, delete THEIR responses, and then delete them.
        const children = await sql`SELECT id FROM questions WHERE parent_id = ${params.questionId}`;
        if (children.length > 0) {
            const childIds = children.map(c => c.id);
            // Delete responses for children
            // Note: using ANY(${childIds}) might be cleaner but let's loop or simple IN clause
            // neondatabase/serverless template literal handling for arrays can be tricky, let's use manual loop or specific strategy
            // Using a simple loop is safe/easy for small numbers
            for (const child of children) {
                await sql`DELETE FROM question_responses WHERE question_id = ${child.id}`;
            }
            // Now delete children
            await sql`DELETE FROM questions WHERE parent_id = ${params.questionId}`;
        }

        // 3. Delete the question itself
        await sql`DELETE FROM questions WHERE id = ${params.questionId} AND section_id = ${params.sectionId}`;

        // 4. Cleanup paragraph content if applicable
        if (qData?.paragraph_id) {
            await sql`DELETE FROM paragraphs WHERE id = ${qData.paragraph_id}`;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting question:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
