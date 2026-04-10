const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

(async () => {
    const sql = neon(process.env.MERIT_DATABASE_URL);
    const rows = await sql`SELECT id, text, type, difficulty, options, correct_answer, citation, created_at FROM questions WHERE is_ai_generated = true ORDER BY created_at DESC LIMIT 10`;
    console.log(JSON.stringify(rows, null, 2));
})();
