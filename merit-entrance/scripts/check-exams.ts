import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

async function checkExamsTable() {
    console.log('Checking exams table structure...');

    try {
        // Check columns
        const columns = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'exams'
            ORDER BY ordinal_position
        `;

        console.log('Exams table columns:');
        columns.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });

        // Check if instructions column exists
        const hasInstructions = columns.some(c => c.column_name === 'instructions');
        console.log('\nHas instructions column:', hasInstructions);

        if (!hasInstructions) {
            console.log('\nAdding instructions column...');
            await sql`ALTER TABLE exams ADD COLUMN IF NOT EXISTS instructions JSONB`;
            console.log('Instructions column added!');
        }

        // Check a sample exam
        const exams = await sql`SELECT id, title, instructions FROM exams LIMIT 1`;
        if (exams.length > 0) {
            console.log('\nSample exam:');
            console.log('  Title:', exams[0].title);
            console.log('  Instructions:', exams[0].instructions);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkExamsTable();
