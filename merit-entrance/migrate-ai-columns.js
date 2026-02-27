const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '';

async function migrate() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected\n');

        // Add AI generation columns to questions table
        const columns = [
            {
                name: 'is_ai_generated',
                sql: `ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false`
            },
            {
                name: 'citation',
                sql: `ALTER TABLE questions ADD COLUMN IF NOT EXISTS citation JSONB`
            },
            {
                name: 'quality_score',
                sql: `ALTER TABLE questions ADD COLUMN IF NOT EXISTS quality_score INTEGER`
            }
        ];

        for (const col of columns) {
            try {
                await client.query(col.sql);
                console.log(`✅ Added column: ${col.name}`);
            } catch (err) {
                if (err.code === '42701') {
                    console.log(`⏩ Column already exists: ${col.name}`);
                } else {
                    throw err;
                }
            }
        }

        // Verify
        const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'questions' 
      AND column_name IN ('is_ai_generated', 'citation', 'quality_score')
      ORDER BY column_name
    `);

        console.log('\n=== Verification ===');
        for (const r of result.rows) {
            console.log(`  ${r.column_name}: ${r.data_type} (default: ${r.column_default || 'NULL'})`);
        }

        console.log('\n🎉 Migration complete!');
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.end();
    }
}

migrate();
