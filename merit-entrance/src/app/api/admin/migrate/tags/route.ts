import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL!);

// POST - Run tag migration
export async function POST() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ error: 'Unauthorized - superadmin only' }, { status: 401 });
        }

        // Create tags table
        await sql`
            CREATE TABLE IF NOT EXISTS tags (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `;

        // Add tag_id to questions if not exists
        await sql`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'questions' AND column_name = 'tag_id'
                ) THEN
                    ALTER TABLE questions ADD COLUMN tag_id UUID REFERENCES tags(id);
                END IF;
            END $$
        `;

        // Create index for faster lookups
        await sql`
            CREATE INDEX IF NOT EXISTS idx_questions_tag_id ON questions(tag_id)
        `;

        return NextResponse.json({
            success: true,
            message: 'Tags migration completed successfully'
        });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({
            error: 'Migration failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
