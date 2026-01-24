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
        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { paragraph, subQuestions } = await req.json();
        const { sectionId } = params;

        // 1. Create Paragraph Question
        const lastOrderRes = await sql`
            SELECT MAX("order") as max_order 
            FROM questions 
            WHERE section_id = ${sectionId}
        `;
        const nextOrder = (lastOrderRes[0]?.max_order || 0) + 1;

        const [paragraphQ] = await sql`
            INSERT INTO questions (
                type, text, paragraph_text, image_url, "order", section_id, marks, negative_marks
            ) VALUES (
                'paragraph', ${JSON.stringify(paragraph.text)}, ${JSON.stringify(paragraph.paragraphText)}, 
                ${paragraph.imageUrl}, ${nextOrder}, ${sectionId}, 0, 0
            ) RETURNING id
        `;

        // 2. Create Sub-Questions
        const createdSubQuestions = [];
        for (let i = 0; i < subQuestions.length; i++) {
            const sq = subQuestions[i];
            const [createdSq] = await sql`
                INSERT INTO questions (
                    type, text, options, correct_answer, explanation, marks, negative_marks, "order", section_id, parent_id
                ) VALUES (
                    ${sq.type}, ${JSON.stringify(sq.text)}, ${JSON.stringify(sq.options)}, 
                    ${sq.correctAnswer}, ${JSON.stringify(sq.explanation)}, ${sq.marks}, 
                    ${sq.negativeMarks}, ${nextOrder + i + 1}, ${sectionId}, ${paragraphQ.id}
                ) RETURNING id
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
