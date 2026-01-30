
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL!);

async function verifyDifficulty() {
    console.log('🧪 Starting Difficulty Verification...');

    try {
        // 0. Get Valid Admin
        const admin = await sql`SELECT id FROM admins LIMIT 1`;
        if (admin.length === 0) throw new Error('No admins found in DB');
        const adminId = admin[0].id;

        // 1. Create a Test Exam
        const examTitle = `Difficulty Test Exam ${Date.now()}`;
        const exam = await sql`
            INSERT INTO exams (title, duration, total_marks, created_by, updated_at)
            VALUES (${JSON.stringify({ en: examTitle })}, 60, 10, ${adminId}, NOW())
            RETURNING id
        `;
        const examId = exam[0].id;
        console.log(`✅ Created Exam: ${examId}`);

        // 2. Create Section
        const section = await sql`
            INSERT INTO sections (exam_id, name, "order")
            VALUES (${examId}, ${JSON.stringify({ en: 'Section 1' })}, 1)
            RETURNING id
        `;
        const sectionId = section[0].id;

        // 3. Add Questions with Known Difficulty
        // 2x Difficulty 1, 2x Difficulty 3, 1x Difficulty 5
        // Avg = (1+1+3+3+5)/5 = 13/5 = 2.6
        const difficulties = [1, 1, 3, 3, 5];
        for (const diff of difficulties) {
            await sql`
                INSERT INTO questions (section_id, type, text, correct_answer, marks, difficulty, "order")
                VALUES (
                    ${sectionId}, 
                    'mcq_single', 
                    ${JSON.stringify({ en: `Q Diff ${diff}` })}, 
                    '["a"]', 
                    2, 
                    ${diff}, 
                    1
                )
            `;
        }
        console.log('✅ Added 5 Questions with difficulties: [1, 1, 3, 3, 5]');

        // 4. Create Student
        const student = await sql`
            INSERT INTO students (name, email, roll_number, password_hash)
            VALUES ('Diff Tester', ${`test${Date.now()}@example.com`}, ${`ROLL${Date.now()}`}, 'dummy_hash')
            RETURNING id
        `;
        const studentId = student[0].id;

        // 5. Create Attempt 1: 100% Score
        // Expected Rating = 1.0 * 2.6 = 2.60
        await sql`
            INSERT INTO exam_attempts (exam_id, student_id, total_score, status, submitted_at)
            VALUES (${examId}, ${studentId}, 10, 'submitted', NOW())
        `;
        console.log('✅ Created Attempt 1 (100% Score)');

        // 6. Fetch Student Report Logic via Query (simulating API)
        const attempts = await sql`
            SELECT 
                ea.total_score,
                e.total_marks,
                (
                    SELECT AVG(q.difficulty)
                    FROM questions q
                    JOIN sections s ON q.section_id = s.id
                    WHERE s.exam_id = e.id
                ) as avg_difficulty
            FROM exam_attempts ea
            JOIN exams e ON ea.exam_id = e.id
            WHERE ea.student_id = ${studentId}
        `;

        if (attempts.length === 0) throw new Error('No attempts found');

        const attempt = attempts[0];
        const avgDiff = parseFloat(attempt.avg_difficulty);
        const rating = (attempt.total_score / attempt.total_marks) * avgDiff;

        console.log('\n📊 Results:');
        console.log(`Expected Avg Difficulty: 2.6`);
        console.log(`Actual Avg Difficulty:   ${avgDiff.toFixed(1)}`);

        console.log(`Expected Rating (100%):  2.60`);
        console.log(`Actual Rating:           ${rating.toFixed(2)}`);

        if (avgDiff.toFixed(1) === '2.6' && rating.toFixed(2) === '2.60') {
            console.log('\n✅ VERIFICATION PASSED');
        } else {
            console.error('\n❌ VERIFICATION FAILED');
        }

        // Cleanup
        await sql`DELETE FROM exams WHERE id = ${examId}`;
        await sql`DELETE FROM students WHERE id = ${studentId}`;

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

verifyDifficulty();
