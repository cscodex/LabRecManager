
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL!);

async function verifySectionAnalytics() {
    console.log('🧪 Verifying Section Analytics...');

    try {
        // 1. Get SOE2K25 Exam
        const exams = await sql`
            SELECT id, title FROM exams 
            WHERE title->>'en' LIKE '%SOE2K25%' 
            LIMIT 1
        `;
        if (exams.length === 0) throw new Error('Exam SOE2K25 not found');
        const exam = exams[0];
        console.log(`✅ Exam: ${JSON.stringify(exam.title)}`);

        // 2. Fetch Sections with Analytics (Mirroring API Logic)
        const sections = await sql`
            SELECT 
                s.id,
                s.name,
                (SELECT COUNT(*) FROM questions WHERE section_id = s.id) as question_count,
                (
                    SELECT COALESCE(AVG(difficulty), 1.0) 
                    FROM questions 
                    WHERE section_id = s.id
                ) as avg_difficulty
            FROM sections s
            WHERE s.exam_id = ${exam.id}
            ORDER BY s."order"
        `;

        if (sections.length === 0) console.warn('⚠️ No sections found.');

        // 3. Display Results
        console.log('\n📊 Section Analysis:');
        sections.forEach((s: any) => {
            const diff = parseFloat(s.avg_difficulty).toFixed(1);
            console.log(`   - [Section] ${s.name.en || s.name}: ${s.question_count} Qs | Avg Diff: ${diff}`);
        });

        const hasDifficulty = sections.some((s: any) => parseFloat(s.avg_difficulty) > 1.0);
        if (hasDifficulty) {
            console.log('\n✅ Verification Passed: Difficulty data is present and varying.');
        } else {
            console.log('\n⚠️ Verification Check: All sections have default difficulty (1.0). Did the AI backfill work?');
        }

    } catch (error) {
        console.error('Verification Failed:', error);
    }
}

verifySectionAnalytics();
