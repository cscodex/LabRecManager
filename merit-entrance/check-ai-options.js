// Run from merit-entrance directory
const { neon } = require('./node_modules/@neondatabase/serverless');
const sql = neon("postgresql://neondb_owner:npg_zm1Up2KyGqaH@ep-fancy-snow-ahvol2ei-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require");

async function check() {
    const rows = await sql`SELECT id, type, options, correct_answer, is_ai_generated, created_at FROM questions WHERE is_ai_generated = true ORDER BY created_at DESC LIMIT 3`;
    for (const r of rows) {
        console.log('===');
        console.log('ID:', r.id);
        console.log('Type:', r.type);
        console.log('AI Generated:', r.is_ai_generated);
        console.log('Options:', JSON.stringify(r.options));
        console.log('Correct Answer:', JSON.stringify(r.correct_answer));
        console.log('Created:', r.created_at);
    }
}
check().catch(console.error);
