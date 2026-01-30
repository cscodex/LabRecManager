
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL!);

async function checkData() {
    console.log('🔍 Checking Database Counts...');

    try {
        const studentCount = await sql`SELECT COUNT(*) as count FROM students`;
        const examCount = await sql`SELECT COUNT(*) as count FROM exams`;
        const publishedExamCount = await sql`SELECT COUNT(*) as count FROM exams WHERE status = 'published'`;
        const attemptCount = await sql`SELECT COUNT(*) as count FROM exam_attempts`;
        const submittedAttemptCount = await sql`SELECT COUNT(*) as count FROM exam_attempts WHERE status = 'submitted'`;

        console.log('--- Stats ---');
        console.log(`Students: ${studentCount[0].count}`);
        console.log(`Exams (Total): ${examCount[0].count}`);
        console.log(`Exams (Published): ${publishedExamCount[0].count}`);
        console.log(`Attempts (Total): ${attemptCount[0].count}`);
        console.log(`Attempts (Submitted): ${submittedAttemptCount[0].count}`);

        const attemptsByExam = await sql`
            SELECT e.id, e.title, count(ea.id) as attempt_count, avg(ea.total_score) as avg_score
            FROM exam_attempts ea 
            JOIN exams e ON ea.exam_id = e.id 
            WHERE ea.status = 'submitted'
            GROUP BY e.id, e.title
        `;
        console.log('\n--- Attempts by Exam ---');
        console.log(attemptsByExam);

    } catch (error) {
        console.error('Check Failed:', error);
    }
}

checkData();
