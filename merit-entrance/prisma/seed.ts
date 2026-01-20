import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL;

if (!connectionString) {
    console.error('No connection string found in environment');
    process.exit(1);
}

console.log('Using connection string (masked):', connectionString.replace(/:[^:@]+@/, ':***@'));

const sql = neon(connectionString);

async function main() {
    console.log('🌱 Seeding MeritEntrance database...');

    // Get admin (already created)
    let adminId: string;
    const existingAdmin = await sql`SELECT id FROM admins WHERE email = 'admin@meritentrance.com'`;

    if (existingAdmin.length > 0) {
        adminId = existingAdmin[0].id;
        console.log('✅ Admin exists:', adminId);
    } else {
        const adminPassword = await bcrypt.hash('admin123', 10);
        const result = await sql`
      INSERT INTO admins (email, password_hash, name, role)
      VALUES ('admin@meritentrance.com', ${adminPassword}, 'Admin User', 'superadmin')
      RETURNING id
    `;
        adminId = result[0].id;
        console.log('✅ Admin created');
    }

    // Check for existing exam
    const existingExam = await sql`SELECT id FROM exams WHERE status = 'published' LIMIT 1`;
    let examId: string;

    if (existingExam.length > 0) {
        examId = existingExam[0].id;
        console.log('✅ Using existing exam:', examId);
    } else {
        const now = new Date().toISOString();
        const examTitle = JSON.stringify({ en: 'Sample Entrance Exam', pa: 'ਨਮੂਨਾ ਦਾਖਲਾ ਪ੍ਰੀਖਿਆ' });
        const examDesc = JSON.stringify({ en: 'A sample entrance exam for testing', pa: 'ਟੈਸਟਿੰਗ ਲਈ ਇੱਕ ਨਮੂਨਾ ਦਾਖਲਾ ਪ੍ਰੀਖਿਆ' });

        const examResult = await sql`
      INSERT INTO exams (title, description, duration, total_marks, passing_marks, status, created_by, created_at, updated_at)
      VALUES (
        ${examTitle}::jsonb,
        ${examDesc}::jsonb,
        60,
        40,
        16,
        'published',
        ${adminId},
        ${now},
        ${now}
      )
      RETURNING id
    `;
        examId = examResult[0].id;
        console.log('✅ Exam created:', examId);

        // Create sections
        const sectionsData = [
            { name: { en: 'English', pa: 'ਅੰਗਰੇਜ਼ੀ' }, order: 1 },
            { name: { en: 'Mathematics', pa: 'ਗਣਿਤ' }, order: 2 },
            { name: { en: 'Science', pa: 'ਵਿਗਿਆਨ' }, order: 3 },
            { name: { en: 'Punjabi', pa: 'ਪੰਜਾਬੀ' }, order: 4 },
        ];

        for (const sec of sectionsData) {
            const sectionResult = await sql`
        INSERT INTO sections (exam_id, name, "order")
        VALUES (${examId}, ${JSON.stringify(sec.name)}::jsonb, ${sec.order})
        RETURNING id
      `;
            const sectionId = sectionResult[0].id;

            // Create 5 sample questions per section
            for (let i = 1; i <= 5; i++) {
                const questionText = JSON.stringify({ en: `Sample question ${i} for ${sec.name.en}`, pa: `${sec.name.pa} ਲਈ ਨਮੂਨਾ ਸਵਾਲ ${i}` });
                const options = JSON.stringify([
                    { id: 'a', text: { en: 'Option A', pa: 'ਵਿਕਲਪ ਏ' } },
                    { id: 'b', text: { en: 'Option B', pa: 'ਵਿਕਲਪ ਬੀ' } },
                    { id: 'c', text: { en: 'Option C', pa: 'ਵਿਕਲਪ ਸੀ' } },
                    { id: 'd', text: { en: 'Option D', pa: 'ਵਿਕਲਪ ਡੀ' } },
                ]);
                const correctAnswer = JSON.stringify(['a']);
                const explanation = JSON.stringify({ en: 'The correct answer is A because...', pa: 'ਸਹੀ ਜਵਾਬ ਏ ਹੈ ਕਿਉਂਕਿ...' });

                await sql`
          INSERT INTO questions (section_id, type, text, options, correct_answer, explanation, marks, "order")
          VALUES (
            ${sectionId},
            'mcq_single',
            ${questionText}::jsonb,
            ${options}::jsonb,
            ${correctAnswer}::jsonb,
            ${explanation}::jsonb,
            2,
            ${i}
          )
        `;
            }
            console.log(`✅ Section "${sec.name.en}" created with 5 questions`);
        }

        // Create exam schedule (active now + 24 hours)
        const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        await sql`
      INSERT INTO exam_schedules (exam_id, start_time, end_time)
      VALUES (${examId}, ${now}, ${endTime})
    `;
        console.log('✅ Exam schedule created (active for next 24 hours)');
    }

    // Assign exam to all students
    const allStudents = await sql`SELECT id FROM students`;
    for (const student of allStudents) {
        const exists = await sql`SELECT id FROM exam_assignments WHERE exam_id = ${examId} AND student_id = ${student.id}`;
        if (exists.length === 0) {
            await sql`
        INSERT INTO exam_assignments (exam_id, student_id)
        VALUES (${examId}, ${student.id})
      `;
        }
    }
    console.log('✅ Exam assigned to all students');

    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n📝 Login credentials:');
    console.log('Admin: admin@meritentrance.com / admin123');
    console.log('Student: SOE2026001 / student123');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    });
