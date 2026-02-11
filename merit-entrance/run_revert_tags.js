require('dotenv').config({ path: '.env' });
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL;

if (!connectionString) {
    console.error('Error: MERIT_DATABASE_URL or MERIT_DIRECT_URL not found in .env');
    process.exit(1);
}

const sql = neon(connectionString);

async function run() {
    try {
        console.log('Reading revert_tags_schema.sql...');
        const sqlContent = fs.readFileSync(path.join(__dirname, 'revert_tags_schema.sql'), 'utf-8');

        console.log('Executing Revert Schema...');
        // Execute using the same pattern as existing scripts
        await sql([sqlContent]);

        console.log('Successfully executed revert_tags_schema.sql');
    } catch (error) {
        console.error('Error executing SQL:', error);
        process.exit(1);
    }
}

run();
