
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL!);

async function generateMockData() {
    console.log('🌱 Seeding Mock Data for Reports...');

    try {
        // 1. Get Admin
        const admin = await sql`SELECT id FROM admins LIMIT 1`;
        if (admin.length === 0) throw new Error('No admins found.');
        const adminId = admin[0].id;

        // 2. Create Mock Exam
        const examTitle = `Analysis Mock Exam ${Date.now()}`;
        const exam = await sql`
            INSERT INTO exams (
                title, description, duration, total_marks, passing_marks, 
                created_by, status, updated_at
            )
            VALUES (
                ${JSON.stringify({ en: examTitle })}, 
                ${JSON.stringify({ en: 'A test exam for analytics verification.' })}, 
                60, 20, 8, 
                ${adminId}, 'published', NOW()
            )
            RETURNING id
        `;
        const examId = exam[0].id;
        console.log(`✅ Exam Created: ${examTitle}`);

        // 3. Create Section & Questions
        const section = await sql`
            INSERT INTO sections (exam_id, name, "order")
            VALUES (${examId}, ${JSON.stringify({ en: 'General Knowledge' })}, 1)
            RETURNING id
        `;
        const sectionId = section[0].id;

        // Add 5 Questions (diff 1-5)
        for (let i = 1; i <= 5; i++) {
            await sql`
                INSERT INTO questions (
                    section_id, type, text, correct_answer, marks, difficulty, "order"
                )
                VALUES (
                    ${sectionId}, 'mcq_single', 
                    ${JSON.stringify({ en: `Question Level ${i}` })}, 
                    '["a"]', 
                    4, ${i}, ${i}
                )
            `;
        }
        console.log('✅ Questions Added');

        // 4. Create 5 Students and Attempts
        for (let i = 1; i <= 5; i++) {
            // Create Student
            const name = `Student ${String.fromCharCode(65 + i)} Analysis`;
            const email = `analytics${i}_${Date.now()}@test.com`;
            const roll = `AN${Date.now()}${i}`;

            const student = await sql`
                INSERT INTO students (name, email, roll_number, password_hash)
                VALUES (${name}, ${email}, ${roll}, 'hash')
                RETURNING id
            `;
            const studentId = student[0].id;

            // Create Attempt (Scores: 4, 8, 12, 16, 20)
            const score = i * 4;
            const status = 'submitted';

            await sql`
                INSERT INTO exam_attempts (
                    exam_id, student_id, total_score, status, 
                    started_at, submitted_at, time_spent
                )
                VALUES (
                    ${examId}, ${studentId}, ${score}, ${status},
                    NOW() - INTERVAL '1 hour', NOW(), 1800
                )
            `;
        }
        console.log('✅ 5 Students & Attempts Created');

        console.log('\n🎉 Mock Data Generation Complete!');
        console.log(`Exam: ${examTitle}`);
        console.log('Please check the Reports dashboard now.');

    } catch (error) {
        console.error('Seeding Failed:', error);
    }
}

generateMockData();
