import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

async function addParagraphColumns() {
    console.log('Adding paragraph question columns...\n');

    try {
        // Check if columns exist
        const columns = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'questions' 
            AND column_name IN ('parent_id', 'paragraph_text')
        `;

        const existingColumns = columns.map(c => c.column_name);
        console.log('Existing columns:', existingColumns);

        // Add parent_id column
        if (!existingColumns.includes('parent_id')) {
            await sql`ALTER TABLE questions ADD COLUMN parent_id UUID REFERENCES questions(id) ON DELETE CASCADE`;
            console.log('✓ Added parent_id column');
        } else {
            console.log('○ parent_id column already exists');
        }

        // Add paragraph_text column
        if (!existingColumns.includes('paragraph_text')) {
            await sql`ALTER TABLE questions ADD COLUMN paragraph_text JSONB`;
            console.log('✓ Added paragraph_text column');
        } else {
            console.log('○ paragraph_text column already exists');
        }

        // Create index for parent_id
        await sql`CREATE INDEX IF NOT EXISTS idx_questions_parent_id ON questions(parent_id)`;
        console.log('✓ Created index on parent_id');

        console.log('\nDone!');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

addParagraphColumns();
