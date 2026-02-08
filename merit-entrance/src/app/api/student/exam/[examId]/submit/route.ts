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

        // Parse body safely - may be empty when called from dashboard
        let autoSubmit = false;
        try {
            const body = await request.json();
            autoSubmit = body?.autoSubmit || false;
        } catch {
            // Empty body is OK
        }

        // Get the in_progress attempt - must select the correct one if multiple exist
        const attempts = await sql`
            SELECT id, status FROM exam_attempts
            WHERE exam_id = ${examId} AND student_id = ${studentId} AND status = 'in_progress'
            ORDER BY started_at DESC
            LIMIT 1
        `;

        if (attempts.length === 0) {
            // Check if there's a submitted attempt
            const submittedAttempts = await sql`
                SELECT id FROM exam_attempts
                WHERE exam_id = ${examId} AND student_id = ${studentId} AND status = 'submitted'
                LIMIT 1
            `;
            if (submittedAttempts.length > 0) {
                return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
            }
            return NextResponse.json({ error: 'No attempt found' }, { status: 400 });
        }

        const attemptId = attempts[0].id;
        console.log('[Submit] Processing attempt:', attemptId, 'for student:', studentId);

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

        // Calculate scores and collect updates
        let totalScore = 0;
        const updatePromises: Promise<any>[] = [];

        for (const question of questions) {
            const studentAnswer = responseMap[question.id];
            const correctAnswer = typeof question.correct_answer === 'string'
                ? JSON.parse(question.correct_answer)
                : question.correct_answer;

            if (!studentAnswer || studentAnswer.length === 0) {
                // Not attempted
                continue;
            }

            // Normalize answers for comparison - ensure both are arrays of strings
            const normalizedStudent = Array.isArray(studentAnswer)
                ? studentAnswer.map(a => String(a).toLowerCase().trim())
                : [String(studentAnswer).toLowerCase().trim()];
            const normalizedCorrect = Array.isArray(correctAnswer)
                ? correctAnswer.map(a => String(a).toLowerCase().trim())
                : [String(correctAnswer).toLowerCase().trim()];

            const isCorrect = JSON.stringify(normalizedStudent.sort()) === JSON.stringify(normalizedCorrect.sort());

            console.log('[Scoring] Question:', question.id,
                'Student:', JSON.stringify(normalizedStudent),
                'Correct:', JSON.stringify(normalizedCorrect),
                'isCorrect:', isCorrect);

            // Collect update for batch execution
            if (isCorrect) {
                totalScore += parseFloat(question.marks);
                updatePromises.push(sql`
                    UPDATE question_responses SET is_correct = true, marks_awarded = ${question.marks}
                    WHERE attempt_id = ${attemptId} AND question_id = ${question.id}
                `);
            } else if (question.negative_marks) {
                totalScore -= parseFloat(question.negative_marks);
                updatePromises.push(sql`
                    UPDATE question_responses SET is_correct = false, marks_awarded = ${-question.negative_marks}
                    WHERE attempt_id = ${attemptId} AND question_id = ${question.id}
                `);
            } else {
                updatePromises.push(sql`
                    UPDATE question_responses SET is_correct = false, marks_awarded = 0
                    WHERE attempt_id = ${attemptId} AND question_id = ${question.id}
                `);
            }
        }

        // Execute all updates in parallel for faster submission
        console.log('[Submit] Executing', updatePromises.length, 'response updates in parallel');
        await Promise.all(updatePromises);

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
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error submitting exam:', {
            examId: params.examId,
            error: err.message,
            stack: err.stack,
            name: err.name
        });
        return NextResponse.json({
            error: 'Internal server error',
            details: err.message
        }, { status: 500 });
    }
}
