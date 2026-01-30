
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL!);

async function debugStats() {
    console.log('🐞 Debugging Stats API Queries...');

    try {
        // 1. Student Count
        const studentCount = await sql`
            SELECT COUNT(*) as count FROM students
        `;
        console.log('Students Query Result:', studentCount);
        console.log('Type of count:', typeof studentCount[0].count, 'Value:', studentCount[0].count);

        // 2. Exam Count
        const examCount = await sql`
            SELECT COUNT(*) as count FROM exams WHERE status = 'published'
        `;
        console.log('Exams Query Result:', examCount);

        // 3. Attempt Stats
        const attemptStats = await sql`
            SELECT 
                COUNT(*) as total_attempts,
                AVG(total_score) as avg_score,
                COUNT(*) FILTER (WHERE status = 'passed') as passed_count
            FROM exam_attempts
            WHERE status = 'submitted'
        `;
        console.log('Attempts Query Result:', attemptStats);
        console.log('total_attempts type:', typeof attemptStats[0].total_attempts);
        console.log('avg_score type:', typeof attemptStats[0].avg_score);

    } catch (error) {
        console.error('Debug Failed:', error);
    }
}

debugStats();
