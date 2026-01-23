import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

async function runMigration() {
    console.log('Running query_logs migration...');

    try {
        // Create table
        await sql`
            CREATE TABLE IF NOT EXISTS query_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                route VARCHAR(255) NOT NULL,
                method VARCHAR(10) NOT NULL,
                query TEXT,
                params TEXT,
                success BOOLEAN DEFAULT true,
                error TEXT,
                duration INTEGER,
                user_id UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `;
        console.log('Table created!');

        // Create indexes
        await sql`CREATE INDEX IF NOT EXISTS idx_query_logs_success_created_at ON query_logs (success, created_at)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_query_logs_route ON query_logs (route)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON query_logs (created_at DESC)`;
        console.log('Indexes created!');

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

runMigration();
