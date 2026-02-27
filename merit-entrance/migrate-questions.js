const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '';

async function createAndMigrate() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        // ============ STEP 1: Create the section_questions table ============
        console.log('--- STEP 1: Creating section_questions table ---');
        await client.query(`
      CREATE TABLE IF NOT EXISTS "section_questions" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "section_id" UUID NOT NULL,
        "question_id" UUID NOT NULL,
        "marks" INTEGER NOT NULL DEFAULT 1,
        "negative_marks" DECIMAL(3,2),
        "order" INTEGER NOT NULL,
        
        CONSTRAINT "section_questions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "section_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "section_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
        console.log('✅ section_questions table created (or already exists)');

        // Create indexes
        await client.query(`CREATE INDEX IF NOT EXISTS "section_questions_section_id_idx" ON "section_questions"("section_id");`);
        await client.query(`CREATE INDEX IF NOT EXISTS "section_questions_question_id_idx" ON "section_questions"("question_id");`);
        console.log('✅ Indexes created\n');

        // ============ STEP 2: Migrate existing data ============
        console.log('--- STEP 2: Migrating existing question associations ---');

        // Find all questions that are currently assigned to a section
        const assignedQuestions = await client.query(`
      SELECT id, section_id, marks, negative_marks, "order"
      FROM questions 
      WHERE section_id IS NOT NULL
    `);

        console.log(`Found ${assignedQuestions.rows.length} questions assigned to sections.`);

        if (assignedQuestions.rows.length === 0) {
            console.log('No data to migrate.');
        } else {
            let migrated = 0;
            let skipped = 0;

            for (const q of assignedQuestions.rows) {
                // Check if this association already exists (idempotent)
                const existing = await client.query(
                    `SELECT id FROM section_questions WHERE section_id = $1 AND question_id = $2`,
                    [q.section_id, q.id]
                );

                if (existing.rows.length > 0) {
                    skipped++;
                    continue;
                }

                await client.query(
                    `INSERT INTO section_questions (section_id, question_id, marks, negative_marks, "order")
           VALUES ($1, $2, $3, $4, $5)`,
                    [q.section_id, q.id, parseInt(q.marks) || 1, q.negative_marks || null, q.order || 0]
                );
                migrated++;
            }

            console.log(`✅ Migrated: ${migrated} associations`);
            console.log(`⏭️  Skipped (already exist): ${skipped}`);
        }

        // ============ STEP 3: Verify ============
        console.log('\n--- STEP 3: Verification ---');
        const totalSQ = await client.query(`SELECT COUNT(*) FROM section_questions`);
        const totalAssigned = await client.query(`SELECT COUNT(*) FROM questions WHERE section_id IS NOT NULL`);

        console.log(`section_questions rows: ${totalSQ.rows[0].count}`);
        console.log(`questions with section_id: ${totalAssigned.rows[0].count}`);

        if (totalSQ.rows[0].count === totalAssigned.rows[0].count) {
            console.log('✅ Counts match! Migration is complete and verified.');
        } else {
            console.log('⚠️  Counts do NOT match. Please investigate.');
        }

        console.log('\n🎉 Done! The section_questions table is populated.');
        console.log('The old columns (section_id, marks, negative_marks, order) on the questions table are still intact as a safety net.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

createAndMigrate();
