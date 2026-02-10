require('dotenv').config({ path: '.env' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL);

async function run() {
    try {
        console.log('Verifying tags schema...');

        // Check if tags table exists
        const tagsTable = await sql`
            SELECT to_regclass('public.tags') as table_exists;
        `;
        console.log('Tags table exists:', tagsTable[0].table_exists !== null);

        // Check if question_tags table exists
        const qtTable = await sql`
            SELECT to_regclass('public.question_tags') as table_exists;
        `;
        console.log('Question_tags table exists:', qtTable[0].table_exists !== null);

        if (tagsTable[0].table_exists && qtTable[0].table_exists) {
            console.log('Schema verification SUCCESS');
        } else {
            console.log('Schema verification FAILED');
        }

    } catch (error) {
        console.error('Error verification:', error);
    }
}

run();
