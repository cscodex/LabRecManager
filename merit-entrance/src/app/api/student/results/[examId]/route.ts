import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(
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

        // Get attempt
        const attempts = await sql`
      SELECT id, started_at, submitted_at, total_score, status
      FROM exam_attempts
      WHERE exam_id = ${examId} AND student_id = ${studentId}
    `;

        if (attempts.length === 0) {
            return NextResponse.json({ error: 'No attempt found' }, { status: 404 });
        }

        const attempt = attempts[0];
        if (attempt.status !== 'submitted') {
            return NextResponse.json({ error: 'Exam not yet submitted' }, { status: 400 });
        }

        // Get exam details
        const exams = await sql`
      SELECT id, title, total_marks, passing_marks
      FROM exams WHERE id = ${examId}
    `;
        const exam = exams[0];

        // Get sections
        const sections = await sql`
      SELECT id, name, "order" FROM sections
      WHERE exam_id = ${examId}
      ORDER BY "order"
    `;

        // Get questions with responses
        const questions = await sql`
      SELECT 
        q.id,
        q.section_id,
        q.text,
        q.options,
        q.correct_answer,
        q.explanation,
        q.marks,
        q."order",
        qr.answer as student_answer,
        qr.is_correct,
        qr.marks_awarded
      FROM questions q
      JOIN sections s ON q.section_id = s.id
      LEFT JOIN question_responses qr ON qr.question_id = q.id AND qr.attempt_id = ${attempt.id}
      WHERE s.exam_id = ${examId}
      ORDER BY s."order", q."order"
    `;

        // Calculate stats
        const totalQuestions = questions.length;
        const attempted = questions.filter(q => q.student_answer && JSON.stringify(q.student_answer) !== '[]').length;
        const correct = questions.filter(q => q.is_correct).length;
        const incorrect = questions.filter(q => q.is_correct === false && q.student_answer).length;
        const unattempted = totalQuestions - attempted;

        return NextResponse.json({
            success: true,
            result: {
                exam: {
                    id: exam.id,
                    title: typeof exam.title === 'string' ? JSON.parse(exam.title) : exam.title,
                    totalMarks: exam.total_marks,
                    passingMarks: exam.passing_marks,
                },
                attempt: {
                    startedAt: attempt.started_at,
                    submittedAt: attempt.submitted_at,
                    totalScore: parseFloat(attempt.total_score || '0'),
                    passed: exam.passing_marks ? parseFloat(attempt.total_score || '0') >= exam.passing_marks : null,
                },
                stats: {
                    totalQuestions,
                    attempted,
                    correct,
                    incorrect,
                    unattempted,
                },
                sections: sections.map(s => ({
                    id: s.id,
                    name: typeof s.name === 'string' ? JSON.parse(s.name) : s.name,
                    order: s.order,
                })),
                questions: questions.map(q => ({
                    id: q.id,
                    sectionId: q.section_id,
                    text: typeof q.text === 'string' ? JSON.parse(q.text) : q.text,
                    options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null,
                    correctAnswer: typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer,
                    explanation: q.explanation ? (typeof q.explanation === 'string' ? JSON.parse(q.explanation) : q.explanation) : null,
                    marks: q.marks,
                    order: q.order,
                    studentAnswer: q.student_answer ? (typeof q.student_answer === 'string' ? JSON.parse(q.student_answer) : q.student_answer) : null,
                    isCorrect: q.is_correct,
                    marksAwarded: q.marks_awarded ? parseFloat(q.marks_awarded) : 0,
                })),
            },
        });
    } catch (error) {
        console.error('Error fetching results:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
