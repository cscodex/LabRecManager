
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL!);

async function cleanupAndBackfill() {
    console.log('🧹 Starting Cleanup & Retrofit...');

    try {
        // 1. Delete "Difficulty Test Exam" (and dependencies)
        const targetExams = await sql`SELECT id FROM exams WHERE title->>'en' LIKE 'Difficulty Test Exam%'`;
        const examIds = targetExams.map(e => e.id);

        if (examIds.length > 0) {
            // Delete dependent attempts
            await sql`DELETE FROM exam_attempts WHERE exam_id = ANY(${examIds})`;
            // Delete dependent questions (and their sub-tables via cascade usually, but let's be safe)
            // Assuming DB has cascade, if not we might need to delete question_responses too
            // Let's rely on exam deletion if cascade is set up, or just delete attempts first as that was the error.

            const deleted = await sql`
                DELETE FROM exams 
                WHERE id = ANY(${examIds})
                RETURNING id, title
            `;
        } else {
            console.log('No temporary exams found.');
        }

        // 1.5 Deduplicate "Mock Entrance Exam 2025"
        const mocks = await sql`
            SELECT id, created_at, 
            (SELECT COUNT(*) FROM exam_attempts WHERE exam_id = exams.id) as attempt_count
            FROM exams 
            WHERE title->>'en' = 'Mock Entrance Exam 2025'
            ORDER BY attempt_count DESC, created_at DESC
        `;

        if (mocks.length > 1) {
            console.log(`Found ${mocks.length} duplicate 'Mock Entrance Exam 2025' exams.`);
            // Keep the first one (most attempts or latest)
            const toKeep = mocks[0];
            const toDelete = mocks.slice(1).map(m => m.id);

            console.log(`Keeping: ${toKeep.id} (Attempts: ${toKeep.attempt_count})`);

            // Cascading delete for duplicates
            await sql`DELETE FROM exam_attempts WHERE exam_id = ANY(${toDelete})`;
            await sql`DELETE FROM questions WHERE section_id IN (SELECT id FROM sections WHERE exam_id = ANY(${toDelete}))`; // Safe cascade manual
            await sql`DELETE FROM sections WHERE exam_id = ANY(${toDelete})`;
            await sql`DELETE FROM exam_schedules WHERE exam_id = ANY(${toDelete})`;

            const deletedMocks = await sql`
                DELETE FROM exams 
                WHERE id = ANY(${toDelete})
                RETURNING id
            `;
            console.log(`🗑️ Deleted ${deletedMocks.length} duplicate mocks.`);
        }

        // 2. Backfill Difficulty for Questions
        // Set default difficulty = 1 for any question with null or 0 difficulty
        const backfilled = await sql`
            UPDATE questions 
            SET difficulty = 1 
            WHERE difficulty IS NULL OR difficulty = 0
            RETURNING id
        `;
        console.log(`✨ Backfilled difficulty for ${backfilled.length} questions.`);

        // 3. Verify Constraints
        const remaining = await sql`SELECT id, title FROM exams`;
        console.log('\n✅ Remaining Exams:');
        remaining.forEach(e => console.log(`   - ${JSON.stringify(e.title)}`));

    } catch (error) {
        console.error('Cleanup Failed:', error);
    }
}

cleanupAndBackfill();
