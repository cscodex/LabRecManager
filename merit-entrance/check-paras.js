const { Client } = require('pg');
require('dotenv').config();
const c = new Client({ connectionString: process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '' });

(async () => {
    await c.connect();

    const exams = await c.query(`
    SELECT DISTINCT s.exam_id, e.title->>'en' as title
    FROM section_questions sq
    JOIN questions q ON sq.question_id = q.id
    JOIN sections s ON sq.section_id = s.id
    JOIN exams e ON s.exam_id = e.id
    WHERE q.type = 'paragraph'
    LIMIT 3
  `);

    for (const exam of exams.rows) {
        console.log('EXAM:', exam.title, '| ID:', exam.exam_id);

        const qs = await c.query(`
      SELECT q.id, q.type, q.text->>'en' as text_en, q.parent_id, q.paragraph_id,
             p.text as para_title
      FROM section_questions sq
      JOIN questions q ON q.id = sq.question_id
      JOIN sections s ON sq.section_id = s.id
      LEFT JOIN paragraphs p ON q.paragraph_id = p.id
      WHERE s.exam_id = $1
      ORDER BY s."order", sq."order"
    `, [exam.exam_id]);

        console.log('  Total questions in section_questions:', qs.rows.length);

        const paraQs = qs.rows.filter(q => q.type === 'paragraph');
        const childQs = qs.rows.filter(q => q.parent_id);
        const orphanChildQs = childQs.filter(ch => !qs.rows.find(p => p.id === ch.parent_id));
        const selfParaQs = qs.rows.filter(q => q.paragraph_id && q.type !== 'paragraph');

        console.log('  Paragraph-type questions:', paraQs.length);
        console.log('  Child questions (have parent_id):', childQs.length);
        console.log('  Orphan children (parent NOT in result):', orphanChildQs.length);
        console.log('  Questions with own paragraph_id:', selfParaQs.length);

        for (const pq of paraQs) {
            console.log('  PARA:', (pq.text_en || '').substring(0, 40), '| para_title:', pq.para_title ? JSON.stringify(pq.para_title).substring(0, 50) : 'null');
            const children = childQs.filter(ch => ch.parent_id === pq.id);
            console.log('     Children in section_questions:', children.length);
        }
        console.log('');
    }

    await c.end();
})();
