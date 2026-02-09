const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'resultsql.rd');
const outputFile = path.join(__dirname, 'update_tags.sql');

try {
    let fileContent = fs.readFileSync(inputFile, 'utf8');
    // Handle concatenated arrays like `][` -> `,` and merge
    // Or just find all objects.
    // The file format seems to be `[{...}]` then newline then `[{...}]`.
    // Let's try to match all JSON arrays and merge them.

    let questions = [];
    // Split by closing bracket and newline to potentially separate arrays
    const chunks = fileContent.split(/\]\s*\[/);

    if (chunks.length > 1) {
        const joined = chunks.join(',');
        // Ensure beginning and end are correct
        // The split removes `] [` so we need to reconstruct if we were to parse as one string
        // OR just parse each chunk wrapped in brackets if needed.

        // Safer: find all occurrences of `\[.*?\]` is hard with nesting.
        // Let's blindly replace `][` with `,` inside the string if it's like `...}] [{...`
        fileContent = fileContent.replace(/\]\s*\[/g, ',');
    }

    try {
        questions = JSON.parse(fileContent);
    } catch (e) {
        // If simple parse fails, maybe it's multiple root arrays
        console.log("Direct parse failed, trying regex extraction");
        // This is a bit hacky but might work for simple dumps
        const matches = fileContent.match(/\{"id":.*?\}/g);
        if (matches) {
            questions = matches.map(m => JSON.parse(m));
        }
    }

    if (!Array.isArray(questions) || questions.length === 0) {
        console.error("No questions found or invalid format");
        process.exit(1);
    }

    console.log(`Found ${questions.length} questions.`);

    const tags2Create = new Set(['SOE2K25']);
    const questionTags = [];

    // Helper to extract Subject from Section Name
    // Format: "{\"en\": \"Science(Part-II)\", ...}"
    function getSubject(sectionJsonStr) {
        if (!sectionJsonStr) return null;
        try {
            const obj = JSON.parse(sectionJsonStr);
            const enName = obj.en || '';
            // Extract "Science" from "Science(Part-II)"
            const match = enName.match(/^([a-zA-Z\s]+)/);
            if (match) return match[1].trim();
            return enName;
        } catch (e) {
            return null;
        }
    }

    questions.forEach(q => {
        const subject = getSubject(q.section_name);
        if (subject) {
            tags2Create.add(subject);
            questionTags.push({ qId: q.id, tagName: subject });
        }
        // Always add SOE2K25 tag
        questionTags.push({ qId: q.id, tagName: 'SOE2K25' });
    });

    const uniqueTags = Array.from(tags2Create);

    let sql = '-- 1. Insert Tags\n';
    sql += 'INSERT INTO tags (name) VALUES \n';
    sql += uniqueTags.map(t => `('${t}')`).join(',\n');
    sql += '\nON CONFLICT (name) DO NOTHING;\n\n';

    sql += '-- 2. Insert Question Tags\n';
    sql += '-- We look up tag_id by name to ensure referential integrity\n';
    sql += 'INSERT INTO question_tags (question_id, tag_id)\nVALUES\n';

    const values = questionTags.map(qt => {
        return `('${qt.qId}', (SELECT id FROM tags WHERE name = '${qt.tagName}'))`;
    });

    sql += values.join(',\n');
    sql += '\nON CONFLICT (question_id, tag_id) DO NOTHING;\n';

    fs.writeFileSync(outputFile, sql);
    console.log(`SQL written to ${outputFile}`);

} catch (err) {
    console.error("Error:", err);
}
