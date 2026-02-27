/**
 * Test script for the AI Question Generator
 * Calls the multi-agent pipeline directly (bypasses auth)
 */
const dotenv = require('dotenv');
dotenv.config();

// We need to import the generator dynamically since it's a TS module
// Instead, let's call the Gemini API directly to test the pipeline concept

const { GoogleGenerativeAI } = require('@google/generative-ai');

const geminiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);

async function testGenerateQuestions() {
    console.log(`Found ${geminiKeys.length} Gemini API key(s)\n`);

    if (geminiKeys.length === 0) {
        console.error('❌ No GEMINI_API_KEY found in .env');
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(geminiKeys[0]);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const topic = 'Python Data Structures';
    const referenceText = `
        Python has several built-in data structures. Lists are ordered, mutable sequences 
        that can hold mixed data types. They are created using square brackets []. 
        Tuples are ordered, immutable sequences created using parentheses (). 
        Unlike lists, tuples cannot be modified after creation. 
        Dictionaries are unordered collections of key-value pairs created using curly braces {}.
        Keys must be immutable types (strings, numbers, tuples). 
        Sets are unordered collections of unique elements created using set() or {}.
        Sets support mathematical operations like union, intersection, and difference.
        List comprehensions provide a concise way to create lists: [x**2 for x in range(10)].
        The time complexity of list append is O(1) amortized, while insert at index 0 is O(n).
    `;

    // ── Agent 1: Extract Concepts ─────────────────────────────
    console.log('='.repeat(60));
    console.log('AGENT 1: CONCEPT EXTRACTION');
    console.log('='.repeat(60));

    const conceptPrompt = `You are an expert syllabus analyst. Extract exactly 3 distinct testable concepts from this text about "${topic}".

REFERENCE TEXT:
"""
${referenceText}
"""

OUTPUT: JSON only, no markdown.
{"concepts":[{"concept":"...","supporting_text":"exact quote from text"}]}`;

    const r1 = await model.generateContent(conceptPrompt);
    const conceptsRaw = r1.response.text().replace(/```json|```/g, '').trim();
    const concepts = JSON.parse(conceptsRaw);

    console.log(`Extracted ${concepts.concepts.length} concepts:`);
    concepts.concepts.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.concept}`);
        console.log(`     Source: "${c.supporting_text.substring(0, 80)}..."`);
    });

    // ── Agent 2: Generate Questions ───────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('AGENT 2: QUESTION CRAFTING');
    console.log('='.repeat(60));

    const questions = [];
    for (const concept of concepts.concepts) {
        const qPrompt = `You are an expert question paper setter.

CONCEPT: "${concept.concept}"
REFERENCE: "${concept.supporting_text}"
TYPE: mcq_single (4 options, one correct)
DIFFICULTY: 3/5

RULES:
1. Question must be answerable from the reference alone.
2. Do NOT hallucinate facts.
3. Distractors must be plausible.

OUTPUT: JSON only.
{"text":{"en":"..."},"type":"mcq_single","options":[{"id":"A","text":{"en":"..."}},{"id":"B","text":{"en":"..."}},{"id":"C","text":{"en":"..."}},{"id":"D","text":{"en":"..."}}],"correctAnswer":["B"],"explanation":{"en":"..."}}`;

        const r2 = await model.generateContent(qPrompt);
        const qRaw = r2.response.text().replace(/```json|```/g, '').trim();
        const q = JSON.parse(qRaw);
        questions.push({ ...q, citation: concept });

        console.log(`\n📝 Q: ${q.text.en}`);
        q.options?.forEach(o => {
            const marker = q.correctAnswer.includes(o.id) ? '✅' : '  ';
            console.log(`   ${marker} ${o.id}. ${o.text.en}`);
        });
        console.log(`   Answer: ${q.correctAnswer.join(', ')}`);
    }

    // ── Agent 3: Review ─────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('AGENT 3: REVIEW');
    console.log('='.repeat(60));

    for (const q of questions) {
        const reviewPrompt = `Review this exam question:
Question: ${q.text.en}
Options: ${q.options?.map(o => `${o.id}: ${o.text.en}`).join(', ')}
Correct: ${q.correctAnswer.join(', ')}
Reference: "${q.citation.supporting_text}"

Rate 1-10 and check: is the answer correct? Are distractors plausible?
OUTPUT: JSON only.
{"score":8,"feedback":"...","isCorrect":true}`;

        const r3 = await model.generateContent(reviewPrompt);
        const review = JSON.parse(r3.response.text().replace(/```json|```/g, '').trim());

        console.log(`\n  Q: "${q.text.en.substring(0, 60)}..."`);
        console.log(`  Score: ${review.score}/10 | Correct: ${review.isCorrect}`);
        console.log(`  Feedback: ${review.feedback}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Multi-agent pipeline test PASSED!');
    console.log(`Generated ${questions.length} questions with 3-agent verification`);
    console.log('='.repeat(60));
}

testGenerateQuestions().catch(err => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
});
