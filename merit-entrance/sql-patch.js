const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function run() {
  const client = new Client({ connectionString: process.env.MERIT_DATABASE_URL });
  await client.connect();
  console.log("Connected to Neon DB.");
  
  await client.query('DROP TABLE IF EXISTS document_chunks CASCADE;');
  console.log("Dropped table.");
  
  await client.query(`
    CREATE TABLE document_chunks (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      reference_material_id UUID NOT NULL REFERENCES reference_materials(id) ON DELETE CASCADE,
      page_number INT,
      chunk_index INT NOT NULL,
      content TEXT NOT NULL,
      embedding vector(3072),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log("Created table with vector(3072).");
  await client.end();
}
run();
