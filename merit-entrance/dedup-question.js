const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '';

async function dedup() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected\n');

        const KEEP_ID = 'cc87ce53-35f6-4424-9392-28c96e4f0d52';  // mcq_single - keep this
        const REMOVE_IDS = [
            'ba81615a-9573-4896-a356-3aa4123fb4e1',  // single_choice clone
            'bcfbc5e7-33f5-4f4a-85e3-6d8b644c226f',  // short_answer clone
        ];

        // 1. Verify the keeper
        const keeper = await client.query(`
      SELECT id, text::text, type, options::text, correct_answer::text, marks, section_id
      FROM questions WHERE id = $1
    `, [KEEP_ID]);

        console.log('=== KEEPING (canonical) ===');
        const k = keeper.rows[0];
        console.log(`ID: ${k.id}`);
        console.log(`Type: ${k.type}`);
        console.log(`Options: ${k.options}`);
        console.log(`Answer: ${k.correct_answer}`);
        console.log(`Marks: ${k.marks}`);
        console.log(`Section: ${k.section_id}`);

        // 2. Verify junction link exists for keeper
        const keeperLink = await client.query(`
      SELECT * FROM section_questions WHERE question_id = $1
    `, [KEEP_ID]);
        console.log(`\nKeeper has ${keeperLink.rows.length} junction link(s)`);

        // 3. Remove junction links for duplicates
        console.log('\n=== UNLINKING DUPLICATES ===');
        for (const id of REMOVE_IDS) {
            // Remove from section_questions
            const sqResult = await client.query(`
        DELETE FROM section_questions WHERE question_id = $1 RETURNING id, section_id
      `, [id]);
            console.log(`Removed ${sqResult.rows.length} junction link(s) for ${id}`);

            // Set section_id to NULL on base question (unlink but keep in bank)
            await client.query(`
        UPDATE questions SET section_id = NULL WHERE id = $1
      `, [id]);
            console.log(`  Set section_id = NULL for ${id}`);
        }

        // 4. Verify final state
        console.log('\n=== VERIFICATION ===');

        // Keeper should still be linked
        const finalKeeper = await client.query(`
      SELECT sq.*, s.name::text as section_name, e.title::text as exam_title
      FROM section_questions sq
      JOIN sections s ON sq.section_id = s.id
      JOIN exams e ON s.exam_id = e.id
      WHERE sq.question_id = $1
    `, [KEEP_ID]);
        console.log(`\nKeeper (${KEEP_ID}) links:`);
        for (const r of finalKeeper.rows) {
            console.log(`  ✅ Exam: ${r.exam_title} | Section: ${r.section_name} | Marks: ${r.marks} | Order: ${r.order}`);
        }

        // Removed should have NO links
        for (const id of REMOVE_IDS) {
            const check = await client.query(`
        SELECT COUNT(*) as count FROM section_questions WHERE question_id = $1
      `, [id]);
            const bankCheck = await client.query(`
        SELECT section_id FROM questions WHERE id = $1
      `, [id]);
            console.log(`\nRemoved (${id}):`);
            console.log(`  Junction links: ${check.rows[0].count} (should be 0)`);
            console.log(`  section_id: ${bankCheck.rows[0].section_id} (should be null)`);
        }

        console.log('\n🎉 Deduplication complete!');
        console.log('The two duplicates are now unlinked from the exam but still exist in the question bank.');

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.end();
    }
}

dedup();
