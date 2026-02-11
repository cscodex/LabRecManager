require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL);

console.log('Type of sql:', typeof sql);
console.log('Is sql a function?', typeof sql === 'function');
console.log('Does sql have .query?', typeof sql.query);

if (typeof sql.query === 'function') {
    console.log('sql.query is a function.');
} else {
    console.log('sql.query is NOT a function.');
    console.log('Keys on sql:', Object.keys(sql));
}
