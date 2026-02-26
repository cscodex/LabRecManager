import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

// Force dynamic to ensure fresh data
export const dynamic = 'force-dynamic';

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
        const assignments = await sql`
            SELECT id, max_attempts, schedule_id FROM exam_assignments 
            WHERE exam_id = ${examId} AND student_id = ${studentId}
        `;

        if (assignments.length === 0) {
            return NextResponse.json({ error: 'Not assigned to this exam' }, { status: 403 });
        }
        const { max_attempts, schedule_id } = assignments[0];
        const maxAttempts = max_attempts ? parseInt(String(max_attempts)) : 1;

        // Check if exam is active based on ASSIGNED SCHEDULE
        if (schedule_id) {
            const scheduleResult = await sql`
                SELECT start_time, end_time FROM exam_schedules WHERE id = ${schedule_id}
            `;

            if (scheduleResult.length > 0) {
                const { start_time, end_time } = scheduleResult[0];
                const now = new Date();
                const start = new Date(start_time);
                const end = new Date(end_time);

                if (now < start) {
                    return NextResponse.json({
                        error: 'Exam has not started yet',
                        details: `Starts at ${start.toLocaleString()}`
                    }, { status: 400 });
                }

                if (now > end) {
                    return NextResponse.json({
                        error: 'Exam has ended',
                        details: `Ended at ${end.toLocaleString()}`
                    }, { status: 400 });
                }
            }
        }
        // If schedule_id is NULL, it is "Always Open" for this student -> Allow.
        // If exam has NO schedules, it's "always open" - allow starting

        // Check for existing attempts
        const attempts = await sql`
            SELECT id, started_at, status FROM exam_attempts
            WHERE exam_id = ${examId} AND student_id = ${studentId}
            ORDER BY started_at DESC
        `;

        const activeAttempt = attempts.find(a => a.status === 'in_progress');
        if (activeAttempt) {
            // If there are multiple in_progress attempts, clean up old ones
            const otherInProgress = attempts.filter(a => a.status === 'in_progress' && a.id !== activeAttempt.id);
            if (otherInProgress.length > 0) {
                console.warn('Cleaning up duplicate in_progress attempts:', otherInProgress.map(a => a.id));
                for (const old of otherInProgress) {
                    await sql`UPDATE exam_attempts SET status = 'abandoned' WHERE id = ${old.id}`;
                }
            }
            return NextResponse.json({
                success: true,
                attemptId: activeAttempt.id,
                startedAt: activeAttempt.started_at,
                resumed: true,
            });
        }

        // Check if attempts exhausted - only count completed/submitted attempts
        const completedAttempts = attempts.filter(a => a.status === 'submitted' || a.status === 'abandoned');
        if (completedAttempts.length >= max_attempts) {
            return NextResponse.json({
                error: 'Maximum attempts reached',
                details: `Used ${completedAttempts.length} of ${max_attempts} attempts`
            }, { status: 400 });
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
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error starting exam:', {
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

        // Get attempt - Prioritize 'in_progress' to ensure resuming works even if there are newer submitted attempts
        // Try with current_question_id first, fall back without it if column doesn't exist
        let attempts;
        try {
            attempts = await sql`
              SELECT id, started_at, status, current_question_id FROM exam_attempts
              WHERE exam_id = ${examId} AND student_id = ${studentId}
              ORDER BY 
                CASE WHEN status = 'in_progress' THEN 0 ELSE 1 END,
                started_at DESC 
              LIMIT 1
            `;
        } catch (err) {
            console.warn('current_question_id column may not exist, falling back:', err);
            attempts = await sql`
              SELECT id, started_at, status FROM exam_attempts
              WHERE exam_id = ${examId} AND student_id = ${studentId}
              ORDER BY 
                CASE WHEN status = 'in_progress' THEN 0 ELSE 1 END,
                started_at DESC 
              LIMIT 1
            `;
        }

        if (attempts.length === 0) {
            return NextResponse.json({ error: 'No attempt found, start the exam first' }, { status: 400 });
        }

        const attempt = attempts[0];
        if (attempt.status === 'submitted') {
            return NextResponse.json({ error: 'Exam already submitted' }, { status: 400 });
        }

        // Get exam details
        const exams = await sql`
      SELECT id, title, instructions, duration, total_marks, negative_marking, security_mode
      FROM exams WHERE id = ${examId}
    `;
        const exam = exams[0];

        // Get sections
        const sections = await sql`
      SELECT id, name, "order" FROM sections
      WHERE exam_id = ${examId}
      ORDER BY "order"
    `;

        // Get questions for all sections (via section_questions junction)
        const questions = await sql`
      SELECT 
        q.id,
        sq.section_id,
        q.type,
        q.text,
        q.options,
        sq.marks,
        sq.negative_marks,
        q.image_url,
        sq."order",
        p.content as paragraph_text,
        p.text as paragraph_title,
        q.parent_id
      FROM section_questions sq
      JOIN questions q ON q.id = sq.question_id
      JOIN sections s ON sq.section_id = s.id
      LEFT JOIN paragraphs p ON q.paragraph_id = p.id
      WHERE s.exam_id = ${examId}
      ORDER BY s."order", sq."order"
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

        // Calculate remaining time - timer runs continuously from started_at
        // No pause logic - timer always runs
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
                securityMode: exam.security_mode,
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
                options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options).map((o: any) => ({ ...o, imageUrl: o.image_url || o.imageUrl })) : null,
                marks: q.marks,
                negativeMarks: q.negative_marks,
                imageUrl: q.image_url,
                order: q.order,
                paragraphText: q.paragraph_text ? (typeof q.paragraph_text === 'string' ? JSON.parse(q.paragraph_text) : q.paragraph_text) : null,
                paragraphTitle: q.paragraph_title ? (typeof q.paragraph_title === 'string' ? JSON.parse(q.paragraph_title) : q.paragraph_title) : null,
                parentId: q.parent_id,
            })),
            responses: responseMap,
            remainingSeconds,
            currentQuestionId: attempt.current_question_id || null,
        });
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error getting exam data:', {
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
