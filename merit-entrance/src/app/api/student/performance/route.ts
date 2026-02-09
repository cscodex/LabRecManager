import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL!);

// GET performance data with optional groupBy (section|tag) and range (all|latest) filters
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const studentId = session.id;
        const { searchParams } = new URL(request.url);
        const groupBy = searchParams.get('groupBy') || 'section'; // 'section' | 'tag'
        const range = searchParams.get('range') || 'all'; // 'all' | 'latest'

        // For 'latest' range, get only the most recent attempt
        let attemptFilter = '';
        let latestAttemptId: string | null = null;

        if (range === 'latest') {
            const latestAttempt = await sql`
                SELECT id FROM exam_attempts 
                WHERE student_id = ${studentId} AND status = 'submitted'
                ORDER BY submitted_at DESC
                LIMIT 1
            `;
            if (latestAttempt.length > 0) {
                latestAttemptId = latestAttempt[0].id;
            } else {
                return NextResponse.json({
                    success: true,
                    performance: [],
                    groupBy,
                    range
                });
            }
        }

        let performanceData;

        if (groupBy === 'tag') {
            // Group by tag
            if (range === 'latest' && latestAttemptId) {
                performanceData = await sql`
                    SELECT 
                        COALESCE(t.name, 'Untagged') as group_name,
                        COUNT(DISTINCT qr.question_id) as questions_attempted,
                        SUM(CASE WHEN qr.is_correct = true THEN 1 ELSE 0 END) as correct_answers,
                        SUM(COALESCE(qr.marks_awarded, 0)) as marks_earned,
                        SUM(q.marks) as total_possible_marks
                    FROM question_responses qr
                    JOIN questions q ON qr.question_id = q.id
                    LEFT JOIN tags t ON q.tag_id = t.id
                    WHERE qr.attempt_id = ${latestAttemptId}
                    GROUP BY t.id, t.name
                    ORDER BY 
                        CASE WHEN SUM(q.marks) > 0 
                            THEN SUM(COALESCE(qr.marks_awarded, 0))::float / SUM(q.marks) 
                            ELSE 0 
                        END DESC
                `;
            } else {
                performanceData = await sql`
                    SELECT 
                        COALESCE(t.name, 'Untagged') as group_name,
                        COUNT(DISTINCT qr.question_id) as questions_attempted,
                        SUM(CASE WHEN qr.is_correct = true THEN 1 ELSE 0 END) as correct_answers,
                        SUM(COALESCE(qr.marks_awarded, 0)) as marks_earned,
                        SUM(q.marks) as total_possible_marks
                    FROM question_responses qr
                    JOIN questions q ON qr.question_id = q.id
                    LEFT JOIN tags t ON q.tag_id = t.id
                    JOIN exam_attempts ea ON qr.attempt_id = ea.id
                    WHERE ea.student_id = ${studentId}
                      AND ea.status = 'submitted'
                    GROUP BY t.id, t.name
                    ORDER BY 
                        CASE WHEN SUM(q.marks) > 0 
                            THEN SUM(COALESCE(qr.marks_awarded, 0))::float / SUM(q.marks) 
                            ELSE 0 
                        END DESC
                `;
            }
        } else {
            // Group by section (default)
            if (range === 'latest' && latestAttemptId) {
                performanceData = await sql`
                    SELECT 
                        s.name as group_name,
                        COUNT(DISTINCT qr.question_id) as questions_attempted,
                        SUM(CASE WHEN qr.is_correct = true THEN 1 ELSE 0 END) as correct_answers,
                        SUM(COALESCE(qr.marks_awarded, 0)) as marks_earned,
                        SUM(q.marks) as total_possible_marks
                    FROM question_responses qr
                    JOIN questions q ON qr.question_id = q.id
                    JOIN sections s ON q.section_id = s.id
                    WHERE qr.attempt_id = ${latestAttemptId}
                    GROUP BY s.id, s.name
                    ORDER BY 
                        CASE WHEN SUM(q.marks) > 0 
                            THEN SUM(COALESCE(qr.marks_awarded, 0))::float / SUM(q.marks) 
                            ELSE 0 
                        END DESC
                `;
            } else {
                performanceData = await sql`
                    SELECT 
                        s.name as group_name,
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
            }
        }

        // Format the performance data
        const formattedPerformance = performanceData.map((p: any) => {
            // Parse JSONB name if needed (for sections with translations)
            let displayName = p.group_name;
            if (typeof p.group_name === 'string' && p.group_name.startsWith('{')) {
                try {
                    displayName = JSON.parse(p.group_name);
                } catch {
                    displayName = p.group_name;
                }
            }

            return {
                name: displayName,
                questionsAttempted: parseInt(p.questions_attempted) || 0,
                correctAnswers: parseInt(p.correct_answers) || 0,
                marksEarned: parseFloat(p.marks_earned) || 0,
                totalPossibleMarks: parseFloat(p.total_possible_marks) || 0,
                percentage: p.total_possible_marks > 0
                    ? (parseFloat(p.marks_earned) / parseFloat(p.total_possible_marks)) * 100
                    : 0
            };
        });

        return NextResponse.json({
            success: true,
            performance: formattedPerformance,
            groupBy,
            range
        });
    } catch (error) {
        console.error('Performance API error:', error);
        return NextResponse.json({ success: false, error: 'Failed to load performance' }, { status: 500 });
    }
}
