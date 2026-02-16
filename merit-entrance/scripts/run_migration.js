require('dotenv').config({ path: '.env' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL);

async function runMigration() {
    console.log('Running migration: Add timestamps to questions table...');
    try {
        await sql`
            ALTER TABLE questions 
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
        `;

        await sql`CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at DESC)`;

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    }
}

runMigration();
