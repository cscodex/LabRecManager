import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sectionId: string; questionId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, sectionId, questionId } = await params;
        const body = await request.json();
        const { type, text, options, correctAnswer, explanation, marks, difficulty, negativeMarks, imageUrl, order, parentId, paragraphText, tags, subQuestions } = body;

        // 1. Handle Paragraph Content Update
        // Fetch existing question data to determine paragraph_id and current type
        const [existingQuestion] = await sql`SELECT paragraph_id, type FROM questions WHERE id = ${questionId}`;

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
      WHERE id = ${questionId} AND section_id = ${sectionId}
    `;

        // Update tags (Multi-tag)
        if (tags && Array.isArray(tags)) {
            // Replace tags: delete existing and insert new
            await sql`DELETE FROM question_tags WHERE question_id = ${questionId}`;
            if (tags.length > 0) {
                for (const tagId of tags) {
                    await sql`
                         INSERT INTO question_tags (question_id, tag_id)
                         VALUES (${questionId}, ${tagId})
                         ON CONFLICT (question_id, tag_id) DO NOTHING
                     `;
                }
            }
        }

        // Handle Sub-Questions for Paragraph
        if (type === 'paragraph' && subQuestions && Array.isArray(subQuestions)) {
            // Fetch existing IDs
            const existingResult = await sql`SELECT id FROM questions WHERE parent_id = ${questionId}`;
            const existingIds = existingResult.map(row => row.id);

            const inputIds = subQuestions.map((sq: any) => sq.id).filter(Boolean);

            // Delete removed
            const toDelete = existingIds.filter(eid => !inputIds.includes(eid));
            if (toDelete.length > 0) {
                // Manual delete with array handling for neon
                // Neon sql`` template helper doesn't always support ANY($1) with array directly in all versions, 
                // but assuming it does locally. If not, loop or IN clause.
                // Safer to loop for deletions or use explicit IN clause construction if generic array support is unsure.
                // existing logic in Global API used `ANY($1)` and it seemed to pass review.
                // Actually in my global `PUT` view I saw: `await sql('DELETE FROM questions WHERE id = ANY($1)', [toDelete]);`
                // But here I'm using `sql` tagged template literal syntax `sql\`...${...}\``. 
                // The tagged template syntax handles arrays usually by expanding to comma separated values for IN?
                // No, standard `pg` uses `$1` and passes array.
                // Let's use loop to be safe against template nuances.
                for (const delId of toDelete) {
                    await sql`DELETE FROM questions WHERE id = ${delId}`;
                }
            }

            // Update or Insert
            let subOrder = 1;
            for (const sq of subQuestions) {
                if (sq.id && existingIds.includes(sq.id)) {
                    // Update
                    await sql`
                        UPDATE questions SET
                            type=${sq.type}, 
                            text=${sq.text ? JSON.stringify(sq.text) : JSON.stringify({ en: '', pa: '' })}::jsonb, 
                            options=${sq.options ? JSON.stringify(sq.options) : null}::jsonb, 
                            correct_answer=${sq.correctAnswer ? JSON.stringify(sq.correctAnswer) : '[]'}::jsonb, 
                            explanation=${sq.explanation ? JSON.stringify(sq.explanation) : null}::jsonb, 
                            marks=${sq.marks || 1}, 
                            negative_marks=${sq.negativeMarks || null}, 
                            difficulty=${sq.difficulty || 1}, 
                            "order"=${subOrder++}, 
                            image_url=${sq.imageUrl || null},
                            section_id=${sectionId}
                        WHERE id=${sq.id}
                      `;
                } else {
                    // Insert
                    await sql`
                        INSERT INTO questions (
                           section_id, type, text, options, correct_answer, explanation, 
                           marks, negative_marks, difficulty, "order", parent_id, image_url, paragraph_id
                        ) VALUES (
                           ${sectionId},
                           ${sq.type}, 
                           ${sq.text ? JSON.stringify(sq.text) : JSON.stringify({ en: '', pa: '' })}::jsonb, 
                           ${sq.options ? JSON.stringify(sq.options) : null}::jsonb, 
                           ${sq.correctAnswer ? JSON.stringify(sq.correctAnswer) : '[]'}::jsonb, 
                           ${sq.explanation ? JSON.stringify(sq.explanation) : null}::jsonb, 
                           ${sq.marks || 1}, 
                           ${sq.negativeMarks || null}, 
                           ${sq.difficulty || 1}, 
                           ${subOrder++}, 
                           ${questionId}, 
                           ${sq.imageUrl || null},
                           ${paragraphId}
                        )
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
    { params }: { params: Promise<{ id: string; sectionId: string; questionId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, sectionId, questionId } = await params;

        // Check if it's a paragraph question and get its dependencies
        const [qData] = await sql`SELECT paragraph_id FROM questions WHERE id = ${questionId}`;

        // 1. Delete associated responses (if any) - Manual Cascade
        await sql`DELETE FROM question_responses WHERE question_id = ${questionId}`;

        // 2. Delete children dependencies
        // If this is a parent, its children might have responses too!
        // We need to find children, delete THEIR responses, and then delete them.
        const children = await sql`SELECT id FROM questions WHERE parent_id = ${questionId}`;
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
            await sql`DELETE FROM questions WHERE parent_id = ${questionId}`;
        }

        // 3. Delete the question itself
        await sql`DELETE FROM questions WHERE id = ${questionId} AND section_id = ${sectionId}`;

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
