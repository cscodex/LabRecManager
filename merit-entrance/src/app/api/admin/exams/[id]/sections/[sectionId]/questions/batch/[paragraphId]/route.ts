import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string; sectionId: string; paragraphId: string } }
) {
    try {
        const session = await getSession();
        if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { paragraph, subQuestions } = await req.json();
        const { sectionId, paragraphId: parentId } = params;

        // 1. Update Paragraph Entry and Question Link
        const [qData] = await sql`SELECT paragraph_id FROM questions WHERE id = ${parentId}`;

        if (qData?.paragraph_id) {
            // Update the separate paragraphs table
            await sql`
                UPDATE paragraphs
                SET text = ${JSON.stringify(paragraph.text)},
                    content = ${JSON.stringify(paragraph.paragraphText)},
                    image_url = ${paragraph.imageUrl},
                    updated_at = NOW()
                WHERE id = ${qData.paragraph_id}
            `;

            // Update the question metadata (title, etc)
            await sql`
                UPDATE questions 
                SET text = ${JSON.stringify(paragraph.text)},
                    image_url = ${paragraph.imageUrl}
                WHERE id = ${parentId}
            `;
        } else {
            // Fallback: If for some reason migration didn't link it, create new?
            // Or maybe valid if user didn't run migration properly?
            // For now assume migration ran. If not, this might fail or do nothing for content.
            // Let's at least update the question text.
            await sql`
                UPDATE questions 
                SET text = ${JSON.stringify(paragraph.text)},
                    image_url = ${paragraph.imageUrl}
                WHERE id = ${parentId}
            `;
        }

        // 2. Manage Sub-Questions
        // Get existing sub-questions
        const existingSubQuestions = await sql`
            SELECT id FROM questions WHERE parent_id = ${parentId}
        `;
        const existingIds = existingSubQuestions.map(q => q.id);
        const receivedIds = subQuestions.map((sq: any) => sq.id).filter(Boolean);

        const idsToDelete = existingIds.filter(id => !receivedIds.includes(id));

        // Delete removed sub-questions
        if (idsToDelete.length > 0) {
            await sql`
                DELETE FROM questions WHERE id = ANY(${idsToDelete})
            `;
        }

        // Get paragraph order for sequencing
        const [para] = await sql`SELECT "order" FROM questions WHERE id = ${parentId}`;
        const paraOrder = para.order;

        // Update or Create sub-questions
        for (let i = 0; i < subQuestions.length; i++) {
            const sq = subQuestions[i];
            const correctAnswerJson = JSON.stringify(sq.correctAnswer || []);
            if (sq.id) {
                // Update existing
                await sql`
                    UPDATE questions 
                    SET type = ${sq.type},
                        text = ${JSON.stringify(sq.text)},
                        options = ${JSON.stringify(sq.options)},
                        correct_answer = ${correctAnswerJson},
                        explanation = ${JSON.stringify(sq.explanation)},
                        marks = ${sq.marks},
                        negative_marks = ${sq.negativeMarks},
                        "order" = ${paraOrder + i + 1}
                    WHERE id = ${sq.id}
                `;
            } else {
                // Create new
                await sql`
                    INSERT INTO questions (
                        type, text, options, correct_answer, explanation, marks, negative_marks, "order", section_id, parent_id
                    ) VALUES (
                        ${sq.type}, ${JSON.stringify(sq.text)}, ${JSON.stringify(sq.options)}, 
                        ${correctAnswerJson}, ${JSON.stringify(sq.explanation)}, ${sq.marks}, 
                        ${sq.negativeMarks}, ${paraOrder + i + 1}, ${sectionId}, ${parentId}
                    )
                `;
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Batch update error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 500 });
    }
}
