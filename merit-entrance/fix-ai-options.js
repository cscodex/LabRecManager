// Fix AI-generated questions: convert options from {en: "text"} to {id: "A", text: {en: "text"}}
// and correct_answer from ["0"] (index) to ["A"] (letter ID)
const { neon } = require('@neondatabase/serverless');
const sql = neon("postgresql://neondb_owner:npg_zm1Up2KyGqaH@ep-fancy-snow-ahvol2ei-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require");

async function fix() {
    // Get all AI-generated questions with options
    const rows = await sql`
        SELECT id, options, correct_answer 
        FROM questions 
        WHERE is_ai_generated = true 
          AND options IS NOT NULL 
          AND jsonb_array_length(options) > 0
    `;

    console.log(`Found ${rows.length} AI-generated questions with options to check.\n`);
    let fixed = 0;

    for (const row of rows) {
        const opts = row.options;
        // Check if already in new format (has "text" key)
        if (opts[0] && opts[0].text) {
            console.log(`  ✓ ${row.id} — already in correct format, skipping.`);
            continue;
        }

        // Convert options: {en: "text"} → {id: "A", text: {en: "text"}}
        const newOptions = opts.map((opt, idx) => ({
            id: String.fromCharCode(65 + idx), // A, B, C, D
            text: { en: opt.en || String(opt) }
        }));

        // Convert correct_answer: ["0"] → ["A"], ["2"] → ["C"], etc.
        let newCorrectAnswer = row.correct_answer;
        if (Array.isArray(row.correct_answer) && row.correct_answer.length > 0) {
            const idx = parseInt(row.correct_answer[0], 10);
            if (!isNaN(idx) && idx >= 0 && idx < opts.length) {
                newCorrectAnswer = [String.fromCharCode(65 + idx)];
            }
        }

        console.log(`  ✏️  ${row.id}:`);
        console.log(`     options: ${JSON.stringify(opts)} → ${JSON.stringify(newOptions)}`);
        console.log(`     correct_answer: ${JSON.stringify(row.correct_answer)} → ${JSON.stringify(newCorrectAnswer)}`);

        // Update in DB
        await sql`
            UPDATE questions 
            SET options = ${JSON.stringify(newOptions)}::jsonb,
                correct_answer = ${JSON.stringify(newCorrectAnswer)}::jsonb
            WHERE id = ${row.id}
        `;
        fixed++;
    }

    console.log(`\n✅ Fixed ${fixed} questions.`);
}

fix().catch(console.error);
