require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL);

async function run() {
    try {
        console.log('Reading setup_tags_schema.sql...');
        const sqlContent = fs.readFileSync(path.join(__dirname, 'setup_tags_schema.sql'), 'utf-8');

        console.log('Executing Schema Setup with sql.query...');
        // Correct usage based on probe: sql.query(text, params)
        // Since sqlContent might contain multiple statements, verify if neon supports it.
        // Usually, serverless driver supports multiple statements in one query call.

        await sql(sqlContent, []);

        console.log('Successfully executed setup_tags_schema.sql');
    } catch (error) {
        console.error('Error executing SQL:', error);
        // Fallback: splitting statements? No, try simple execution first.
        process.exit(1);
    }
}

run();
