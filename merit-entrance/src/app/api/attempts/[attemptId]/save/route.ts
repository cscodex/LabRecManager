import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// Save responses and update current question
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ attemptId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { attemptId } = await params;
        const studentId = session.id;
        const body = await request.json();
        const { responses, currentQuestionId, responseTimes } = body;

        // Verify attempt belongs to this student and is in progress
        const attempts = await sql`
            SELECT id, status FROM exam_attempts
            WHERE id = ${attemptId} AND student_id = ${studentId}
        `;

        if (attempts.length === 0) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        if (attempts[0].status === 'submitted') {
            return NextResponse.json({ error: 'Exam already submitted' }, { status: 400 });
        }

        // Update current question on attempt
        if (currentQuestionId) {
            await sql`
                UPDATE exam_attempts 
                SET current_question_id = ${currentQuestionId}
                WHERE id = ${attemptId}
            `;
        }

        // Batch upsert responses with time spent
        if (responses && typeof responses === 'object') {
            for (const [questionId, response] of Object.entries(responses)) {
                const { answer, markedForReview } = response as { answer: any; markedForReview: boolean };
                const timeSpent = responseTimes?.[questionId] || 0;

                await sql`
                    INSERT INTO question_responses (attempt_id, question_id, answer, marked_for_review, time_spent)
                    VALUES (
                        ${attemptId}, 
                        ${questionId}, 
                        ${answer ? JSON.stringify(answer) : null}::jsonb, 
                        ${markedForReview || false},
                        ${timeSpent}
                    )
                    ON CONFLICT (attempt_id, question_id)
                    DO UPDATE SET
                        answer = ${answer ? JSON.stringify(answer) : null}::jsonb,
                        marked_for_review = ${markedForReview || false},
                        time_spent = COALESCE(question_responses.time_spent, 0) + ${timeSpent}
                `;
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving responses:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Single question save with immediate persistence
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ attemptId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { attemptId } = await params;
        const studentId = session.id;
        const body = await request.json();
        const { questionId, answer, markedForReview, timeSpent, currentQuestionId } = body;

        // Verify attempt
        const attempts = await sql`
            SELECT id, status FROM exam_attempts
            WHERE id = ${attemptId} AND student_id = ${studentId}
        `;

        if (attempts.length === 0 || attempts[0].status === 'submitted') {
            return NextResponse.json({ error: 'Invalid attempt' }, { status: 400 });
        }

        // Update current question if provided
        if (currentQuestionId) {
            await sql`
                UPDATE exam_attempts 
                SET current_question_id = ${currentQuestionId}
                WHERE id = ${attemptId}
            `;
        }

        // Upsert response with time spent
        await sql`
            INSERT INTO question_responses (attempt_id, question_id, answer, marked_for_review, time_spent)
            VALUES (
                ${attemptId}, 
                ${questionId}, 
                ${answer ? JSON.stringify(answer) : null}::jsonb, 
                ${markedForReview || false},
                ${timeSpent || 0}
            )
            ON CONFLICT (attempt_id, question_id)
            DO UPDATE SET
                answer = ${answer ? JSON.stringify(answer) : null}::jsonb,
                marked_for_review = ${markedForReview || false},
                time_spent = COALESCE(question_responses.time_spent, 0) + ${timeSpent || 0}
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving response:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
