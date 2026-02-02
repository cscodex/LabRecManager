
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local manually since we are running a script
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL;

if (!dbUrl) {
    console.error('Database URL not found in .env or .env.local');
    process.exit(1);
}

const sql = neon(dbUrl);

async function runMigration() {
    console.log('Running Phone Auth Migration...');
    try {
        await sql`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
        `;
        console.log('Added phone_verified column.');

        await sql`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
        `;
        console.log('Added firebase_uid column.');

        console.log('Migration successful!');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

runMigration();
