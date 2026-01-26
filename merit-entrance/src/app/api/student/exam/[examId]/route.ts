import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// Start or resume an exam attempt
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

        // Check if student is assigned to this exam
        const assignment = await sql`
      SELECT id FROM exam_assignments 
      WHERE exam_id = ${examId} AND student_id = ${studentId}
    `;

        if (assignment.length === 0) {
            return NextResponse.json({ error: 'Not assigned to this exam' }, { status: 403 });
        }

        // Check if exam is active
        const schedules = await sql`
      SELECT id FROM exam_schedules
      WHERE exam_id = ${examId}
        AND start_time <= NOW()
        AND end_time >= NOW()
    `;

        if (schedules.length === 0) {
            return NextResponse.json({ error: 'Exam is not currently active' }, { status: 400 });
        }

        // Check for existing attempt
        const existingAttempt = await sql`
      SELECT id, started_at, status FROM exam_attempts
      WHERE exam_id = ${examId} AND student_id = ${studentId}
    `;

        if (existingAttempt.length > 0) {
            const attempt = existingAttempt[0];
            if (attempt.status === 'submitted') {
                return NextResponse.json({ error: 'Exam already submitted' }, { status: 400 });
            }
            return NextResponse.json({
                success: true,
                attemptId: attempt.id,
                startedAt: attempt.started_at,
                resumed: true,
            });
        }

        // Create new attempt
        const now = new Date().toISOString();
        const result = await sql`
      INSERT INTO exam_attempts (exam_id, student_id, started_at, status)
      VALUES (${examId}, ${studentId}, ${now}, 'in_progress')
      RETURNING id
    `;

        return NextResponse.json({
            success: true,
            attemptId: result[0].id,
            startedAt: now,
            resumed: false,
        });
    } catch (error) {
        console.error('Error starting exam:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Get exam data for attempt
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
      SELECT id, started_at, status FROM exam_attempts
      WHERE exam_id = ${examId} AND student_id = ${studentId}
    `;

        if (attempts.length === 0) {
            return NextResponse.json({ error: 'No attempt found, start the exam first' }, { status: 400 });
        }

        const attempt = attempts[0];
        if (attempt.status === 'submitted') {
            return NextResponse.json({ error: 'Exam already submitted' }, { status: 400 });
        }

        // Get exam details
        const exams = await sql`
      SELECT id, title, instructions, duration, total_marks, negative_marking
      FROM exams WHERE id = ${examId}
    `;
        const exam = exams[0];

        // Get sections
        const sections = await sql`
      SELECT id, name, "order" FROM sections
      WHERE exam_id = ${examId}
      ORDER BY "order"
    `;

        // Get questions for all sections
        const questions = await sql`
      SELECT 
        q.id,
        q.section_id,
        q.type,
        q.text,
        q.options,
        q.marks,
        q.negative_marks,
        q.image_url,
        q."order",
        p.content as paragraph_text,
        q.parent_id
      FROM questions q
      JOIN sections s ON q.section_id = s.id
      LEFT JOIN paragraphs p ON q.paragraph_id = p.id
      WHERE s.exam_id = ${examId}
      ORDER BY s."order", q."order"
    `;

        // Get existing responses
        const responses = await sql`
      SELECT question_id, answer, marked_for_review
      FROM question_responses
      WHERE attempt_id = ${attempt.id}
    `;

        const responseMap: Record<string, { answer: any; markedForReview: boolean }> = {};
        responses.forEach(r => {
            responseMap[r.question_id] = {
                answer: typeof r.answer === 'string' ? JSON.parse(r.answer) : r.answer,
                markedForReview: r.marked_for_review,
            };
        });

        // Get remaining time
        const startedAt = new Date(attempt.started_at);
        const elapsedSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
        const remainingSeconds = Math.max(0, exam.duration * 60 - elapsedSeconds);

        return NextResponse.json({
            success: true,
            attemptId: attempt.id,
            exam: {
                id: exam.id,
                title: typeof exam.title === 'string' ? JSON.parse(exam.title) : exam.title,
                instructions: exam.instructions ? (typeof exam.instructions === 'string' ? JSON.parse(exam.instructions) : exam.instructions) : null,
                duration: exam.duration,
                totalMarks: exam.total_marks,
                negativeMarking: exam.negative_marking,
            },
            sections: sections.map(s => ({
                id: s.id,
                name: typeof s.name === 'string' ? JSON.parse(s.name) : s.name,
                order: s.order,
            })),
            questions: questions.map(q => ({
                id: q.id,
                sectionId: q.section_id,
                type: q.type,
                text: typeof q.text === 'string' ? JSON.parse(q.text) : q.text,
                options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : null,
                marks: q.marks,
                negativeMarks: q.negative_marks,
                imageUrl: q.image_url,
                order: q.order,
                paragraphText: q.paragraph_text ? (typeof q.paragraph_text === 'string' ? JSON.parse(q.paragraph_text) : q.paragraph_text) : null,
                parentId: q.parent_id,
            })),
            responses: responseMap,
            remainingSeconds,
        });
    } catch (error) {
        console.error('Error getting exam data:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
