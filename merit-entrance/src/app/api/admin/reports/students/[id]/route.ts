
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // 1. Get Student Info with all fields
        const students = await sql`
            SELECT id, name, email, roll_number, phone, class, school, state, district, photo_url, created_at
            FROM students WHERE id = ${id}
        `;
        if (students.length === 0) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }
        const student = students[0];

        // 2. Get Attempts with Exam Details
        const attempts = await sql`
            SELECT 
                ea.id,
                ea.exam_id,
                ea.started_at,
                ea.submitted_at,
                ea.status,
                ea.total_score,
                e.title,
                e.total_marks
            FROM exam_attempts ea
            JOIN exams e ON ea.exam_id = e.id
            WHERE ea.student_id = ${id}
            ORDER BY ea.started_at DESC
        `;

        // 3. Fetch all section scores for this student
        const sectionPerformance = await sql`
            SELECT 
                ea.id as attempt_id,
                s.name as section_name,
                COUNT(qr.id) as questions_attempted,
                SUM(CASE WHEN qr.is_correct THEN q.marks ELSE 0 END) as marks_obtained,
                SUM(q.marks) as total_section_marks
            FROM exam_attempts ea
            JOIN question_responses qr ON ea.id = qr.attempt_id
            JOIN questions q ON qr.question_id = q.id
            JOIN sections s ON q.section_id = s.id
            WHERE ea.student_id = ${id} AND ea.status = 'submitted'
            GROUP BY ea.id, s.id, s.name
        `;

        // 4. Calculate summary statistics
        const submittedAttempts = attempts.filter((a: any) => a.status === 'submitted');
        const totalExams = submittedAttempts.length;
        let avgScore = 0;
        let bestExam = null;
        let worstExam = null;

        if (totalExams > 0) {
            // Calculate average percentage
            const percentages = submittedAttempts.map((a: any) => {
                const pct = a.total_marks > 0 ? (a.total_score / a.total_marks) * 100 : 0;
                return { ...a, percentage: pct };
            });
            avgScore = percentages.reduce((sum: number, a: any) => sum + a.percentage, 0) / totalExams;

            // Find best and worst
            const sorted = [...percentages].sort((a: any, b: any) => b.percentage - a.percentage);
            bestExam = {
                title: typeof sorted[0].title === 'string' ? JSON.parse(sorted[0].title) : sorted[0].title,
                score: sorted[0].total_score,
                totalMarks: sorted[0].total_marks,
                percentage: sorted[0].percentage.toFixed(1)
            };
            worstExam = {
                title: typeof sorted[sorted.length - 1].title === 'string' ? JSON.parse(sorted[sorted.length - 1].title) : sorted[sorted.length - 1].title,
                score: sorted[sorted.length - 1].total_score,
                totalMarks: sorted[sorted.length - 1].total_marks,
                percentage: sorted[sorted.length - 1].percentage.toFixed(1)
            };
        }

        return NextResponse.json({
            success: true,
            student: {
                ...student,
                summary: {
                    totalExams,
                    avgScore: avgScore.toFixed(1),
                    bestExam,
                    worstExam
                },
                attempts: attempts.map(a => ({
                    ...a,
                    title: typeof a.title === 'string' ? JSON.parse(a.title) : a.title,
                    sectionStats: sectionPerformance
                        .filter((sp: any) => sp.attempt_id === a.id)
                        .map((sp: any) => ({
                            name: typeof sp.section_name === 'string' ? JSON.parse(sp.section_name) : sp.section_name,
                            marksObtained: sp.marks_obtained,
                            totalMarks: sp.total_section_marks
                        }))
                }))
            }
        });

    } catch (error) {
        console.error('Error fetching student details:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

