
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
        const questions = await sql('SELECT * FROM questions WHERE id = $1', [id]);

        if (questions.length === 0) {
            return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
        }

        const question = questions[0];

        // Fetch tags
        const tags = await sql(`
            SELECT t.id, t.name 
            FROM question_tags qt
            JOIN tags t ON qt.tag_id = t.id
            WHERE qt.question_id = $1
        `, [id]);

        // Fetch sub-questions if paragraph
        let subQuestions: any[] = [];
        if (question.type === 'paragraph') {
            subQuestions = await sql(`
                SELECT * FROM questions 
                WHERE parent_id = $1 
                ORDER BY "order" ASC
            `, [id]);
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
        await sql(`
            UPDATE questions SET
                text = $1::jsonb,
                options = $2::jsonb,
                correct_answer = $3::jsonb,
                explanation = $4::jsonb,
                marks = $5,
                negative_marks = $6,
                difficulty = $7,
                image_url = $8,
                paragraph_text = $9::jsonb,
                updated_at = NOW()
            WHERE id = $10
        `, [
            JSON.stringify(text),
            options ? JSON.stringify(options) : null,
            correct_answer ? JSON.stringify(correct_answer) : null,
            explanation ? JSON.stringify(explanation) : null,
            marks,
            negative_marks || 0,
            difficulty || 1,
            image_url || null,
            paragraph_text ? JSON.stringify(paragraph_text) : null,
            id
        ]);

        // Update Tags
        await sql('DELETE FROM question_tags WHERE question_id = $1', [id]);

        if (tags && tags.length > 0) {
            for (const tagId of tags) {
                await sql('INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, tagId]);
            }
        }

        // Handle Sub-Questions for Paragraph
        if (type === 'paragraph' && subQuestions && Array.isArray(subQuestions)) {
            // Fetch existing IDs
            const existingResult = await sql('SELECT id FROM questions WHERE parent_id = $1', [id]);
            const existingIds = existingResult.map(row => row.id);

            const inputIds = subQuestions.map((sq: any) => sq.id).filter(Boolean);

            // Delete removed
            const toDelete = existingIds.filter(eid => !inputIds.includes(eid));
            if (toDelete.length > 0) {
                await sql('DELETE FROM questions WHERE id = ANY($1)', [toDelete]);
            }

            // Update or Insert
            let subOrder = 1;
            for (const sq of subQuestions) {
                // Ensure formatting
                const sqText = sq.text || sq.textEn;

                if (sq.id && existingIds.includes(sq.id)) {
                    // Update
                    await sql(`
                        UPDATE questions SET
                            type=$1, text=$2::jsonb, options=$3::jsonb, correct_answer=$4::jsonb, 
                            explanation=$5::jsonb, marks=$6, negative_marks=$7, difficulty=$8, 
                            "order"=$9, image_url=$10, updated_at=NOW()
                        WHERE id=$11
                      `, [
                        sq.type, JSON.stringify(sq.text), JSON.stringify(sq.options), JSON.stringify(sq.correctAnswer || []),
                        sq.explanation ? JSON.stringify(sq.explanation) : null,
                        sq.marks, sq.negativeMarks, sq.difficulty, subOrder++, sq.imageUrl || null,
                        sq.id
                    ]);
                } else {
                    // Insert
                    await sql(`
                        INSERT INTO questions (
                           type, text, options, correct_answer, explanation, 
                           marks, negative_marks, difficulty, "order", parent_id, image_url
                        ) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11)
                      `, [
                        sq.type, JSON.stringify(sq.text), JSON.stringify(sq.options), JSON.stringify(sq.correctAnswer || []),
                        sq.explanation ? JSON.stringify(sq.explanation) : null,
                        sq.marks, sq.negativeMarks, sq.difficulty, subOrder++, id, sq.imageUrl || null
                    ]);
                }
            }
        }

        // Return updated question
        const updatedQuestions = await sql('SELECT * FROM questions WHERE id = $1', [id]);

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
        await sql('DELETE FROM questions WHERE parent_id = $1', [id]);
        await sql('DELETE FROM questions WHERE id = $1', [id]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting question:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete question' }, { status: 500 });
    }
}
