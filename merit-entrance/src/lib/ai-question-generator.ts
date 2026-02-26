/**
 * AI Question Generator — Multi-Agent Pipeline
 * 
 * Agent 1 (Concept Extractor): Extracts distinct testable concepts from reference text
 * Agent 2 (Question Crafter):  Generates a question from each concept
 * Agent 3 (Reviewer):          Validates quality, correctness, and difficulty
 * 
 * Uses existing Gemini/OpenAI/Groq key rotation infrastructure.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Key Management (same pattern as ai-grading.ts) ──────────────────────
const geminiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getNextKey(keys: string[], idx: number) {
    if (keys.length === 0) throw new Error('No Gemini API keys configured');
    return { key: keys[idx % keys.length], nextIndex: (idx + 1) % keys.length };
}

async function callGemini(prompt: string, keyIndex: number, model = 'gemini-2.5-flash'): Promise<{ text: string; nextKeyIndex: number }> {
    let attempts = 0;
    let currentIdx = keyIndex;

    while (attempts < geminiKeys.length * 2) {
        try {
            attempts++;
            const { key } = getNextKey(geminiKeys, currentIdx);
            const genAI = new GoogleGenerativeAI(key);
            const m = genAI.getGenerativeModel({ model });
            const result = await m.generateContent(prompt);
            const text = result.response.text();
            return { text, nextKeyIndex: currentIdx };
        } catch (err: any) {
            console.error(`[AI-Gen] Attempt ${attempts} failed:`, err.message);
            if (err.message?.includes('429') || err.message?.includes('503')) {
                currentIdx = (currentIdx + 1) % geminiKeys.length;
                await delay(1500);
            } else {
                throw err;
            }
        }
    }
    throw new Error('Gemini: All keys exhausted for question generation');
}

// ── JSON Parsing Helper ─────────────────────────────────────────────────
function parseJSON(raw: string): any {
    let s = raw.trim();
    // Strip markdown fences
    if (s.startsWith('```json')) s = s.slice(7);
    else if (s.startsWith('```')) s = s.slice(3);
    if (s.endsWith('```')) s = s.slice(0, -3);
    return JSON.parse(s.trim());
}

// ── Types ───────────────────────────────────────────────────────────────
export interface GeneratedQuestion {
    text: { en: string; pa?: string };
    type: string;
    options?: { id: string; text: { en: string; pa?: string } }[];
    correctAnswer: string[];
    explanation: { en: string };
    marks: number;
    difficulty: number;
    negativeMarks: number;
    citation: {
        excerpt: string;
        concept: string;
    };
    reviewScore?: number;
    reviewFeedback?: string;
}

export interface GenerateQuestionsRequest {
    topic: string;
    referenceText: string;
    count: number;
    type?: 'mcq_single' | 'mcq_multiple' | 'true_false' | 'short_answer' | 'fill_blank';
    difficulty?: number; // 1-5
    style?: 'jee_advanced' | 'upsc_prelims' | 'standard_board' | 'gate' | 'general';
    language?: 'en' | 'both';
    marksPerQuestion?: number;
    negativeMarks?: number;
}

// ── Style Profiles ──────────────────────────────────────────────────────
const STYLE_INSTRUCTIONS: Record<string, string> = {
    jee_advanced: `
        - Use JEE Advanced style: numerical traps, multi-step reasoning
        - Distractors should be results of common calculation errors
        - Questions should require deep conceptual understanding, not just memorization
        - Use assertion-reasoning format where appropriate`,
    upsc_prelims: `
        - Use UPSC Prelims style: multi-statement truth questions
        - Format: "Which of the following statements is/are correct?"
        - Provide options like "1 and 2 only", "2 and 3 only", "1, 2 and 3", "None"
        - Test analytical thinking over rote learning`,
    standard_board: `
        - Use standard textbook exam style: clear, direct questions
        - Test understanding of core concepts
        - Options should be distinct but related to the topic
        - Suitable for class 10-12 level board exams`,
    gate: `
        - Use GATE exam style: technical depth, numerical answers
        - Questions should test engineering concepts rigorously
        - Include data interpretation and application-based questions
        - Distractors should be technically plausible`,
    general: `
        - Use a general examination style
        - Clear, unambiguous question text
        - Distinct options covering different aspects of the topic
        - Moderate difficulty suitable for entrance exams`
};

// ══════════════════════════════════════════════════════════════════════════
// AGENT 1: CONCEPT EXTRACTOR
// ══════════════════════════════════════════════════════════════════════════
async function extractConcepts(
    topic: string,
    referenceText: string,
    count: number,
    keyIndex: number
): Promise<{ concepts: { concept: string; supporting_text: string }[]; nextKeyIndex: number }> {

    const prompt = `You are an expert syllabus analyst for competitive exams.

TASK: Extract exactly ${count} distinct, testable concepts from the following reference text about "${topic}".

REFERENCE TEXT:
"""
${referenceText}
"""

RULES:
1. Each concept must be a specific, testable fact or principle—NOT a broad topic name.
2. Extract concepts that would make good exam questions.
3. Ensure concepts are distinct (no overlapping ideas).
4. Quote the exact sentence or phrase from the text that supports each concept.

OUTPUT: Respond ONLY with a valid JSON object. No markdown code blocks.
{
    "concepts": [
        {
            "concept": "The specific testable concept",
            "supporting_text": "Exact quote from the reference text"
        }
    ]
}`;

    const result = await callGemini(prompt, keyIndex);
    const parsed = parseJSON(result.text);

    return {
        concepts: parsed.concepts.slice(0, count),
        nextKeyIndex: result.nextKeyIndex
    };
}

// ══════════════════════════════════════════════════════════════════════════
// AGENT 2: QUESTION CRAFTER
// ══════════════════════════════════════════════════════════════════════════
async function craftQuestion(
    concept: { concept: string; supporting_text: string },
    type: string,
    difficulty: number,
    style: string,
    marks: number,
    negativeMarks: number,
    language: string,
    keyIndex: number
): Promise<{ question: GeneratedQuestion; nextKeyIndex: number }> {

    const styleInstructions = STYLE_INSTRUCTIONS[style] || STYLE_INSTRUCTIONS.general;

    const typeInstructions: Record<string, string> = {
        mcq_single: `Generate a multiple-choice question with exactly 4 options (A, B, C, D). Exactly ONE option is correct.`,
        mcq_multiple: `Generate a multiple-choice question with exactly 4 options (A, B, C, D). TWO or more options may be correct.`,
        true_false: `Generate a True/False statement. Options should be [{"id":"A","text":{"en":"True"}},{"id":"B","text":{"en":"False"}}].`,
        short_answer: `Generate a short-answer question. No options needed. The correctAnswer should be a single word or short phrase.`,
        fill_blank: `Generate a fill-in-the-blank question. Replace the key term with "______". The correctAnswer is the missing word/phrase.`
    };

    const languageInstructions = language === 'both'
        ? 'Provide text in both English ("en") and Punjabi ("pa"). For Punjabi, use Gurmukhi script.'
        : 'Provide text only in English ("en").';

    const prompt = `You are an expert question paper setter for competitive exams.

CONCEPT TO TEST:
"${concept.concept}"

SUPPORTING REFERENCE:
"${concept.supporting_text}"

QUESTION TYPE: ${type}
${typeInstructions[type] || typeInstructions.mcq_single}

DIFFICULTY: ${difficulty}/5 (1=very easy, 5=extremely hard)

STYLE GUIDELINES:
${styleInstructions}

LANGUAGE: ${languageInstructions}

CRITICAL RULES:
1. The question MUST be answerable from the supporting reference text alone.
2. DO NOT hallucinate facts. Every claim must come from the reference.
3. Distractors (wrong options) must be plausible but clearly wrong per the reference.
4. The correct answer must be unambiguous.
5. Do NOT mention "according to the passage" — the question should stand alone.

OUTPUT: Respond ONLY with a valid JSON object. No markdown.
{
    "text": { "en": "Question text here"${language === 'both' ? ', "pa": "ਪ੍ਰਸ਼ਨ ਪਾਠ"' : ''} },
    "type": "${type}",
    "options": [
        { "id": "A", "text": { "en": "Option A"${language === 'both' ? ', "pa": "ਵਿਕਲਪ"' : ''} } },
        { "id": "B", "text": { "en": "Option B"${language === 'both' ? ', "pa": "ਵਿਕਲਪ"' : ''} } },
        { "id": "C", "text": { "en": "Option C"${language === 'both' ? ', "pa": "ਵਿਕਲਪ"' : ''} } },
        { "id": "D", "text": { "en": "Option D"${language === 'both' ? ', "pa": "ਵਿਕਲਪ"' : ''} } }
    ],
    "correctAnswer": ["B"],
    "explanation": { "en": "Why B is correct based on the reference text" },
    "difficulty": ${difficulty}
}`;

    const result = await callGemini(prompt, keyIndex);
    const parsed = parseJSON(result.text);

    // Assemble the GeneratedQuestion
    const question: GeneratedQuestion = {
        text: parsed.text,
        type: parsed.type || type,
        options: parsed.options || null,
        correctAnswer: Array.isArray(parsed.correctAnswer) ? parsed.correctAnswer : [parsed.correctAnswer],
        explanation: parsed.explanation,
        marks,
        difficulty: parsed.difficulty || difficulty,
        negativeMarks,
        citation: {
            excerpt: concept.supporting_text,
            concept: concept.concept
        }
    };

    return { question, nextKeyIndex: result.nextKeyIndex };
}

// ══════════════════════════════════════════════════════════════════════════
// AGENT 3: REVIEWER
// ══════════════════════════════════════════════════════════════════════════
async function reviewQuestion(
    question: GeneratedQuestion,
    referenceText: string,
    keyIndex: number
): Promise<{ reviewed: GeneratedQuestion; nextKeyIndex: number }> {

    const prompt = `You are a senior question paper reviewer with 20+ years of experience.

TASK: Review this AI-generated exam question for quality, correctness, and difficulty.

QUESTION:
${JSON.stringify(question.text)}

TYPE: ${question.type}
OPTIONS: ${JSON.stringify(question.options)}
CORRECT ANSWER: ${JSON.stringify(question.correctAnswer)}
EXPLANATION: ${JSON.stringify(question.explanation)}
CLAIMED DIFFICULTY: ${question.difficulty}/5

CITATION:
Concept: "${question.citation.concept}"
Reference: "${question.citation.excerpt}"

ORIGINAL REFERENCE TEXT:
"""
${referenceText.substring(0, 2000)}
"""

REVIEW CRITERIA:
1. Is the correct answer actually correct per the reference text?
2. Are the distractors (wrong options) plausible but clearly wrong?
3. Is the question unambiguous?
4. Does the difficulty rating match the actual difficulty?
5. Is the question free from factual errors or hallucinations?

OUTPUT: Respond ONLY with JSON. No markdown.
{
    "score": 8,
    "feedback": "Brief review feedback",
    "isCorrect": true,
    "suggestedDifficulty": 3,
    "issues": []
}`;

    const result = await callGemini(prompt, keyIndex);

    try {
        const review = parseJSON(result.text);
        question.reviewScore = review.score;
        question.reviewFeedback = review.feedback;

        // Adjust difficulty if reviewer disagrees
        if (review.suggestedDifficulty && review.suggestedDifficulty !== question.difficulty) {
            question.difficulty = review.suggestedDifficulty;
        }

        return { reviewed: question, nextKeyIndex: result.nextKeyIndex };
    } catch {
        // If review fails to parse, return question as-is with a default score
        question.reviewScore = 5;
        question.reviewFeedback = 'Review parsing failed';
        return { reviewed: question, nextKeyIndex: result.nextKeyIndex };
    }
}

// ══════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR: Run all 3 agents
// ══════════════════════════════════════════════════════════════════════════
export async function generateQuestions(req: GenerateQuestionsRequest): Promise<{
    questions: GeneratedQuestion[];
    stats: {
        conceptsExtracted: number;
        questionsGenerated: number;
        averageReviewScore: number;
        totalTimeMs: number;
    };
}> {
    const startTime = Date.now();
    let keyIndex = 0;

    const {
        topic,
        referenceText,
        count,
        type = 'mcq_single',
        difficulty = 3,
        style = 'general',
        language = 'en',
        marksPerQuestion = 1,
        negativeMarks = 0
    } = req;

    console.log(`[AI-Gen] Starting generation: ${count} ${type} questions on "${topic}" (difficulty: ${difficulty})`);

    // ── Agent 1: Extract Concepts ───────────────────────────────────────
    console.log('[AI-Gen] Agent 1: Extracting concepts...');
    const { concepts, nextKeyIndex: ki1 } = await extractConcepts(topic, referenceText, count, keyIndex);
    keyIndex = ki1;
    console.log(`[AI-Gen] Agent 1: Extracted ${concepts.length} concepts`);

    // ── Agent 2: Generate Questions (parallel, max 3 at a time) ─────────
    console.log('[AI-Gen] Agent 2: Crafting questions...');
    const questions: GeneratedQuestion[] = [];
    const batchSize = 3; // Avoid rate limits

    for (let i = 0; i < concepts.length; i += batchSize) {
        const batch = concepts.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(async (concept) => {
                const { question, nextKeyIndex } = await craftQuestion(
                    concept, type, difficulty, style, marksPerQuestion, negativeMarks, language, keyIndex
                );
                keyIndex = nextKeyIndex;
                return question;
            })
        );
        questions.push(...results);

        // Small delay between batches to avoid rate limits
        if (i + batchSize < concepts.length) {
            await delay(500);
        }
    }
    console.log(`[AI-Gen] Agent 2: Generated ${questions.length} questions`);

    // ── Agent 3: Review Questions (parallel, max 3 at a time) ───────────
    console.log('[AI-Gen] Agent 3: Reviewing questions...');
    const reviewed: GeneratedQuestion[] = [];

    for (let i = 0; i < questions.length; i += batchSize) {
        const batch = questions.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(async (q) => {
                const { reviewed: r, nextKeyIndex } = await reviewQuestion(q, referenceText, keyIndex);
                keyIndex = nextKeyIndex;
                return r;
            })
        );
        reviewed.push(...results);

        if (i + batchSize < questions.length) {
            await delay(500);
        }
    }

    const avgScore = reviewed.reduce((sum, q) => sum + (q.reviewScore || 0), 0) / reviewed.length;
    console.log(`[AI-Gen] Agent 3: Review complete. Avg score: ${avgScore.toFixed(1)}/10`);

    const totalTimeMs = Date.now() - startTime;
    console.log(`[AI-Gen] Pipeline complete in ${(totalTimeMs / 1000).toFixed(1)}s`);

    return {
        questions: reviewed,
        stats: {
            conceptsExtracted: concepts.length,
            questionsGenerated: reviewed.length,
            averageReviewScore: Math.round(avgScore * 10) / 10,
            totalTimeMs
        }
    };
}
