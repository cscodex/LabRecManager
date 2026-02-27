    const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '';

async function bulkDedup() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        // =====================================================
        // PHASE 1: Find all duplicate question groups
        // =====================================================
        console.log('='.repeat(80));
        console.log('PHASE 1: FINDING DUPLICATE GROUPS');
        console.log('='.repeat(80));

        // Normalized text-based duplicate detection
        // We normalize by: lowercasing, stripping LaTeX delimiters, collapsing whitespace
        const allQuestions = await client.query(`
      SELECT 
        q.id, 
        q.text::text as text_raw,
        q.type,
        q.marks,
        q.section_id,
        q.correct_answer::text,
        q.options::text,
        s.name::text as section_name,
        e.title::text as exam_title,
        e.id as exam_id
      FROM questions q
      LEFT JOIN sections s ON q.section_id = s.id
      LEFT JOIN exams e ON s.exam_id = e.id
      WHERE q.parent_id IS NULL
      ORDER BY q.id
    `);

        console.log(`Total questions (non-sub): ${allQuestions.rows.length}\n`);

        // Normalize function to find content-equivalent questions
        function normalize(textRaw) {
            try {
                const parsed = JSON.parse(textRaw);
                let t = parsed.en || parsed.pa || '';
                // Strip LaTeX delimiters
                t = t.replace(/\\\(|\\\)/g, '');
                t = t.replace(/\$([^$]+)\$/g, '$1');
                // Strip HTML tags
                t = t.replace(/<[^>]*>/g, '');
                // Collapse whitespace
                t = t.replace(/\s+/g, ' ').trim().toLowerCase();
                // Remove trailing punctuation differences
                t = t.replace(/[.,:;!?]+$/, '').trim();
                return t;
            } catch {
                return (textRaw || '').replace(/\s+/g, ' ').trim().toLowerCase();
            }
        }

        // Group by normalized text
        const groups = {};
        for (const q of allQuestions.rows) {
            const key = normalize(q.text_raw);
            if (!key || key.length < 15) continue; // skip too-short texts
            if (!groups[key]) groups[key] = [];
            groups[key].push(q);
        }

        // Filter to only groups with duplicates (2+ copies)
        const dupGroups = Object.entries(groups).filter(([_, rows]) => rows.length >= 2);

        console.log(`Found ${dupGroups.length} duplicate groups (questions appearing 2+ times)\n`);

        let totalDupsRemoved = 0;
        let totalGroupsProcessed = 0;

        for (const [key, rows] of dupGroups) {
            totalGroupsProcessed++;

            // Pick the best canonical version:
            // Prefer: mcq_single/mcq_multiple > other types, then prefer one with section_id (linked)
            const sorted = rows.sort((a, b) => {
                // Prefer mcq types
                const typeScore = (t) => t === 'mcq_single' ? 3 : t === 'mcq_multiple' ? 2 : t === 'single_choice' ? 1 : 0;
                const diff = typeScore(b.type) - typeScore(a.type);
                if (diff !== 0) return diff;
                // Then prefer linked (has section_id)
                if (a.section_id && !b.section_id) return -1;
                if (!a.section_id && b.section_id) return 1;
                return 0;
            });

            const keeper = sorted[0];
            const dupes = sorted.slice(1);

            if (totalGroupsProcessed <= 10) {
                // Show first 10 groups in detail
                console.log(`\n--- Group ${totalGroupsProcessed}: "${key.substring(0, 70)}..." (${rows.length} copies) ---`);
                console.log(`  KEEP: ${keeper.id} (${keeper.type}) → Exam: ${keeper.exam_title || 'Bank'}`);
                for (const d of dupes) {
                    console.log(`  REMOVE: ${d.id} (${d.type}) → Exam: ${d.exam_title || 'Bank'}`);
                }
            }

            // Unlink duplicates
            for (const dupe of dupes) {
                // Remove junction links
                await client.query(`DELETE FROM section_questions WHERE question_id = $1`, [dupe.id]);
                // Set section_id to NULL
                await client.query(`UPDATE questions SET section_id = NULL WHERE id = $1`, [dupe.id]);
                totalDupsRemoved++;
            }

            // Ensure keeper has junction links for ALL sections the dupes were in
            // (so no exam loses its question)
            const allSectionIds = new Set();
            for (const r of rows) {
                if (r.section_id) allSectionIds.add(r.section_id);
            }

            for (const secId of allSectionIds) {
                // Check if keeper already has a link to this section
                const existing = await client.query(
                    `SELECT id FROM section_questions WHERE question_id = $1 AND section_id = $2`,
                    [keeper.id, secId]
                );
                if (existing.rows.length === 0) {
                    // Get max order in this section
                    const maxOrd = await client.query(
                        `SELECT COALESCE(MAX("order"), 0) as mx FROM section_questions WHERE section_id = $1`,
                        [secId]
                    );
                    const nextOrder = parseInt(maxOrd.rows[0].mx) + 1;

                    await client.query(
                        `INSERT INTO section_questions (section_id, question_id, marks, negative_marks, "order")
             VALUES ($1, $2, $3, $4, $5)`,
                        [secId, keeper.id, parseInt(keeper.marks) || 1, null, nextOrder]
                    );
                    console.log(`  → Linked keeper ${keeper.id} to section ${secId} (was only in dupe)`);
                }
            }
        }

        if (totalGroupsProcessed > 10) {
            console.log(`\n... and ${totalGroupsProcessed - 10} more groups processed silently.`);
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log(`PHASE 1 RESULTS:`);
        console.log(`  Duplicate groups found: ${dupGroups.length}`);
        console.log(`  Duplicates unlinked: ${totalDupsRemoved}`);
        console.log(`  (Unlinked questions are still in the bank, just not assigned to any section)`);
        console.log(`${'='.repeat(80)}\n`);

        // =====================================================
        // PHASE 2: Verify — count questions per exam before/after
        // =====================================================
        console.log('='.repeat(80));
        console.log('PHASE 2: VERIFICATION');
        console.log('='.repeat(80));

        const examCounts = await client.query(`
      SELECT 
        e.id,
        e.title::text,
        COUNT(DISTINCT sq.question_id) as question_count
      FROM exams e
      JOIN sections s ON s.exam_id = e.id
      JOIN section_questions sq ON sq.section_id = s.id
      GROUP BY e.id, e.title
      ORDER BY e.title
    `);

        console.log('\nQuestions per exam (via section_questions):');
        for (const r of examCounts.rows) {
            let title = 'Unknown';
            try { title = JSON.parse(r.title).en || r.title; } catch { title = r.title; }
            console.log(`  ${title}: ${r.question_count} questions`);
        }

        // =====================================================
        // PHASE 3: Link 3 questions across multiple exams
        // =====================================================
        console.log(`\n${'='.repeat(80)}`);
        console.log('PHASE 3: CROSS-EXAM LINKING (M:N demonstration)');
        console.log('='.repeat(80));

        // Find exams with at least 2 distinct exams
        const exams = await client.query(`
      SELECT id, title::text FROM exams ORDER BY title LIMIT 10
    `);

        if (exams.rows.length < 2) {
            console.log('Need at least 2 exams for cross-linking. Skipping.');
        } else {
            // Pick the first two exams
            const exam1 = exams.rows[0];
            const exam2 = exams.rows[1];

            let exam1Title, exam2Title;
            try { exam1Title = JSON.parse(exam1.title).en; } catch { exam1Title = exam1.title; }
            try { exam2Title = JSON.parse(exam2.title).en; } catch { exam2Title = exam2.title; }

            console.log(`\nExam A: ${exam1Title} (${exam1.id})`);
            console.log(`Exam B: ${exam2Title} (${exam2.id})`);

            // Get sections for exam2
            const exam2Sections = await client.query(
                `SELECT id, name::text FROM sections WHERE exam_id = $1 ORDER BY "order" LIMIT 1`,
                [exam2.id]
            );

            if (exam2Sections.rows.length === 0) {
                console.log('Exam B has no sections, skipping.');
            } else {
                const targetSection = exam2Sections.rows[0];
                let secName;
                try { secName = JSON.parse(targetSection.name).en; } catch { secName = targetSection.name; }
                console.log(`Target section in Exam B: ${secName} (${targetSection.id})`);

                // Pick 3 questions from exam1 that are NOT already in exam2
                const exam1Questions = await client.query(`
          SELECT sq.question_id, q.text::text, sq.marks
          FROM section_questions sq
          JOIN sections s ON sq.section_id = s.id
          JOIN questions q ON q.id = sq.question_id
          WHERE s.exam_id = $1
            AND sq.question_id NOT IN (
              SELECT sq2.question_id FROM section_questions sq2
              JOIN sections s2 ON sq2.section_id = s2.id
              WHERE s2.exam_id = $2
            )
          LIMIT 3
        `, [exam1.id, exam2.id]);

                if (exam1Questions.rows.length === 0) {
                    console.log('No unique questions in Exam A to share. All already shared or no questions.');
                } else {
                    console.log(`\nSharing ${exam1Questions.rows.length} questions from Exam A → Exam B:\n`);

                    // Get max order in target section
                    const maxOrd = await client.query(
                        `SELECT COALESCE(MAX("order"), 0) as mx FROM section_questions WHERE section_id = $1`,
                        [targetSection.id]
                    );
                    let nextOrder = parseInt(maxOrd.rows[0].mx) + 1;

                    for (const q of exam1Questions.rows) {
                        let qText;
                        try { qText = JSON.parse(q.text).en?.substring(0, 60); } catch { qText = q.text?.substring(0, 60); }

                        await client.query(
                            `INSERT INTO section_questions (section_id, question_id, marks, "order")
               VALUES ($1, $2, $3, $4)`,
                            [targetSection.id, q.question_id, parseInt(q.marks) || 1, nextOrder++]
                        );

                        console.log(`  ✅ Linked: "${qText}..." → ${secName} in ${exam2Title}`);
                    }

                    // Verify: these questions should now appear in BOTH exams
                    console.log('\n--- Verification: Shared questions across exams ---');
                    for (const q of exam1Questions.rows) {
                        const links = await client.query(`
              SELECT e.title::text as exam_title, s.name::text as section_name
              FROM section_questions sq
              JOIN sections s ON sq.section_id = s.id
              JOIN exams e ON s.exam_id = e.id
              WHERE sq.question_id = $1
            `, [q.question_id]);

                        let qText;
                        try { qText = JSON.parse(q.text).en?.substring(0, 50); } catch { qText = q.text?.substring(0, 50); }

                        console.log(`\n  Question: "${qText}..."`);
                        for (const link of links.rows) {
                            let et, sn;
                            try { et = JSON.parse(link.exam_title).en; } catch { et = link.exam_title; }
                            try { sn = JSON.parse(link.section_name).en; } catch { sn = link.section_name; }
                            console.log(`    → Exam: ${et} | Section: ${sn}`);
                        }
                    }
                }
            }
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log('🎉 ALL DONE!');
        console.log('='.repeat(80));

    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

bulkDedup();
