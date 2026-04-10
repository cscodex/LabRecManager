import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
let cleanDbUrl = (process.env.DATABASE_URL || process.env.MERIT_DATABASE_URL).trim().replace(/^["']|["']$/g, '');
if (cleanDbUrl.startsWith('postgresql://')) cleanDbUrl = 'postgres://' + cleanDbUrl.substring(13);
const pool = new Pool({ connectionString: cleanDbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
    try {
        console.log("Checking for Test-09 in DB using correct schema...");
        // Neon pg schemas are usually lowercase strings unless double-quoted in Prisma schema
        const res = await pool.query("SELECT id, title, status FROM \"Exam\" WHERE title = 'Test-09'");
        if (res.rows.length > 0) {
            console.log("SUCCESS! Exam found:", res.rows[0]);
        } else {
            console.log("FAILED. No Exam named 'Test-09' was created.");
            const all = await pool.query("SELECT title FROM \"Exam\" ORDER BY title DESC LIMIT 5");
            console.log("Latest exams:", all.rows.map(r=>r.title));
        }
    } catch(e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
