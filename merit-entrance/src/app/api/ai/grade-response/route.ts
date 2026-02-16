import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { gradeSubjectiveAnswer } from '@/lib/ai-grading';

const sql = neon(process.env.MERIT_DATABASE_URL!);

export async function POST(req: NextRequest) {
    try {
        const { questionId, responseId, studentAnswer, modelAnswer, maxMarks, questionText, model = 'gemini-flash-latest', customPrompt } = await req.json();

        if (!questionId || !studentAnswer) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const aiFeedback = await gradeSubjectiveAnswer(
            questionText,
            studentAnswer,
            modelAnswer,
            maxMarks,
            model,
            customPrompt
        );

        // Update Database if responseId is provided
        if (responseId && aiFeedback) {
            await sql`
                UPDATE question_responses 
                SET 
                    ai_feedback = ${JSON.stringify(aiFeedback)}::jsonb,
                    marks_awarded = ${aiFeedback.score},
                    is_correct = ${aiFeedback.score > 0} 
                WHERE id = ${responseId}
            `;
        }

        return NextResponse.json({ success: true, feedback: aiFeedback });

    } catch (error: any) {
        console.error('Grading Error:', error);
        return NextResponse.json({ error: error.message || 'Grading failed' }, { status: 500 });
    }
}
