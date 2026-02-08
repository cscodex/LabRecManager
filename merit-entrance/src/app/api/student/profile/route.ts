import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL!);

export async function GET() {
    try {
        const session = await getSession();

        if (!session || session.role !== 'student') {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const studentId = session.id;

        // Get exam results for this student
        const results = await sql`
            SELECT 
                ea.id,
                ea.exam_id,
                ea.total_score as score,
                ea.submitted_at,
                e.title,
                e.total_marks
            FROM exam_attempts ea
            JOIN exams e ON e.id = ea.exam_id
            WHERE ea.student_id = ${studentId}
            AND ea.submitted_at IS NOT NULL
            ORDER BY ea.submitted_at DESC
        `;

        // Get student details (phone info, language preference)
        const studentInfo = await sql`
            SELECT phone, phone_verified, preferred_language 
            FROM students 
            WHERE id = ${studentId}
        `;

        // Get section-wise performance across all exams
        const sectionPerformance = await sql`
            SELECT 
                s.name as section_name,
                COUNT(DISTINCT qr.question_id) as questions_attempted,
                SUM(CASE WHEN qr.is_correct = true THEN 1 ELSE 0 END) as correct_answers,
                SUM(COALESCE(qr.marks_awarded, 0)) as marks_earned,
                SUM(q.marks) as total_possible_marks
            FROM question_responses qr
            JOIN questions q ON qr.question_id = q.id
            JOIN sections s ON q.section_id = s.id
            JOIN exam_attempts ea ON qr.attempt_id = ea.id
            WHERE ea.student_id = ${studentId}
              AND ea.status = 'submitted'
            GROUP BY s.id, s.name
            ORDER BY 
                CASE WHEN SUM(q.marks) > 0 
                    THEN SUM(COALESCE(qr.marks_awarded, 0))::float / SUM(q.marks) 
                    ELSE 0 
                END DESC
        `;

        const examResults = results.map(r => ({
            id: r.exam_id,
            title: typeof r.title === 'string' ? JSON.parse(r.title) : r.title,
            score: parseFloat(r.score) || 0,
            totalMarks: r.total_marks,
            submittedAt: r.submitted_at
        }));

        // Format section performance with percentage
        const formattedSectionPerformance = sectionPerformance.map((s: any) => ({
            sectionName: typeof s.section_name === 'string' && s.section_name.startsWith('{')
                ? JSON.parse(s.section_name)
                : s.section_name,
            questionsAttempted: parseInt(s.questions_attempted),
            correctAnswers: parseInt(s.correct_answers),
            marksEarned: parseFloat(s.marks_earned) || 0,
            totalPossibleMarks: parseFloat(s.total_possible_marks) || 0,
            percentage: s.total_possible_marks > 0
                ? (parseFloat(s.marks_earned) / parseFloat(s.total_possible_marks)) * 100
                : 0
        }));

        return NextResponse.json({
            success: true,
            examResults,
            student: studentInfo[0] || {},
            sectionPerformance: formattedSectionPerformance
        });
    } catch (error) {
        console.error('Profile API error:', error);
        return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
    }
}
