import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string; sectionId: string } }
) {
    try {
        const session = await getSession();
        if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { paragraph, subQuestions } = await req.json();
        const { sectionId } = params;

        // 1. Create Paragraph Entry (New Schema)
        const [paragraphEntry] = await sql`
            INSERT INTO paragraphs (text, content, image_url)
            VALUES (
                ${JSON.stringify(paragraph.text)}, 
                ${JSON.stringify(paragraph.paragraphText)}, 
                ${paragraph.imageUrl}
            ) RETURNING id
        `;

        const lastOrderRes = await sql`
            SELECT MAX("order") as max_order 
            FROM questions 
            WHERE section_id = ${sectionId}
        `;
        const nextOrder = (lastOrderRes[0]?.max_order || 0) + 1;

        // Create the "Paragraph Question" placeholder linked to the paragraph
        const [paragraphQ] = await sql`
            INSERT INTO questions (
                type, text, paragraph_id, image_url, "order", section_id, marks, difficulty, negative_marks, correct_answer
            ) VALUES (
                'paragraph', ${JSON.stringify(paragraph.text)}, ${paragraphEntry.id}, 
                ${paragraph.imageUrl}, ${nextOrder}, ${sectionId}, 0, 1, 0, '[]'
            ) RETURNING id
        `;

        // Also create junction entry for paragraph question
        await sql`
            INSERT INTO section_questions (section_id, question_id, marks, negative_marks, "order")
            VALUES (${sectionId}, ${paragraphQ.id}, 0, 0, ${nextOrder})
        `;

        // 2. Create Sub-Questions
        const createdSubQuestions = [];
        for (let i = 0; i < subQuestions.length; i++) {
            const sq = subQuestions[i];
            const correctAnswerJson = JSON.stringify(sq.correctAnswer || []);
            const subOrder = nextOrder + i + 1;
            const [createdSq] = await sql`
                INSERT INTO questions (
                    type, text, options, correct_answer, explanation, marks, difficulty, negative_marks, "order", section_id, parent_id
                ) VALUES (
                    ${sq.type}, ${JSON.stringify(sq.text)}, ${JSON.stringify(sq.options)}, 
                    ${correctAnswerJson}, ${JSON.stringify(sq.explanation)}, ${sq.marks}, 
                    ${sq.difficulty || 1}, ${sq.negativeMarks}, ${subOrder}, ${sectionId}, ${paragraphQ.id}
                ) RETURNING id
            `;
            // Also create junction entry for sub-question
            await sql`
                INSERT INTO section_questions (section_id, question_id, marks, negative_marks, "order")
                VALUES (${sectionId}, ${createdSq.id}, ${sq.marks}, ${sq.negativeMarks || null}, ${subOrder})
            `;
            createdSubQuestions.push(createdSq);
        }

        return NextResponse.json({
            success: true,
            paragraphId: paragraphQ.id,
            subQuestionIds: createdSubQuestions.map(q => q.id)
        });
    } catch (error: any) {
        console.error('Batch create error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create' }, { status: 500 });
    }
}
