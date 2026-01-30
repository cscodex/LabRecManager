import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

async function migrate() {
    console.log('Migrating...');
    try {
        await sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty INTEGER DEFAULT 1 NOT NULL`;
        console.log('✅ Added difficulty column.');
    } catch (e) {
        console.error('Error migrating:', e);
    }
}

migrate();
