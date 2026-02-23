require('dotenv').config({ path: '.env' });
const { Pool } = require('@neondatabase/serverless');
const pool = new Pool({ connectionString: process.env.MERIT_DATABASE_URL });
pool.connect().then(() => console.log("Pool connected!")).catch(e => console.error("Pool error:", e.message));
