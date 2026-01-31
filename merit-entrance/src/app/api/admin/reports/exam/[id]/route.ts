import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

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

        // Fetch Exam Details
        const exam = await sql`SELECT id, title, total_marks, passing_marks FROM exams WHERE id = ${id}`;
        if (exam.length === 0) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
        }

        // Fetch Submitted Attempts
        const attempts = await sql`
            SELECT total_score 
            FROM exam_attempts 
            WHERE exam_id = ${id} AND status = 'submitted'
        `;

        if (attempts.length === 0) {
            return NextResponse.json({
                success: true,
                report: {
                    exam: exam[0],
                    stats: null,
                    distribution: [],
                    questions: []
                }
            });
        }

        // Calculate Stats
        const scores = attempts.map(a => a.total_score);
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;

        // Calculate Median
        scores.sort((a, b) => a - b);
        const mid = Math.floor(scores.length / 2);
        const median = scores.length % 2 !== 0 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;

        const stdDev = Math.sqrt(scores.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b) / scores.length);

        // Score Distribution (10% buckets)
        const distribution = Array(10).fill(0).map((_, i) => ({
            range: `${i * 10}-${(i + 1) * 10}%`,
            count: 0
        }));

        attempts.forEach(a => {
            const percentage = (a.total_score / exam[0].total_marks) * 100;
            const bucketIndex = Math.min(Math.floor(percentage / 10), 9);
            distribution[bucketIndex].count++;
        });

        // Question Analysis (Hardest/Easiest)
        // Note: This query assumes standard MCQ scoring (1 mark correct, etc. or needs refinement based on marking scheme)
        // For simplicity, we calculate "Correct Response Rate" per question
        const questionStats = await sql`
            SELECT 
                q.id,
                q.text,
                q.type,
                COUNT(qr.id) as total_responses,
                COUNT(CASE WHEN qr.is_correct THEN 1 END) as correct_responses
            FROM questions q
            JOIN sections s ON q.section_id = s.id
            LEFT JOIN question_responses qr ON q.id = qr.question_id
            WHERE s.exam_id = ${id}
            GROUP BY q.id
        `;

        const formattedQuestions = questionStats.map((q: any) => ({
            id: q.id,
            text: typeof q.text === 'string' ? JSON.parse(q.text).en : 'Question',
            type: q.type,
            correctRate: q.total_responses > 0
                ? Math.round((q.correct_responses / q.total_responses) * 100)
                : 0
        })).sort((a: any, b: any) => a.correctRate - b.correctRate);

        // Section Analysis
        const sectionStats = await sql`
            SELECT 
                s.id,
                s.name,
                COALESCE(SUM(qr.marks_awarded), 0) as total_marks_obtained,
                COALESCE(SUM(q.marks), 0) as total_max_marks,
                COUNT(DISTINCT ea.id) as attempt_count
            FROM sections s
            JOIN questions q ON s.id = q.section_id
            LEFT JOIN question_responses qr ON q.id = qr.question_id
            LEFT JOIN exam_attempts ea ON qr.attempt_id = ea.id
            WHERE s.exam_id = ${id} 
            AND (ea.status = 'submitted' OR ea.status IS NULL) -- Filter for submitted if joined
            GROUP BY s.id
            ORDER BY s."order"
        `;

        const formattedSections = sectionStats.map((s: any) => {
            const attempts = parseInt(s.attempt_count) || 0;
            const totalObtained = parseFloat(s.total_marks_obtained) || 0;
            const avgSectionScore = attempts > 0 ? (totalObtained / attempts) : 0;

            return {
                id: s.id,
                name: typeof s.name === 'string' ? JSON.parse(s.name) : s.name,
                avgScore: Math.round(avgSectionScore * 10) / 10,
                attempts: attempts
            };
        });

        const report = {
            exam: {
                ...exam[0],
                title: typeof exam[0].title === 'string' ? JSON.parse(exam[0].title) : exam[0].title
            },
            stats: {
                totalAttempts: attempts.length,
                minScore: min,
                maxScore: max,
                avgScore: Math.round(avg),
                medianScore: Math.round(median),
                stdDev: Math.round(stdDev * 10) / 10
            },
            distribution,
            questions: formattedQuestions,
            sections: formattedSections
        };

        return NextResponse.json({ success: true, report });
    } catch (error) {
        console.error('Error fetching exam report:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
