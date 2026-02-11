require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || process.env.DATABASE_URL;
console.log('Connection string defined:', !!connectionString);
const sql = neon(connectionString);

async function run() {
    try {
        console.log('Checking columns in questions and tags tables...');
        const result = await sql`
            SELECT table_name, column_name, data_type, udt_name
            FROM information_schema.columns 
            WHERE table_name IN ('questions', 'tags')
            ORDER BY table_name, ordinal_position;
        `;
        console.table(result);
    } catch (error) {
        console.error('Error:', error);
    }
}

run();
