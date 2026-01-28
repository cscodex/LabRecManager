import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { attemptId: string } }) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const studentId = session.id;
        const { attemptId } = params;

        // Verify attempt belongs to student and is submitted
        const attempt = await sql`
            SELECT 
                ea.id, 
                ea.exam_id, 
                ea.total_score as score, 
                ea.status,
                ea.started_at,
                ea.submitted_at,
                e.title, 
                e.total_marks,
                e.duration
            FROM exam_attempts ea
            JOIN exams e ON ea.exam_id = e.id
            WHERE ea.id = ${attemptId} AND ea.student_id = ${studentId}
        `;

        if (attempt.length === 0) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        if (attempt[0].status !== 'submitted') {
            return NextResponse.json({ error: 'Exam not yet submitted' }, { status: 403 });
        }

        // Fetch questions, options, correct answers, and user responses
        // We need to fetch ALL questions from the exam to show what was missed/unattempted
        const fullDetails = await sql`
            SELECT 
                q.id as question_id,
                q.text,
                q.type,
                q.marks,
                q.options,
                q.correct_answer,
                q.explanation,
                qr.answer as student_response,
                qr.is_correct,
                qr.marks_awarded,
                s.title as section_title,
                p.content as passage_content,
                p.text as passage_title,
                p.id as passage_id
            FROM questions q
            JOIN sections s ON q.section_id = s.id
            LEFT JOIN paragraphs p ON q.paragraph_id = p.id
            LEFT JOIN question_responses qr ON qr.question_id = q.id AND qr.attempt_id = ${attemptId}
            WHERE s.exam_id = ${attempt[0].exam_id} AND q.type != 'paragraph'
            ORDER BY s."order" ASC, q."order" ASC
        `;

        // Group by sections for cleaner display if needed, or just return flat list
        // Flattening for simplicity in frontend logic, but preserving order

        const formattedQuestions = fullDetails.map((q) => ({
            id: q.question_id,
            text: q.text,
            type: q.type,
            marks: q.marks,
            options: q.options,
            correctAnswer: q.correct_answer,
            explanation: q.explanation,
            studentResponse: q.student_response,
            isCorrect: q.is_correct,
            marksAwarded: q.marks_awarded || 0,
            sectionTitle: q.section_title,
            passageContent: q.passage_content,
            passageTitle: q.passage_title,
            passageId: q.passage_id
        }));

        return NextResponse.json({
            success: true,
            exam: {
                id: attempt[0].exam_id,
                title: attempt[0].title,
                totalMarks: attempt[0].total_marks,
                score: attempt[0].score,
                startedAt: attempt[0].started_at,
                submittedAt: attempt[0].submitted_at,
                duration: attempt[0].duration
            },
            questions: formattedQuestions
        });

    } catch (error) {
        console.error('Error fetching attempt details:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
