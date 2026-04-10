import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
let cleanDbUrl = (process.env.DATABASE_URL || process.env.MERIT_DATABASE_URL).trim().replace(/^["']|["']$/g, '');
if (cleanDbUrl.startsWith('postgresql://')) cleanDbUrl = 'postgres://' + cleanDbUrl.substring(13);
const pool = new Pool({ connectionString: cleanDbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
    try {
        console.log("Checking for Test-09 in DB...");
        const res = await pool.query("SELECT id, title, status FROM \"Exam\" WHERE title = 'Test-09'");
        if (res.rows.length > 0) {
            console.log("SUCCESS! Exam found:", res.rows[0]);
        } else {
            console.log("FAILED. No Exam named 'Test-09' was created.");
        }
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
