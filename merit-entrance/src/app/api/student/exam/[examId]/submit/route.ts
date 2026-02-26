import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';
import { gradeSubjectiveAnswer } from '@/lib/ai-grading';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// Submit exam
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { examId } = await params;
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

        // Get exam grading instructions
        const examData = await sql`SELECT grading_instructions FROM exams WHERE id = ${examId}`;
        const gradingInstructions = examData[0]?.grading_instructions;

        // Get all questions and their correct answers (via section_questions junction)
        const questions = await sql`
      SELECT q.id, q.type, q.text, q.correct_answer, sq.marks, sq.negative_marks, q.explanation
      FROM section_questions sq
      JOIN questions q ON q.id = sq.question_id
      JOIN sections s ON sq.section_id = s.id
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
                ? studentAnswer.map((a: any) => String(a).toLowerCase().trim())
                : [String(studentAnswer).toLowerCase().trim()];
            const normalizedCorrect = Array.isArray(correctAnswer)
                ? correctAnswer.map((a: any) => String(a).toLowerCase().trim())
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

        // --- AI GRADING FOR SUBJECTIVE QUESTIONS ---
        const gradingPromises: Promise<any>[] = [];

        for (const question of questions) {
            if (question.type === 'short_answer' || question.type === 'long_answer' || question.type === 'fill_blank') {
                const studentAnswer = responseMap[question.id];
                // Skip if no answer
                if (!studentAnswer || (Array.isArray(studentAnswer) && studentAnswer.length === 0)) continue;

                const answerText = Array.isArray(studentAnswer) ? studentAnswer[0] : studentAnswer;
                const modelAnswer = question.correct_answer || question.explanation || "No model answer provided.";

                console.log(`[AI Grading] Queueing question ${question.id}`);

                const gradingTask = async () => {
                    try {
                        const result = await gradeSubjectiveAnswer(
                            question.text?.en || JSON.stringify(question.text),
                            answerText,
                            modelAnswer,
                            question.marks,
                            'gemini-flash-latest',
                            gradingInstructions
                        );

                        await sql`
                            UPDATE question_responses 
                            SET 
                                ai_feedback = ${JSON.stringify(result)}::jsonb,
                                marks_awarded = ${result.score},
                                is_correct = ${result.score > 0} 
                            WHERE attempt_id = ${attemptId} AND question_id = ${question.id}
                        `;
                    } catch (err) {
                        console.error(`[AI Grading] Failed for Q ${question.id}:`, err);
                    }
                };

                gradingPromises.push(gradingTask());
            }
        }

        // Execute DB updates first
        await Promise.all(updatePromises);

        // Execute AI grading (Parallel)
        // If we want the user to see the score immediately, we must await.
        if (gradingPromises.length > 0) {
            console.log(`[Submit] Waiting for ${gradingPromises.length} AI grading tasks...`);
            await Promise.all(gradingPromises);

            // Recalculate total score from DB to be accurate
            const scoreResult = await sql`
                SELECT SUM(marks_awarded) as total FROM question_responses WHERE attempt_id = ${attemptId}
             `;
            totalScore = parseFloat(scoreResult[0].total || '0');
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
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error submitting exam:', {
            examId: params ? (await params).examId : 'unknown',
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
