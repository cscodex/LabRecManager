const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '';

async function findDuplicates() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        // 1. Find all questions containing "True or False" and "tuple" and "list"
        const results = await client.query(`
      SELECT 
        q.id, 
        q.text::text,
        q.type,
        q.marks,
        q.section_id,
        q.correct_answer::text,
        s.name::text as section_name,
        e.title::text as exam_title,
        e.id as exam_id
      FROM questions q
      LEFT JOIN sections s ON q.section_id = s.id
      LEFT JOIN exams e ON s.exam_id = e.id
      WHERE q.text::text ILIKE '%True or False%'
        AND q.text::text ILIKE '%tuple%'
        AND q.text::text ILIKE '%list%'
      ORDER BY e.title, s.name, q.id
    `);

        console.log(`Found ${results.rows.length} matching questions:\n`);
        console.log('='.repeat(120));

        for (const row of results.rows) {
            // Parse the text to show a readable snippet
            let textSnippet = '';
            try {
                const parsed = JSON.parse(row.text);
                textSnippet = (parsed.en || '').substring(0, 100);
            } catch {
                textSnippet = row.text?.substring(0, 100) || '';
            }

            console.log(`ID: ${row.id}`);
            console.log(`  Text: ${textSnippet}...`);
            console.log(`  Type: ${row.type} | Marks: ${row.marks} | Answer: ${row.correct_answer}`);
            console.log(`  Section: ${row.section_name || 'NULL (bank)'}`);
            console.log(`  Exam: ${row.exam_title || 'NULL (unlinked)'} (${row.exam_id || 'N/A'})`);
            console.log('-'.repeat(120));
        }

        // 2. Also check section_questions for any junction links
        if (results.rows.length > 0) {
            const ids = results.rows.map(r => r.id);
            console.log('\n\n=== SECTION_QUESTIONS JUNCTION LINKS ===\n');

            for (const qId of ids) {
                const sqLinks = await client.query(`
          SELECT 
            sq.id as sq_id,
            sq.section_id,
            sq.marks as sq_marks,
            sq."order" as sq_order,
            s.name::text as section_name,
            e.title::text as exam_title,
            e.id as exam_id
          FROM section_questions sq
          JOIN sections s ON sq.section_id = s.id
          JOIN exams e ON s.exam_id = e.id
          WHERE sq.question_id = $1
        `, [qId]);

                if (sqLinks.rows.length > 0) {
                    console.log(`Question ${qId} has ${sqLinks.rows.length} junction link(s):`);
                    for (const link of sqLinks.rows) {
                        console.log(`  → Exam: ${link.exam_title} | Section: ${link.section_name} | Marks: ${link.sq_marks} | Order: ${link.sq_order}`);
                    }
                } else {
                    console.log(`Question ${qId} has NO junction links (orphan in bank or old schema only)`);
                }
            }
        }

        // 3. Group by content to identify true duplicates
        console.log('\n\n=== DUPLICATE GROUPS (by content hash) ===\n');
        const groups = {};
        for (const row of results.rows) {
            let textKey = '';
            try {
                const parsed = JSON.parse(row.text);
                textKey = (parsed.en || '').replace(/\s+/g, ' ').trim().substring(0, 200);
            } catch {
                textKey = (row.text || '').replace(/\s+/g, ' ').trim().substring(0, 200);
            }

            if (!groups[textKey]) groups[textKey] = [];
            groups[textKey].push(row);
        }

        for (const [key, rows] of Object.entries(groups)) {
            console.log(`\nContent: "${key.substring(0, 80)}..."`);
            console.log(`  Copies: ${rows.length}`);
            for (const r of rows) {
                console.log(`    - ID: ${r.id} | Exam: ${r.exam_title || 'Bank'} | Section: ${r.section_name || 'None'}`);
            }
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.end();
    }
}

findDuplicates();
