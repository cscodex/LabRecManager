
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;

        // Fetch question
        const questions = await sql`SELECT * FROM questions WHERE id = ${id}`;

        if (questions.length === 0) {
            return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
        }

        const question = questions[0];

        // Fetch tags
        const tags = await sql`
            SELECT t.id, t.name 
            FROM question_tags qt
            JOIN tags t ON qt.tag_id = t.id
            WHERE qt.question_id = ${id}
        `;

        // Fetch sub-questions if paragraph
        let subQuestions: any[] = [];
        if (question.type === 'paragraph') {
            subQuestions = await sql`
                SELECT * FROM questions 
                WHERE parent_id = ${id} 
                ORDER BY "order" ASC
            `;
        }

        return NextResponse.json({
            success: true,
            question: {
                ...question,
                tags,
                subQuestions
            }
        });

    } catch (error: any) {
        console.error('Error fetching question:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch question' }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;
        const body = await req.json();
        const {
            type,
            text,
            options,
            correct_answer,
            explanation,
            marks,
            negative_marks,
            difficulty,
            tags,
            image_url,
            paragraph_text,
            subQuestions
        } = body;

        // Update Question
        await sql`
            UPDATE questions SET
                text = ${JSON.stringify(text)}::jsonb,
                options = ${options ? JSON.stringify(options) : null}::jsonb,
                correct_answer = ${correct_answer ? JSON.stringify(correct_answer) : null}::jsonb,
                explanation = ${explanation ? JSON.stringify(explanation) : null}::jsonb,
                marks = ${marks},
                negative_marks = ${negative_marks || 0},
                difficulty = ${difficulty || 1},
                image_url = ${image_url || null},
                paragraph_text = ${paragraph_text ? JSON.stringify(paragraph_text) : null}::jsonb,
                updated_at = NOW()
            WHERE id = ${id}
        `;

        // Update Tags
        await sql`DELETE FROM question_tags WHERE question_id = ${id}`;

        if (tags && tags.length > 0) {
            for (const tagId of tags) {
                await sql`INSERT INTO question_tags (question_id, tag_id) VALUES (${id}, ${tagId}) ON CONFLICT DO NOTHING`;
            }
        }

        // Handle Sub-Questions for Paragraph
        if (type === 'paragraph' && subQuestions && Array.isArray(subQuestions)) {
            // Fetch existing IDs
            const existingResult = await sql`SELECT id FROM questions WHERE parent_id = ${id}`;
            const existingIds = existingResult.map(row => row.id);

            const inputIds = subQuestions.map((sq: any) => sq.id).filter(Boolean);

            // Delete removed
            const toDelete = existingIds.filter(eid => !inputIds.includes(eid));
            if (toDelete.length > 0) {
                await sql`DELETE FROM questions WHERE id = ANY(${toDelete})`;
            }

            // Update or Insert
            let subOrder = 1;
            for (const sq of subQuestions) {
                if (sq.id && existingIds.includes(sq.id)) {
                    // Update
                    await sql`
                        UPDATE questions SET
                            type=${sq.type}, 
                            text=${JSON.stringify(sq.text || sq.textEn)}::jsonb, 
                            options=${JSON.stringify(sq.options)}::jsonb, 
                            correct_answer=${JSON.stringify(sq.correctAnswer || [])}::jsonb, 
                            explanation=${sq.explanation ? JSON.stringify(sq.explanation) : null}::jsonb, 
                            marks=${sq.marks}, 
                            negative_marks=${sq.negativeMarks}, 
                            difficulty=${sq.difficulty}, 
                            "order"=${subOrder++}, 
                            image_url=${sq.imageUrl || null}, 
                            updated_at=NOW()
                        WHERE id=${sq.id}
                      `;
                } else {
                    // Insert
                    await sql`
                        INSERT INTO questions (
                           type, text, options, correct_answer, explanation, 
                           marks, negative_marks, difficulty, "order", parent_id, image_url
                        ) VALUES (
                           ${sq.type}, 
                           ${JSON.stringify(sq.text || sq.textEn)}::jsonb, 
                           ${JSON.stringify(sq.options)}::jsonb, 
                           ${JSON.stringify(sq.correctAnswer || [])}::jsonb, 
                           ${sq.explanation ? JSON.stringify(sq.explanation) : null}::jsonb, 
                           ${sq.marks}, 
                           ${sq.negativeMarks}, 
                           ${sq.difficulty}, 
                           ${subOrder++}, 
                           ${id}, 
                           ${sq.imageUrl || null}
                        )
                      `;
                }
            }
        }

        // Return updated question
        const updatedQuestions = await sql`SELECT * FROM questions WHERE id = ${id}`;

        return NextResponse.json({ success: true, question: updatedQuestions[0] });

    } catch (error: any) {
        console.error('Error updating question:', error);
        return NextResponse.json({ success: false, error: 'Failed to update question' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;

        // Explicitly delete children first
        await sql`DELETE FROM questions WHERE parent_id = ${id}`;
        await sql`DELETE FROM questions WHERE id = ${id}`;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting question:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete question' }, { status: 500 });
    }
}
