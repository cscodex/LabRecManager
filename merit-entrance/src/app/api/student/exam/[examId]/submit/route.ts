import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// Submit exam
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
        const { autoSubmit } = body;

        // Get attempt
        const attempts = await sql`
      SELECT id, status FROM exam_attempts
      WHERE exam_id = ${examId} AND student_id = ${studentId}
    `;

        if (attempts.length === 0) {
            return NextResponse.json({ error: 'No attempt found' }, { status: 400 });
        }

        if (attempts[0].status === 'submitted') {
            return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
        }

        const attemptId = attempts[0].id;

        // Get all questions and their correct answers
        const questions = await sql`
      SELECT q.id, q.correct_answer, q.marks, q.negative_marks
      FROM questions q
      JOIN sections s ON q.section_id = s.id
      WHERE s.exam_id = ${examId}
    `;

        // Get student responses
        const responses = await sql`
      SELECT question_id, answer
      FROM question_responses
      WHERE attempt_id = ${attemptId}
    `;

        const responseMap: Record<string, any> = {};
        responses.forEach(r => {
            responseMap[r.question_id] = typeof r.answer === 'string' ? JSON.parse(r.answer) : r.answer;
        });

        // Calculate score
        let totalScore = 0;
        for (const question of questions) {
            const studentAnswer = responseMap[question.id];
            const correctAnswer = typeof question.correct_answer === 'string'
                ? JSON.parse(question.correct_answer)
                : question.correct_answer;

            if (!studentAnswer || studentAnswer.length === 0) {
                // Not attempted
                continue;
            }

            const isCorrect = JSON.stringify(studentAnswer.sort()) === JSON.stringify(correctAnswer.sort());

            // Update response with is_correct and marks
            if (isCorrect) {
                totalScore += parseFloat(question.marks);
                await sql`
          UPDATE question_responses SET is_correct = true, marks_awarded = ${question.marks}
          WHERE attempt_id = ${attemptId} AND question_id = ${question.id}
        `;
            } else if (question.negative_marks) {
                totalScore -= parseFloat(question.negative_marks);
                await sql`
          UPDATE question_responses SET is_correct = false, marks_awarded = ${-question.negative_marks}
          WHERE attempt_id = ${attemptId} AND question_id = ${question.id}
        `;
            } else {
                await sql`
          UPDATE question_responses SET is_correct = false, marks_awarded = 0
          WHERE attempt_id = ${attemptId} AND question_id = ${question.id}
        `;
            }
        }

        // Update attempt
        const now = new Date().toISOString();
        await sql`
      UPDATE exam_attempts SET
        submitted_at = ${now},
        auto_submit = ${autoSubmit || false},
        total_score = ${totalScore},
        status = 'submitted'
      WHERE id = ${attemptId}
    `;

        return NextResponse.json({
            success: true,
            totalScore,
        });
    } catch (error) {
        console.error('Error submitting exam:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
