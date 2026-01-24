import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// Superscript mapping
const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ'
};

// Convert ^X notation to superscript
function convertToSuperscript(text: string): string {
    if (!text) return text;

    // Replace ^{...} patterns (multi-character exponents)
    let result = text.replace(/\^{([^}]+)}/g, (_, chars) => {
        return chars.split('').map((c: string) => superscripts[c] || c).join('');
    });

    // Replace ^X patterns (single character or number sequences like ^23)
    result = result.replace(/\^(\d+)/g, (_, nums) => {
        return nums.split('').map((c: string) => superscripts[c] || c).join('');
    });

    // Replace ^X for single non-digit characters
    result = result.replace(/\^([a-zA-Z+\-=()\d])/g, (_, char) => {
        return superscripts[char] || `^${char}`;
    });

    return result;
}

// Process JSONB field
function processJsonb(obj: any): any {
    if (!obj) return obj;
    if (typeof obj === 'string') return convertToSuperscript(obj);
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => processJsonb(item));
    }

    const result: any = {};
    for (const key of Object.keys(obj)) {
        result[key] = processJsonb(obj[key]);
    }
    return result;
}

async function convertSuperscripts() {
    console.log('Converting ^ to superscripts in questions...\n');

    // Get all questions
    const questions = await sql`SELECT id, text, options, explanation FROM questions`;
    console.log(`Found ${questions.length} questions to process\n`);

    let updatedCount = 0;

    for (const q of questions) {
        const originalText = JSON.stringify(q.text);
        const originalOptions = JSON.stringify(q.options);
        const originalExplanation = JSON.stringify(q.explanation);

        const newText = processJsonb(q.text);
        const newOptions = processJsonb(q.options);
        const newExplanation = processJsonb(q.explanation);

        const newTextStr = JSON.stringify(newText);
        const newOptionsStr = JSON.stringify(newOptions);
        const newExplanationStr = JSON.stringify(newExplanation);

        // Check if anything changed
        if (originalText !== newTextStr || originalOptions !== newOptionsStr || originalExplanation !== newExplanationStr) {
            await sql`
                UPDATE questions 
                SET 
                    text = ${newTextStr}::jsonb,
                    options = ${newOptions ? newOptionsStr : null}::jsonb,
                    explanation = ${newExplanation ? newExplanationStr : null}::jsonb
                WHERE id = ${q.id}
            `;
            updatedCount++;

            // Show what changed
            if (originalText !== newTextStr) {
                console.log(`Question ${q.id}:`);
                console.log(`  Text: ${q.text?.en?.substring(0, 50)}...`);
            }
        }
    }

    console.log(`\n✓ Updated ${updatedCount} questions`);
}

// Test function - show what would be converted
async function previewChanges() {
    console.log('Preview of changes (no database updates):\n');

    const questions = await sql`
        SELECT id, text, options, explanation 
        FROM questions 
        WHERE text::text LIKE '%^%' 
           OR options::text LIKE '%^%' 
           OR explanation::text LIKE '%^%'
        LIMIT 10
    `;

    console.log(`Found ${questions.length} questions with ^ symbol:\n`);

    for (const q of questions) {
        console.log(`Question ${q.id}:`);
        if (q.text?.en?.includes('^')) {
            console.log(`  Text EN: "${q.text.en}" → "${convertToSuperscript(q.text.en)}"`);
        }
        if (q.explanation?.en?.includes('^')) {
            console.log(`  Explanation: "${q.explanation.en.substring(0, 100)}..." → "${convertToSuperscript(q.explanation.en).substring(0, 100)}..."`);
        }
        console.log();
    }
}

// Run based on argument
const args = process.argv.slice(2);
if (args.includes('--preview')) {
    previewChanges();
} else if (args.includes('--run')) {
    convertSuperscripts();
} else {
    console.log('Usage:');
    console.log('  npx tsx scripts/convert-superscripts.ts --preview  # Preview changes');
    console.log('  npx tsx scripts/convert-superscripts.ts --run      # Apply changes');
}
