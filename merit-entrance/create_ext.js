const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: process.env.MERIT_DIRECT_URL,
    });
    try {
        await client.connect();
        console.log('Connected to Neon PG');
        await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
        console.log('pg_trgm extension verified.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}
main();
