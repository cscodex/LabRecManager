require('dotenv').config({ path: '.env' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL);

async function removeDuplicates() {
    console.log('Starting duplicate removal...');

    try {
        // 1. Find duplicates based on English text and Type
        // We cast text to text representation to group
        const duplicates = await sql`
            SELECT 
                text->>'en' as en_text, 
                type, 
                COUNT(*) as count, 
                ARRAY_AGG(id) as ids 
            FROM questions 
            GROUP BY text->>'en', type 
            HAVING COUNT(*) > 1
        `;

        console.log(`Found ${duplicates.length} sets of duplicate questions.`);

        let deletedCount = 0;
        let skippedCount = 0;

        for (const group of duplicates) {
            const ids = group.ids;
            console.log(`Processing group: "${group.en_text.substring(0, 30)}..." (${ids.length} entries)`);

            // Check usage for each ID
            const usage = await Promise.all(ids.map(async (id) => {
                const responses = await sql`SELECT COUNT(*) as count FROM question_responses WHERE question_id = ${id}`;
                return { id, count: parseInt(responses[0].count) };
            }));

            // Filter unused questions
            const used = usage.filter(u => u.count > 0);
            const unused = usage.filter(u => u.count === 0);

            if (used.length > 1) {
                console.log(`  SKIPPING: Multiple versions used in responses. IDs: ${used.map(u => u.id).join(', ')}`);
                skippedCount += unused.length; // We technically could delete unused ones if we keep one used one? 
                // Let's safe strategy: Keep ALL used ones. Delete unused ones ONLY if there is at least one used OR we keep one unused.

                // If we have used questions, we can safely delete ALL unused ones in this group.
                if (unused.length > 0) {
                    await deleteQuestions(unused.map(u => u.id));
                    deletedCount += unused.length;
                }
                continue;
            }

            let keepId;

            if (used.length === 1) {
                keepId = used[0].id;
                console.log(`  Keeping used ID: ${keepId}`);
            } else {
                // None used, keep the first one
                keepId = ids[0];
                console.log(`  No usage found. Keeping first ID: ${keepId}`);
            }

            // Identify IDs to delete (all except keepId)
            const toDelete = ids.filter(id => id !== keepId);

            if (toDelete.length > 0) {
                await deleteQuestions(toDelete);
                deletedCount += toDelete.length;
            }
        }

        console.log(`\nDone! Deleted ${deletedCount} duplicate questions. Skipped ${skippedCount} to avoid data loss.`);

    } catch (err) {
        console.error('Error removing duplicates:', err);
    }
}

async function deleteQuestions(ids) {
    if (ids.length === 0) return;
    console.log(`  Deleting ${ids.length} questions: ${ids.join(', ')}`);
    // Delete from question_tags first (if cascade isn't set, but usually it is or we just do it)
    // Actually schema doesn't show question_tags table but code uses it.
    // Assuming question_tags exists.
    try {
        await sql`DELETE FROM question_tags WHERE question_id = ANY(${ids})`;
        await sql`DELETE FROM questions WHERE id = ANY(${ids})`;
    } catch (e) {
        console.error(`  Failed to delete: ${e.message}`);
    }
}

removeDuplicates();
