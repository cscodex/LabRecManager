import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Use MERIT_DATABASE_URL or fallback to DATABASE_URL
const dbUrl = process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
    throw new Error('No database URL found. Set MERIT_DATABASE_URL or DATABASE_URL');
}
const sql = neon(dbUrl);

async function addParagraphDemoData() {
    try {
        console.log('🔍 Finding SOE2k25 exam and English section...');

        // Find the exam
        const exams = await sql`
            SELECT id, title FROM exams WHERE title->>'en' ILIKE '%SOE%2025%' OR title->>'en' ILIKE '%SOE2k25%'
        `;

        if (exams.length === 0) {
            console.log('❌ No SOE2k25 exam found. Creating one...');
            const newExam = await sql`
                INSERT INTO exams (title, description, duration, total_marks, status)
                VALUES (
                    '{"en": "SOE 2025 Entrance Test", "pa": "SOE 2025 ਦਾਖਲਾ ਪ੍ਰੀਖਿਆ"}',
                    '{"en": "School of Eminence 2025 Entrance Examination", "pa": "School of Eminence 2025 ਦਾਖਲਾ ਪ੍ਰੀਖਿਆ"}',
                    90,
                    100,
                    'active'
                )
                RETURNING id, title
            `;
            console.log('✅ Created exam:', newExam[0].id);
        }

        // Get the exam
        const exam = (await sql`
            SELECT id, title FROM exams WHERE title->>'en' ILIKE '%SOE%' LIMIT 1
        `)[0];

        if (!exam) {
            throw new Error('Could not find or create exam');
        }

        console.log('📚 Found exam:', exam.title.en, '(ID:', exam.id, ')');

        // Find or create English section
        let sections = await sql`
            SELECT id, name FROM sections WHERE exam_id = ${exam.id} AND name->>'en' ILIKE '%English%'
        `;

        if (sections.length === 0) {
            console.log('📝 Creating English section...');
            const newSection = await sql`
                INSERT INTO sections (exam_id, name, "order")
                VALUES (${exam.id}, '{"en": "English", "pa": "ਅੰਗਰੇਜ਼ੀ"}', 1)
                RETURNING id, name
            `;
            sections = newSection;
        }

        const englishSection = sections[0];
        console.log('📖 Using section:', englishSection.name.en, '(ID:', englishSection.id, ')');

        // Get current max order
        const maxOrderResult = await sql`
            SELECT COALESCE(MAX("order"), 0) as max_order FROM questions WHERE section_id = ${englishSection.id}
        `;
        let currentOrder = maxOrderResult[0].max_order;

        // Create a paragraph question
        console.log('\n📄 Creating paragraph (passage) question...');
        const paragraphText = `The Amazon Rainforest, often referred to as the "lungs of the Earth," is the world's largest tropical rainforest, covering over 5.5 million square kilometers across nine countries in South America. This vast ecosystem is home to approximately 10% of all species on Earth, including jaguars, pink river dolphins, and countless species of birds and insects.

The forest plays a crucial role in regulating the global climate by absorbing carbon dioxide and releasing oxygen. Scientists estimate that the Amazon produces about 20% of the world's oxygen. However, deforestation for agriculture and logging has threatened this vital ecosystem, with millions of acres being lost each year.

Conservation efforts are underway to protect the Amazon, including the establishment of protected areas and programs to support sustainable forestry practices. Many indigenous communities who have lived in harmony with the forest for generations are key partners in these conservation efforts.`;

        currentOrder++;
        const paragraph = await sql`
            INSERT INTO questions (
                section_id, type, text, paragraph_text, options, correct_answer, 
                explanation, marks, negative_marks, "order"
            )
            VALUES (
                ${englishSection.id},
                'paragraph',
                '{"en": "The Amazon Rainforest - Comprehension Passage", "pa": "ਐਮਾਜ਼ੋਨ ਰੇਨਫੋਰੈਸਟ - ਸਮਝ ਪੈਰਾ"}',
                ${{ en: paragraphText, pa: paragraphText }},
                NULL,
                '[]',
                NULL,
                0,
                0,
                ${currentOrder}
            )
            RETURNING id
        `;

        const paragraphId = paragraph[0].id;
        console.log('✅ Created paragraph question ID:', paragraphId);

        // Create sub-questions linked to the paragraph
        const subQuestions = [
            {
                text: { en: 'What percentage of the world\'s species are found in the Amazon Rainforest?', pa: 'ਐਮਾਜ਼ੋਨ ਰੇਨਫੋਰੈਸਟ ਵਿੱਚ ਦੁਨੀਆ ਦੀਆਂ ਕਿੰਨੀਆਂ ਪ੍ਰਤੀਸ਼ਤ ਪ੍ਰਜਾਤੀਆਂ ਪਾਈਆਂ ਜਾਂਦੀਆਂ ਹਨ?' },
                options: [
                    { id: 'a', text: { en: '5%', pa: '5%' } },
                    { id: 'b', text: { en: '10%', pa: '10%' } },
                    { id: 'c', text: { en: '20%', pa: '20%' } },
                    { id: 'd', text: { en: '50%', pa: '50%' } }
                ],
                correctAnswer: ['b'],
                explanation: { en: 'The passage states that the Amazon is home to approximately 10% of all species on Earth.', pa: 'ਪੈਰੇ ਵਿੱਚ ਕਿਹਾ ਗਿਆ ਹੈ ਕਿ ਐਮਾਜ਼ੋਨ ਧਰਤੀ ਦੀਆਂ ਲਗਭਗ 10% ਪ੍ਰਜਾਤੀਆਂ ਦਾ ਘਰ ਹੈ।' }
            },
            {
                text: { en: 'Why is the Amazon Rainforest called the "lungs of the Earth"?', pa: 'ਐਮਾਜ਼ੋਨ ਰੇਨਫੋਰੈਸਟ ਨੂੰ "ਧਰਤੀ ਦੇ ਫੇਫੜੇ" ਕਿਉਂ ਕਿਹਾ ਜਾਂਦਾ ਹੈ?' },
                options: [
                    { id: 'a', text: { en: 'Because it is shaped like lungs', pa: 'ਕਿਉਂਕਿ ਇਸਦਾ ਆਕਾਰ ਫੇਫੜਿਆਂ ਵਰਗਾ ਹੈ' } },
                    { id: 'b', text: { en: 'Because it absorbs CO₂ and produces oxygen', pa: 'ਕਿਉਂਕਿ ਇਹ CO₂ ਸੋਖਦਾ ਹੈ ਅਤੇ ਆਕਸੀਜਨ ਪੈਦਾ ਕਰਦਾ ਹੈ' } },
                    { id: 'c', text: { en: 'Because it has lung-like plants', pa: 'ਕਿਉਂਕਿ ਇਸ ਵਿੱਚ ਫੇਫੜਿਆਂ ਵਰਗੇ ਪੌਦੇ ਹਨ' } },
                    { id: 'd', text: { en: 'Because it is very humid', pa: 'ਕਿਉਂਕਿ ਇਹ ਬਹੁਤ ਨਮੀ ਵਾਲਾ ਹੈ' } }
                ],
                correctAnswer: ['b'],
                explanation: { en: 'The forest absorbs carbon dioxide and releases oxygen, producing about 20% of the world\'s oxygen.', pa: 'ਜੰਗਲ ਕਾਰਬਨ ਡਾਈਆਕਸਾਈਡ ਨੂੰ ਸੋਖਦਾ ਹੈ ਅਤੇ ਆਕਸੀਜਨ ਛੱਡਦਾ ਹੈ, ਜੋ ਦੁਨੀਆ ਦੀ ਲਗਭਗ 20% ਆਕਸੀਜਨ ਪੈਦਾ ਕਰਦਾ ਹੈ।' }
            },
            {
                text: { en: 'What is the main threat to the Amazon Rainforest mentioned in the passage?', pa: 'ਪੈਰੇ ਵਿੱਚ ਐਮਾਜ਼ੋਨ ਰੇਨਫੋਰੈਸਟ ਲਈ ਮੁੱਖ ਖ਼ਤਰਾ ਕੀ ਦੱਸਿਆ ਗਿਆ ਹੈ?' },
                options: [
                    { id: 'a', text: { en: 'Floods and earthquakes', pa: 'ਹੜ੍ਹ ਅਤੇ ਭੂਚਾਲ' } },
                    { id: 'b', text: { en: 'Deforestation for agriculture and logging', pa: 'ਖੇਤੀਬਾੜੀ ਅਤੇ ਲੌਗਿੰਗ ਲਈ ਜੰਗਲਾਂ ਦੀ ਕਟਾਈ' } },
                    { id: 'c', text: { en: 'Pollution from factories', pa: 'ਫੈਕਟਰੀਆਂ ਤੋਂ ਪ੍ਰਦੂਸ਼ਣ' } },
                    { id: 'd', text: { en: 'Overpopulation', pa: 'ਵੱਧ ਆਬਾਦੀ' } }
                ],
                correctAnswer: ['b'],
                explanation: { en: 'The passage mentions that deforestation for agriculture and logging has threatened this vital ecosystem.', pa: 'ਪੈਰੇ ਵਿੱਚ ਦੱਸਿਆ ਗਿਆ ਹੈ ਕਿ ਖੇਤੀਬਾੜੀ ਅਤੇ ਲੌਗਿੰਗ ਲਈ ਜੰਗਲਾਂ ਦੀ ਕਟਾਈ ਨੇ ਇਸ ਮਹੱਤਵਪੂਰਨ ਵਾਤਾਵਰਣ ਨੂੰ ਖ਼ਤਰੇ ਵਿੱਚ ਪਾਇਆ ਹੈ।' }
            },
            {
                text: { en: 'Who are the key partners in Amazon conservation efforts?', pa: 'ਐਮਾਜ਼ੋਨ ਸੰਭਾਲ ਯਤਨਾਂ ਵਿੱਚ ਮੁੱਖ ਭਾਈਵਾਲ ਕੌਣ ਹਨ?' },
                options: [
                    { id: 'a', text: { en: 'Foreign governments', pa: 'ਵਿਦੇਸ਼ੀ ਸਰਕਾਰਾਂ' } },
                    { id: 'b', text: { en: 'Large corporations', pa: 'ਵੱਡੀਆਂ ਕਾਰਪੋਰੇਸ਼ਨਾਂ' } },
                    { id: 'c', text: { en: 'Indigenous communities', pa: 'ਮੂਲ ਨਿਵਾਸੀ ਭਾਈਚਾਰੇ' } },
                    { id: 'd', text: { en: 'Tourism companies', pa: 'ਸੈਰ-ਸਪਾਟਾ ਕੰਪਨੀਆਂ' } }
                ],
                correctAnswer: ['c'],
                explanation: { en: 'Indigenous communities who have lived in harmony with the forest for generations are key partners in conservation efforts.', pa: 'ਮੂਲ ਨਿਵਾਸੀ ਭਾਈਚਾਰੇ ਜੋ ਪੀੜ੍ਹੀਆਂ ਤੋਂ ਜੰਗਲ ਨਾਲ ਮੇਲ-ਮਿਲਾਪ ਨਾਲ ਰਹਿੰਦੇ ਆਏ ਹਨ, ਸੰਭਾਲ ਯਤਨਾਂ ਵਿੱਚ ਮੁੱਖ ਭਾਈਵਾਲ ਹਨ।' }
            }
        ];

        console.log('\n📝 Creating sub-questions linked to paragraph...');
        for (const subQ of subQuestions) {
            currentOrder++;
            await sql`
                INSERT INTO questions (
                    section_id, type, text, options, correct_answer, 
                    explanation, marks, negative_marks, "order", parent_id
                )
                VALUES (
                    ${englishSection.id},
                    'mcq_single',
                    ${JSON.stringify(subQ.text)},
                    ${JSON.stringify(subQ.options)},
                    ${JSON.stringify(subQ.correctAnswer)},
                    ${JSON.stringify(subQ.explanation)},
                    2,
                    0.5,
                    ${currentOrder},
                    ${paragraphId}
                )
            `;
            console.log('  ✅ Created sub-question:', subQ.text.en.substring(0, 50) + '...');
        }

        // Find and assign student
        console.log('\n👤 Finding student SOE2026003...');
        const students = await sql`
            SELECT id, name, roll_number FROM students 
            WHERE roll_number = 'SOE2026003'
        `;

        if (students.length === 0) {
            console.log('❌ Student SOE2026003 not found. Creating one...');
            const bcrypt = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash('password123', 10);
            await sql`
                INSERT INTO students (name, roll_number, password_hash)
                VALUES (
                    'Test Student',
                    'SOE2026003',
                    ${hashedPassword}
                )
            `;
            console.log('✅ Created student SOE2026003');
        }

        const student = (await sql`
            SELECT id, name, roll_number FROM students 
            WHERE roll_number = 'SOE2026003'
        `)[0];

        console.log('👤 Found student:', student.name, '(', student.roll_number, ')');

        // Check if already assigned
        const existingAssignment = await sql`
            SELECT id FROM exam_assignments WHERE exam_id = ${exam.id} AND student_id = ${student.id}
        `;

        if (existingAssignment.length === 0) {
            console.log('📋 Assigning exam to student...');
            await sql`
                INSERT INTO exam_assignments (exam_id, student_id)
                VALUES (${exam.id}, ${student.id})
            `;
            console.log('✅ Assigned exam to student');
        } else {
            console.log('ℹ️ Exam already assigned to student');
        }

        // Create schedule (now till Jan 26 2026)
        console.log('\n📅 Creating exam schedule...');
        const now = new Date();
        const endDate = new Date('2026-01-26T23:59:59+05:30');

        // Remove any existing schedules for this exam
        await sql`DELETE FROM exam_schedules WHERE exam_id = ${exam.id}`;

        await sql`
            INSERT INTO exam_schedules (exam_id, start_time, end_time)
            VALUES (${exam.id}, ${now.toISOString()}, ${endDate.toISOString()})
        `;

        console.log('✅ Scheduled exam from', now.toISOString(), 'to', endDate.toISOString());

        console.log('\n🎉 Demo data setup complete!');
        console.log('   Exam ID:', exam.id);
        console.log('   Section ID:', englishSection.id);
        console.log('   Paragraph ID:', paragraphId);
        console.log('   Student:', student.roll_number);

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
}

addParagraphDemoData();
