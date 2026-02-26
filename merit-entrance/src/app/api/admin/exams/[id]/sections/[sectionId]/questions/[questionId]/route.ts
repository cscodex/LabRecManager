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
        const { type, text, options, correctAnswer, explanation, marks, difficulty, negativeMarks, imageUrl, order, parentId, paragraphText, tags, subQuestions, modelAnswer } = body;

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
        model_answer = ${modelAnswer ? JSON.stringify(modelAnswer) : null}::jsonb,
        explanation = ${explanation ? JSON.stringify(explanation) : null}::jsonb,
        marks = ${marks || 1},
        difficulty = ${difficulty || 1},
        negative_marks = ${negativeMarks || null},
        image_url = ${imageUrl || null},
        "order" = ${order || 1},
        parent_id = ${parentId || null},
        paragraph_id = ${paragraphId}
      WHERE id = ${questionId}
    `;

        // Also update the junction table for section-specific marks/order
        await sql`
          UPDATE section_questions SET
            marks = ${marks || 1},
            negative_marks = ${negativeMarks || null},
            "order" = ${order || 1}
          WHERE section_id = ${sectionId} AND question_id = ${questionId}
        `;

        // Update tags (Multi-tag)
        // Tags can be UUIDs (from tag picker) or name strings (from AI extraction)
        if (tags && Array.isArray(tags)) {
            // Replace tags: delete existing and insert new
            await sql`DELETE FROM question_tags WHERE question_id = ${questionId}`;
            if (tags.length > 0) {
                for (const tagValue of tags) {
                    let resolvedTagId = tagValue;

                    // Check if tagValue is a valid UUID format
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tagValue);

                    if (!isUUID) {
                        // Tag is a name string (from AI) — find or create it
                        const existing = await sql`SELECT id FROM tags WHERE LOWER(name) = LOWER(${tagValue}) LIMIT 1`;
                        if (existing.length > 0) {
                            resolvedTagId = existing[0].id;
                        } else {
                            const [newTag] = await sql`INSERT INTO tags (name) VALUES (${tagValue}) RETURNING id`;
                            resolvedTagId = newTag.id;
                            console.log(`Created new tag: "${tagValue}" -> ${resolvedTagId}`);
                        }
                    }

                    await sql`
                         INSERT INTO question_tags (question_id, tag_id)
                         VALUES (${questionId}, ${resolvedTagId})
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

        // DELINK: Remove question from section without deleting from database
        // This keeps the question in the question bank for future use

        // 1. Remove children junction links if this is a paragraph parent
        const children = await sql`SELECT id FROM questions WHERE parent_id = ${questionId}`;
        if (children.length > 0) {
            for (const child of children) {
                await sql`DELETE FROM section_questions WHERE question_id = ${child.id} AND section_id = ${sectionId}`;
                await sql`UPDATE questions SET section_id = NULL WHERE id = ${child.id}`;
            }
        }

        // 2. Remove the junction link
        await sql`DELETE FROM section_questions WHERE question_id = ${questionId} AND section_id = ${sectionId}`;

        // 3. Also set section_id to NULL on the base question for backward compatibility
        await sql`UPDATE questions SET section_id = NULL WHERE id = ${questionId} AND section_id = ${sectionId}`;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing question from section:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
