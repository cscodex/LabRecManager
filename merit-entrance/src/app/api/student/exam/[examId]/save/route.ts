import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// Save a response
export async function POST(
    request: NextRequest,
    { params }: { params: { examId: string } }
) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { examId } = params;
        const studentId = session.id;
        const body = await request.json();
        const { questionId, answer, markedForReview } = body;

        // Get in-progress attempt only - must be explicit
        const attempts = await sql`
            SELECT id, status FROM exam_attempts
            WHERE exam_id = ${examId} AND student_id = ${studentId} AND status = 'in_progress'
            ORDER BY started_at DESC  
            LIMIT 1
        `;

        if (attempts.length === 0) {
            console.error('Save failed: No in_progress attempt found', { examId, studentId });
            return NextResponse.json({
                error: 'No active exam attempt found',
                details: 'You may have already submitted this exam or it was auto-submitted due to time expiry.'
            }, { status: 400 });
        }

        const attemptId = attempts[0].id;

        // Upsert response
        await sql`
            INSERT INTO question_responses (attempt_id, question_id, answer, marked_for_review)
            VALUES (${attemptId}, ${questionId}, ${answer ? JSON.stringify(answer) : null}::jsonb, ${markedForReview || false})
            ON CONFLICT (attempt_id, question_id)
            DO UPDATE SET
                answer = ${answer ? JSON.stringify(answer) : null}::jsonb,
                marked_for_review = ${markedForReview || false}
        `;

        // Update current question position - wrap in try-catch since column may not exist
        try {
            await sql`
                UPDATE exam_attempts
                SET current_question_id = ${questionId}
                WHERE id = ${attemptId}
            `;
        } catch (err) {
            console.warn('Could not update current_question_id:', err);
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error saving response:', {
            examId: params.examId,
            error: err.message,
            stack: err.stack
        });
        return NextResponse.json({
            error: 'Internal server error',
            details: err.message
        }, { status: 500 });
    }
}

// Batch save responses
export async function PUT(
    request: NextRequest,
    { params }: { params: { examId: string } }
) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { examId } = params;
        const studentId = session.id;
        const body = await request.json();
        const { responses } = body; // Array of { questionId, answer, markedForReview }

        // Get in-progress attempt only - must be explicit
        const attempts = await sql`
            SELECT id, status FROM exam_attempts
            WHERE exam_id = ${examId} AND student_id = ${studentId} AND status = 'in_progress'
            ORDER BY started_at DESC
            LIMIT 1
        `;

        if (attempts.length === 0) {
            console.error('Batch save failed: No in_progress attempt found', { examId, studentId });
            return NextResponse.json({
                error: 'No active exam attempt found',
                details: 'You may have already submitted this exam.'
            }, { status: 400 });
        }

        const attemptId = attempts[0].id;

        // Batch upsert
        for (const response of responses) {
            await sql`
                INSERT INTO question_responses (attempt_id, question_id, answer, marked_for_review)
                VALUES (${attemptId}, ${response.questionId}, ${response.answer ? JSON.stringify(response.answer) : null}::jsonb, ${response.markedForReview || false})
                ON CONFLICT (attempt_id, question_id)
                DO UPDATE SET
                    answer = ${response.answer ? JSON.stringify(response.answer) : null}::jsonb,
                    marked_for_review = ${response.markedForReview || false}
            `;
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error batch saving:', {
            examId: params.examId,
            error: err.message,
            stack: err.stack
        });
        return NextResponse.json({
            error: 'Internal server error',
            details: err.message
        }, { status: 500 });
    }
}
