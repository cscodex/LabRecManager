import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

async function seed() {
    console.log('🌱 Starting seed...');

    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // 1. Get or Create Admin
        let adminId;
        const existingAdmins = await sql`SELECT id FROM admins LIMIT 1`;

        if (existingAdmins.length > 0) {
            adminId = existingAdmins[0].id;
            console.log('Using existing admin:', adminId);
        } else {
            console.log('Creating mock admin...');
            const adminRes = await sql`
                INSERT INTO admins (name, email, password_hash, role)
                VALUES ('Admin User', 'admin@example.com', ${hashedPassword}, 'superadmin')
                RETURNING id;
            `;
            adminId = adminRes[0].id;
        }

        // 2. Create Mock Students
        console.log('Creating students...');
        const students = [];
        for (let i = 1; i <= 20; i++) {
            const roll = `STU2025${i.toString().padStart(3, '0')}`;
            const student = await sql`
                INSERT INTO students (roll_number, name, email, password_hash, is_active, created_at)
                VALUES (
                    ${roll}, 
                    ${`Student ${i}`}, 
                    ${`student${i}@example.com`}, 
                    ${hashedPassword}, 
                    true, 
                    NOW() - (random() * interval '30 days')
                )
                ON CONFLICT (roll_number) DO UPDATE SET name = EXCLUDED.name
                RETURNING id;
            `;
            students.push(student[0].id);
        }

        // 3. Create Mock Exam
        console.log('Creating exams...');
        const examTitle = { en: "Mock Entrance Exam 2025" };
        const examRes = await sql`
            INSERT INTO exams (title, description, duration, total_marks, passing_marks, status, security_mode, created_by, created_at, updated_at)
            VALUES (
                ${JSON.stringify(examTitle)}::jsonb, 
                '{"en": "A comprehensive mock exam for testing analytics."}'::jsonb, 
                60, 100, 40, 'published', false, ${adminId}, NOW() - interval '10 days', NOW() - interval '10 days'
            )
            RETURNING id;
        `;
        const examId = examRes[0].id;

        // 4. Create Mock Section & Questions
        console.log('Creating questions...');
        const sectionRes = await sql`
            INSERT INTO sections (exam_id, name, "order")
            VALUES (${examId}, '{"en": "General Knowledge"}'::jsonb, 1)
            RETURNING id;
        `;
        const sectionId = sectionRes[0].id;

        const questionIds = [];
        for (let i = 1; i <= 5; i++) {
            const qRes = await sql`
                INSERT INTO questions (section_id, text, type, options, correct_answer, marks)
                VALUES (
                    ${sectionId}, 
                    ${JSON.stringify({ en: `Sample Question ${i}?` })}::jsonb, 
                    'mcq', 
                    ${JSON.stringify([
                { id: 'a', text: { en: 'Option A' } },
                { id: 'b', text: { en: 'Option B' } },
                { id: 'c', text: { en: 'Option C' } },
                { id: 'd', text: { en: 'Option D' } }
            ])}::jsonb, 
                    'a', 
                    20
                )
                RETURNING id;
            `;
            questionIds.push(qRes[0].id);
        }

        // 5. Create Mock Attempts
        console.log('Creating attempts...');
        for (const studentId of students) {
            // Decide 80% should be submitted, 20% in progress
            const isSubmitted = Math.random() > 0.2;

            // Create attempt first
            const attemptRes = await sql`
                INSERT INTO exam_attempts (
                    student_id, exam_id, status, 
                    total_score, 
                    started_at, submitted_at
                )
                VALUES (
                    ${studentId}, ${examId}, ${isSubmitted ? 'submitted' : 'in_progress'},
                    0, -- Will update later
                    NOW() - (random() * interval '5 days'),
                    ${isSubmitted ? sql`NOW() - (random() * interval '4 days')` : null}
                )
                RETURNING id;
            `;
            const attemptId = attemptRes[0].id;

            let calculatedScore = 0;

            // Generate Responses
            for (const qId of questionIds) {
                // If submitted, answer all most of the time. If in progress, answer some.
                const shouldAnswer = isSubmitted || Math.random() > 0.5;

                if (shouldAnswer) {
                    const isCorrect = Math.random() > 0.4; // 60% chance correct
                    const marks = 20; // Hardcoded from question creation

                    if (isCorrect) calculatedScore += marks;

                    await sql`
                        INSERT INTO question_responses (attempt_id, question_id, selected_option, is_correct, marks_awarded)
                        VALUES (${attemptId}, ${qId}, ${isCorrect ? 'a' : 'b'}, ${isCorrect}, ${isCorrect ? marks : 0})
                    `;
                }
            }

            // Update Attempt with Calculated Score
            if (isSubmitted) {
                await sql`
                    UPDATE exam_attempts 
                    SET total_score = ${calculatedScore}
                    WHERE id = ${attemptId}
                `;
            }
        }

        // 6. Logs
        await sql`
            INSERT INTO activity_logs (action_type, description, created_at)
            VALUES 
            ('create_exam', 'Created Mock Exam 2025', NOW() - interval '10 days'),
            ('update_exam', 'Published Mock Exam 2025', NOW() - interval '9 days'),
            ('login', 'Admin logged in', NOW());
        `;

        console.log('✅ Seed completed successfully!');
    } catch (e) {
        console.error('Error seeding:', e);
    }
}

seed();
