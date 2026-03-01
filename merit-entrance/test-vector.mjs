import { GoogleGenerativeAI } from "@google/generative-ai";
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

async function run() {
  const result = await model.embedContent("This is a test paragraph for embeddings.");
  const embeddingVector = result.embedding.values;
  const pgVectorString = `[${embeddingVector.join(',')}]`;
  
  const client = new Client({ connectionString: process.env.MERIT_DATABASE_URL });
  await client.connect();
  
  try {
    const res = await client.query(`
      INSERT INTO document_chunks (
        reference_material_id, 
        chunk_index, 
        content, 
        embedding
      ) VALUES (
        (SELECT id FROM reference_materials LIMIT 1), 
        0, 
        'Test', 
        $1::vector
      ) RETURNING id;
    `, [pgVectorString]);
    console.log("INSERT SUCCESS", res.rows);
  } catch(e) {
    console.error("POSTGRES INSERT ERROR:", e);
  }
  await client.end();
}
run();
