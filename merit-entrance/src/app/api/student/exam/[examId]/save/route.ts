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

        // Get attempt
        const attempts = await sql`
      SELECT id, status FROM exam_attempts
      WHERE exam_id = ${examId} AND student_id = ${studentId}
    `;

        if (attempts.length === 0 || attempts[0].status === 'submitted') {
            return NextResponse.json({ error: 'Invalid attempt' }, { status: 400 });
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving response:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

        // Get attempt
        const attempts = await sql`
      SELECT id, status FROM exam_attempts
      WHERE exam_id = ${examId} AND student_id = ${studentId}
    `;

        if (attempts.length === 0 || attempts[0].status === 'submitted') {
            return NextResponse.json({ error: 'Invalid attempt' }, { status: 400 });
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
    } catch (error) {
        console.error('Error batch saving:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
