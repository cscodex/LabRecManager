const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function run() {
  const client = new Client({ connectionString: process.env.MERIT_DATABASE_URL });
  await client.connect();
  
  const refRes = await client.query('SELECT * FROM reference_materials LIMIT 5;');
  console.log("Reference materials:", refRes.rows);
  await client.end();
}
run();
