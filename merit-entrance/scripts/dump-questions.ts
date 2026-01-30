
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL!);

async function dumpExamQuestions() {
    console.log('🔍 Fetching Questions for SOE2K25...');

    try {
        // 1. Find Exam ID
        const exams = await sql`
            SELECT id, title FROM exams 
            WHERE title->>'en' LIKE '%SOE2K25%' 
            LIMIT 1
        `;

        if (exams.length === 0) {
            console.error('❌ Exam SOE2K25 not found.');
            return;
        }

        const exam = exams[0];
        console.log(`✅ Found Exam: ${JSON.stringify(exam.title)} (${exam.id})`);

        // 2. Fetch Questions
        const questions = await sql`
            SELECT q.id, q.text, q.type, q.difficulty 
            FROM questions q
            JOIN sections s ON q.section_id = s.id
            WHERE s.exam_id = ${exam.id}
            ORDER BY s."order", q."order"
        `;

        console.log(`\nFound ${questions.length} questions.`);
        console.log(JSON.stringify(questions, null, 2));

    } catch (error) {
        console.error('Fetch Failed:', error);
    }
}

dumpExamQuestions();
