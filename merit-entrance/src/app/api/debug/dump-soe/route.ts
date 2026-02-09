import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Find SOE2K25 exam
        const exams = await sql`SELECT id FROM exams WHERE title::text ILIKE '%SOE2K25%' LIMIT 1`;
        if (exams.length === 0) return NextResponse.json({ error: 'Exam not found' });
        const examId = exams[0].id;

        // 2. Get questions with Section Name
        const questions = await sql`
      SELECT
        q.id,
        q.text,
        s.name as section_name
      FROM questions q
      JOIN sections s ON q.section_id = s.id
      WHERE s.exam_id = ${examId}
    `;

        return NextResponse.json({ count: questions.length, questions });
    } catch (error) {
        return NextResponse.json({ error: String(error) });
    }
}
