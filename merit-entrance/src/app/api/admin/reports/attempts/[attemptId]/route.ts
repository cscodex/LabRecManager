import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';
import { calculatePerformanceFactor } from '@/lib/performance';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ attemptId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { attemptId } = await params;

        // Get attempt details with student and exam info
        const attemptResult = await sql`
            SELECT 
                ea.id,
                ea.exam_id,
                ea.student_id,
                ea.started_at,
                ea.submitted_at,
                ea.status,
                ea.total_score,
                e.title as exam_title,
                e.total_marks,
                e.passing_marks,
                s.name as student_name,
                s.email as student_email,
                s.roll_number,
                s.class,
                (
                    SELECT COUNT(*)
                    FROM exam_attempts ea2
                    WHERE ea2.exam_id = ea.exam_id 
                    AND ea2.student_id = ea.student_id
                    AND ea2.started_at <= ea.started_at
                ) as attempt_number
            FROM exam_attempts ea
            JOIN exams e ON ea.exam_id = e.id
            JOIN students s ON ea.student_id = s.id
            WHERE ea.id = ${attemptId}
        `;

        if (attemptResult.length === 0) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
        }

        const attempt = attemptResult[0];

        // Get sections for this exam
        const sections = await sql`
            SELECT 
                s.id,
                s.name,
                s."order",
                (
                    SELECT SUM(q.marks)
                    FROM questions q
                    WHERE q.section_id = s.id
                ) as total_marks,
                (
                    SELECT COALESCE(AVG(q.difficulty), 1)
                    FROM questions q
                    WHERE q.section_id = s.id
                ) as avg_difficulty
            FROM sections s
            WHERE s.exam_id = ${attempt.exam_id}
            ORDER BY s."order"
        `;

        // Get all questions with responses for this attempt
        const questionsWithResponses = await sql`
            SELECT 
                q.id,
                q.section_id,
                q.text,
                q.type,
                q.options,
                q.correct_answer,
                q.marks,
                q.negative_marks,
                q.difficulty,
                q.image_url,
                p.content as paragraph_text,
                p.text as paragraph_title,
                q."order",
                qr.id as response_id,
                qr.answer,
                qr.is_correct,
                qr.marks_awarded
            FROM questions q
            JOIN sections s ON q.section_id = s.id
            LEFT JOIN question_responses qr ON q.id = qr.question_id AND qr.attempt_id = ${attemptId}
            LEFT JOIN paragraphs p ON q.paragraph_id = p.id
            WHERE s.exam_id = ${attempt.exam_id}
            ORDER BY s."order", q."order"
        `;

        // Group questions by section
        const sectionData = sections.map(section => {
            const sectionQuestions = questionsWithResponses
                .filter(q => q.section_id === section.id)
                .map(q => {
                    const difficulty = parseFloat(q.difficulty) || 1;
                    const marks = parseFloat(q.marks) || 1;
                    const marksAwarded = parseFloat(q.marks_awarded) || 0;

                    const options = typeof q.options === 'string' ? JSON.parse(q.options) : (Array.isArray(q.options) ? q.options : []);
                    let correctOptionIndex = -1;

                    // Parse correct answer and find its index in options
                    try {
                        let correctIds = q.correct_answer;
                        if (typeof correctIds === 'string') correctIds = JSON.parse(correctIds);
                        // If it's an array, take the first one (assuming single correct for simplified view) or check if it's a single ID
                        const correctId = Array.isArray(correctIds) ? correctIds[0] : correctIds;

                        if (Array.isArray(options)) {
                            correctOptionIndex = options.findIndex((opt: any) => opt.id === correctId);
                        }
                    } catch (e) {
                        // Fallback or ignore
                    }

                    // Format options for frontend (extract text property)
                    const formattedOptions = Array.isArray(options)
                        ? options.map((opt: any) => opt.text || opt)
                        : [];

                    return {
                        id: q.id,
                        text: typeof q.text === 'string' ? JSON.parse(q.text) : q.text,
                        paragraphText: typeof q.paragraph_text === 'string' ? JSON.parse(q.paragraph_text) : q.paragraph_text,
                        paragraphTitle: typeof q.paragraph_title === 'string' ? JSON.parse(q.paragraph_title) : q.paragraph_title,
                        imageUrl: q.image_url,
                        type: q.type,
                        options: formattedOptions,
                        correctOption: correctOptionIndex,
                        marks: marks,
                        negativeMarks: parseFloat(q.negative_marks) || 0,
                        difficulty: difficulty,
                        order: q.order,
                        // Response data
                        selectedOption: q.answer,
                        isCorrect: q.is_correct,
                        marksAwarded: marksAwarded,
                        isAttempted: q.response_id !== null,
                        // Performance factor per question
                        performanceFactor: calculatePerformanceFactor(marksAwarded, marks, difficulty)
                    };
                });

            const sectionMarks = sectionQuestions.reduce((sum, q) => sum + q.marksAwarded, 0);
            const sectionTotalMarks = parseFloat(section.total_marks) || 0;
            const sectionDifficulty = parseFloat(section.avg_difficulty) || 1;

            return {
                id: section.id,
                name: typeof section.name === 'string' ? JSON.parse(section.name) : section.name,
                order: section.order,
                totalMarks: sectionTotalMarks,
                marksObtained: sectionMarks,
                avgDifficulty: sectionDifficulty,
                questionsCount: sectionQuestions.length,
                attemptedCount: sectionQuestions.filter(q => q.isAttempted).length,
                correctCount: sectionQuestions.filter(q => q.isCorrect).length,
                sectionPerformanceFactor: calculatePerformanceFactor(sectionMarks, sectionTotalMarks, sectionDifficulty),
                questions: sectionQuestions
            };
        });

        // Calculate overall performance factor
        const totalScore = parseFloat(attempt.total_score) || 0;
        const totalMarks = parseFloat(attempt.total_marks) || 0;
        const overallDifficulty = sectionData.length > 0
            ? sectionData.reduce((sum, s) => sum + s.avgDifficulty, 0) / sectionData.length
            : 1;

        // Calculate time spent
        const startTime = new Date(attempt.started_at).getTime();
        const endTime = attempt.submitted_at ? new Date(attempt.submitted_at).getTime() : Date.now();
        const timeSpentMs = endTime - startTime;
        const timeSpentMinutes = Math.floor(timeSpentMs / 60000);
        const timeSpentSeconds = Math.floor((timeSpentMs % 60000) / 1000);

        return NextResponse.json({
            success: true,
            attempt: {
                id: attempt.id,
                examId: attempt.exam_id,
                examTitle: typeof attempt.exam_title === 'string' ? JSON.parse(attempt.exam_title) : attempt.exam_title,
                attemptNumber: parseInt(attempt.attempt_number) || 1,
                startedAt: attempt.started_at,
                submittedAt: attempt.submitted_at,
                status: attempt.status,
                totalScore: totalScore,
                totalMarks: totalMarks,
                percentage: totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0,
                passed: attempt.passing_marks ? totalScore >= attempt.passing_marks : null,
                overallPerformanceFactor: calculatePerformanceFactor(totalScore, totalMarks, overallDifficulty),
                timeSpent: {
                    minutes: timeSpentMinutes,
                    seconds: timeSpentSeconds,
                    formatted: `${timeSpentMinutes}m ${timeSpentSeconds}s`,
                    totalSeconds: Math.floor(timeSpentMs / 1000)
                },
                student: {
                    id: attempt.student_id,
                    name: attempt.student_name,
                    email: attempt.student_email,
                    rollNumber: attempt.roll_number,
                    class: attempt.class
                }
            },
            sections: sectionData
        });
    } catch (error) {
        console.error('Error fetching attempt details:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
