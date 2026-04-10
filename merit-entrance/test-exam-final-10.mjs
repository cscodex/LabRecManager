import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

let cleanDbUrl = (process.env.DATABASE_URL || process.env.MERIT_DATABASE_URL).trim().replace(/^["']|["']$/g, '');
if (cleanDbUrl.startsWith('postgresql://')) cleanDbUrl = 'postgres://' + cleanDbUrl.substring(13);

const pool = new Pool({ connectionString: cleanDbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
    try {
        console.log("Fetching correct users from DB natively...");
        const adminRes = await pool.query("SELECT id FROM \"User\" WHERE role = 'admin' LIMIT 1");
        const realAdminId = adminRes.rows[0].id;
        console.log("Found real Admin UUID:", realAdminId);
        
        console.log("Fetching blueprints from live server...");
        const bpRes = await fetch('http://localhost:3000/api/admin/blueprints');
        const bpData = await bpRes.json();
        const blueprint = bpData.data[0];
        console.log("Using Blueprint:", blueprint.id);
        
        console.log("Triggering live RAG generate route...");
        const res = await fetch('http://localhost:3000/api/admin/exams/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                 blueprintId: blueprint.id,
                 title: 'Test-09',
                 description: 'RAG Generated AI Test for CBSE Computer Science',
                 duration: 60,
                 createdById: realAdminId, 
                 allowAiGenerationForMissing: true
            })
        });
        
        const text = await res.text();
        console.log("Raw Response:");
        console.log(text);
    } catch(e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}
run();
