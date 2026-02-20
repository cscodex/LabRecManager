const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
neonConfig.webSocketConstructor = ws;

async function run() {
    const pool = new Pool({ connectionString: process.env.MERIT_DIRECT_URL });
    try {
        await pool.query(`ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "verification_token" TEXT`);
        await pool.query(`ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "verification_expires" TIMESTAMP(3)`);
        console.log("Migration applied successfully!");
    } catch (err) {
        console.error("Migration failed", err);
    } finally {
        await pool.end();
    }
}
run();
