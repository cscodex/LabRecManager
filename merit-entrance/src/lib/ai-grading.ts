
import { GoogleGenerativeAI } from '@google/generative-ai';

// Helper for delay (to avoid rate limits)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Load keys from ENV
const geminiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const openaiKeys = (process.env.OPENAI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const groqKeys = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);

// Key rotation helpers
const getNextKey = (keys: string[], currentIndex: number) => {
    if (keys.length === 0) throw new Error("No API keys found.");
    const nextIndex = (currentIndex) % keys.length;
    return { key: keys[nextIndex], nextIndex };
};

// --- Providers ---

async function gradeGemini(modelName: string, prompt: string, keyIndex: number): Promise<{ text: string, nextKeyIndex: number }> {
    let attempts = 0;
    let currentKeyIndex = keyIndex;

    while (attempts < (geminiKeys.length * 2)) {
        try {
            attempts++;
            const { key } = getNextKey(geminiKeys, currentKeyIndex);

            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: modelName });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return { text, nextKeyIndex: currentKeyIndex };

        } catch (err: any) {
            console.error(`Gemini Grading Attempt ${attempts} failed:`, err.message);
            if (err.message && (err.message.includes('429') || err.message.includes('503'))) {
                currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;
                await delay(1000);
            } else {
                throw err;
            }
        }
    }
    throw new Error('Gemini: All keys exhausted.');
}

async function gradeOpenAI(modelName: string, prompt: string, keyIndex: number): Promise<{ text: string, nextKeyIndex: number }> {
    let attempts = 0;
    let currentKeyIndex = keyIndex;

    while (attempts < (openaiKeys.length * 2)) {
        try {
            attempts++;
            const { key } = getNextKey(openaiKeys, currentKeyIndex);

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: "system", content: "You are an expert examiner." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI Error ${response.status}: ${errorData.error?.message}`);
            }

            const data = await response.json();
            const text = data.choices[0].message.content;
            return { text, nextKeyIndex: currentKeyIndex };

        } catch (err: any) {
            console.error(`OpenAI Grading Attempt ${attempts} failed:`, err.message);
            if (err.message.includes('429') || err.message.includes('500') || err.message.includes('503')) {
                currentKeyIndex = (currentKeyIndex + 1) % openaiKeys.length;
                await delay(1000);
            } else {
                throw err;
            }
        }
    }
    throw new Error('OpenAI: All retries failed.');
}

async function gradeGroq(modelName: string, prompt: string, keyIndex: number): Promise<{ text: string, nextKeyIndex: number }> {
    let attempts = 0;
    let currentKeyIndex = keyIndex;

    while (attempts < (groqKeys.length * 2)) {
        try {
            attempts++;
            const { key } = getNextKey(groqKeys, currentKeyIndex);

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: "system", content: "You are an expert examiner." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Groq Error ${response.status}: ${errorData.error?.message}`);
            }

            const data = await response.json();
            const text = data.choices[0].message.content;
            return { text, nextKeyIndex: currentKeyIndex };

        } catch (err: any) {
            console.error(`Groq Grading Attempt ${attempts} failed:`, err.message);
            if (err.message.includes('429') || err.message.includes('503')) {
                currentKeyIndex = (currentKeyIndex + 1) % groqKeys.length;
                await delay(1000);
            } else {
                throw err;
            }
        }
    }
    throw new Error('Groq: All retries failed.');
}

export interface AIGradingResult {
    score: number;
    feedback: string;
    improvements?: string;
}

export async function gradeSubjectiveAnswer(
    questionText: string,
    studentAnswer: string,
    modelAnswer: string,
    maxMarks: number,
    model = 'gemini-flash-latest',
    customPrompt?: string
): Promise<AIGradingResult> {

    // Base Prompt
    const basePrompt = `
        Act as a strict academic examiner. Evaluate the student's answer based on the provided Model Answer/Key Points.

        QUESTION: ${questionText}
        MAX MARKS: ${maxMarks}

        MODEL ANSWER / KEY POINTS:
        ${modelAnswer}

        STUDENT ANSWER:
        ${studentAnswer}

        INSTRUCTIONS:
        1. Assign a score out of ${maxMarks}. Partial marking is allowed (e.g., 2.5).
        2. Be strict but fair. If the core concept is missing, give 0.
        3. Provide specific feedback on what was correct and what was missing.
        4. Suggest improvements.

        OUTPUT FORMAT:
        Respond ONLY with a valid JSON object. Do not wrap in markdown code blocks.
        {
            "score": 4.5,
            "feedback": "Good explanation of...",
            "improvements": "You missed the point about..."
        }
    `;

    // Append Custom Prompt if provided
    const prompt = customPrompt
        ? `${basePrompt}\n\nADDITIONAL INSTRUCTIONS:\n${customPrompt}`
        : basePrompt;

    // Select Provider
    let result;
    let provider = 'gemini';
    let modelName = 'gemini-flash-latest';

    if (model.startsWith('gpt')) {
        provider = 'openai';
        modelName = model;
    } else if (model.startsWith('llama') || model.startsWith('mixtral')) {
        provider = 'groq';
        modelName = model;
    } else {
        provider = 'gemini';
        modelName = model;
    }

    // Call AI
    if (provider === 'gemini') {
        result = await gradeGemini(modelName, prompt, 0);
    } else if (provider === 'openai') {
        result = await gradeOpenAI(modelName, prompt, 0);
    } else if (provider === 'groq') {
        result = await gradeGroq(modelName, prompt, 0);
    }

    if (!result || !result.text) {
        throw new Error('AI returned empty response.');
    }

    // Parse JSON
    try {
        let jsonString = result.text.trim();
        // Remove markdown code blocks if present
        if (jsonString.startsWith('```json')) jsonString = jsonString.slice(7);
        if (jsonString.startsWith('```')) jsonString = jsonString.slice(3);
        if (jsonString.endsWith('```')) jsonString = jsonString.slice(0, -3);

        return JSON.parse(jsonString.trim());
    } catch (e) {
        console.error("JSON Parse Error:", result.text);
        throw new Error('Failed to parse AI response');
    }
}
