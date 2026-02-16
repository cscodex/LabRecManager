import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
// Initialize Keys
const geminiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const openaiKeys = (process.env.OPENAI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const groqKeys = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Rotate Keys
const getNextKey = (keys: string[], currentIndex: number) => {
    return { key: keys[currentIndex % keys.length], nextIndex: (currentIndex + 1) % keys.length };
};

// Provider: Google Gemini
async function generateGemini(modelName: string, prompt: string, imageBase64: string, keyIndex: number): Promise<{ text: string, nextKeyIndex: number }> {
    let attempts = 0;
    let currentKeyIndex = keyIndex;

    while (attempts < (geminiKeys.length * 2)) {
        try {
            attempts++;
            const { key, nextIndex } = getNextKey(geminiKeys, currentKeyIndex);

            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: modelName });

            const imagePart = {
                inlineData: {
                    data: imageBase64.split(',')[1] || imageBase64,
                    mimeType: 'image/jpeg',
                },
            };

            const result = await model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            await delay(2000); // Be nice to limits
            return { text, nextKeyIndex: currentKeyIndex }; // Return SUCCESS (keep same key index for next time unless we rotated inside)

        } catch (err: any) {
            console.error(`Gemini Attempt ${attempts} failed with key index ${currentKeyIndex}:`, err.message);
            if (err.message && (err.message.includes('429') || err.message.includes('503'))) {
                console.log('Rate limit/Service error. Switching keys...');
                currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;
                if (currentKeyIndex === 0) await delay(5000); else await delay(1000);
            } else {
                throw err; // Non-retriable error
            }
        }
    }
    throw new Error('Gemini: All keys exhausted or max retries reached.');
}

// Provider: OpenAI (GPT-4o)
async function generateOpenAI(modelName: string, systemPrompt: string, imageBase64: string, keyIndex: number): Promise<{ text: string, nextKeyIndex: number }> {
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
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "Analyze this image and extract questions according to the system instructions." },
                                { type: "image_url", image_url: { url: imageBase64 } }
                            ]
                        }
                    ],
                    max_tokens: 4000
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI Error ${response.status}: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const text = data.choices[0].message.content;
            await delay(1000);
            return { text, nextKeyIndex: currentKeyIndex };

        } catch (err: any) {
            console.error(`OpenAI Attempt ${attempts} failed:`, err.message);
            if (err.message.includes('429') || err.message.includes('500') || err.message.includes('503')) {
                currentKeyIndex = (currentKeyIndex + 1) % openaiKeys.length;
                if (currentKeyIndex === 0) await delay(2000); else await delay(500);
            } else {
                throw err;
            }
        }
    }
    throw new Error('OpenAI: All retries failed.');
}

// Provider: Groq (Llama 3.2)
async function generateGroq(modelName: string, systemPrompt: string, imageBase64: string, keyIndex: number): Promise<{ text: string, nextKeyIndex: number }> {
    let attempts = 0;
    let currentKeyIndex = keyIndex;

    while (attempts < (groqKeys.length * 2)) {
        try {
            attempts++;
            const { key } = getNextKey(groqKeys, currentKeyIndex);

            // Groq API is OpenAI compatible
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt
                        },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "Analyze this image and extract questions according to the system instructions." },
                                { type: "image_url", image_url: { url: imageBase64 } }
                            ]
                        }
                    ],
                    max_tokens: 4000
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                // Groq specific error handling if needed
                throw new Error(`Groq Error ${response.status}: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const text = data.choices[0].message.content;
            await delay(500); // Groq is fast, but let's be safe
            return { text, nextKeyIndex: currentKeyIndex };

        } catch (err: any) {
            console.error(`Groq Attempt ${attempts} failed:`, err.message);
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


export async function POST(req: NextRequest) {
    try {
        const { images, customPrompt, model: selectedModel } = await req.json();

        // Validate model and select provider
        const geminiModels = ['gemini-1.5-flash', 'gemini-flash-latest', 'gemini-1.5-pro', 'gemini-pro-latest', 'gemini-flash-lite-latest', 'gemini-2.0-flash', 'gemini-2.0-pro-exp-02-05'];

        // Flexible validation: Check prefixes or known lists
        let provider = 'gemini';
        let modelName = 'gemini-flash-latest';

        if (geminiModels.includes(selectedModel)) {
            provider = 'gemini';
            modelName = selectedModel;
        } else if (selectedModel.startsWith('gpt-')) {
            provider = 'openai';
            modelName = selectedModel;
        } else if (selectedModel.startsWith('llama-') || selectedModel.startsWith('mixtral-') || selectedModel.startsWith('meta-llama/')) {
            provider = 'groq';
            modelName = selectedModel;
        } else {
            // Default fallback
            provider = 'gemini';
            modelName = 'gemini-flash-latest';
        }

        // Check keys for selected provider
        if (provider === 'gemini') {
            console.log(`[DEBUG] Loaded ${geminiKeys.length} Gemini API Keys.`);
            if (geminiKeys.length === 0) return NextResponse.json({ success: false, error: 'Gemini API Key missing.' }, { status: 500 });
        }
        if (provider === 'openai' && openaiKeys.length === 0) return NextResponse.json({ success: false, error: 'OpenAI API Key missing.' }, { status: 500 });
        if (provider === 'groq' && groqKeys.length === 0) return NextResponse.json({ success: false, error: 'Groq API Key missing.' }, { status: 500 });

        if (!images || !Array.isArray(images) || images.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No images provided.' },
                { status: 400 }
            );
        }

        const extractedQuestions: any[] = [];
        const extractedInstructions: string[] = [];
        const extractedParagraphs: any[] = [];
        let pageIndex = 1;
        let currentKeyIndex = 0;

        const basePrompt = `
            You are an expert OCR and exam digitization assistant specialized in Physics, Chemistry, and Mathematics.
            Analyze this image of a question paper page and extract all multiple-choice questions.

            STRICT MATHJAX/LATEX FORMATTING RULES:
            1.  Convert ALL math, physics, and chemistry expressions (including subscripts and superscripts) to valid MathJax syntax.
            2.  Inline math: Use \\( ... \\) or raw LaTeX commands (e.g., \\alpha, H_2O, x^2).
            3.  Display math: Use \\[ ... \\] for standalone equations.
            4.  Chemical Formulas: MUST use LaTeX subscripts/superscripts.
                -   Correct: H_2O, CO_2, ^{14}C, SO_4^{2-}
                -   Incorrect: H2O, CO2, 14C, SO42-
            5.  Physics Units/Variables: Use LaTeX where appropriate (e.g., m/s^2, 10^{-6}).
            6.  Ensure all formatting is valid for rendering in a React-KaTeX or MathJax environment.
            
            EXTRACTION RULES:
            -   **Classify Question Type**:
                -   "mcq": Multiple Choice Questions with options (A, B, C, D).
                -   "fill_blank": Single word or short phrase answers (e.g., "The capital of India is ___"). Also use this for "One Word" questions.
                -   "short_answer": Questions requiring 1-2 sentences.
                -   "long_answer": Questions requiring a detailed paragraph or more.
            -   **Handling MCQs ("type": "mcq")**:
                -   REMOVE question numbering.
                -   Extract options list.
                -   correctAnswer: The valid option letter (A, B, C, or D).
            -   **Handling Non-MCQs**:
                -   options: Return an empty array [].
                -   correctAnswer: Provide the **Exact Answer** (for fill_blank) or **Key Points/Model Answer** (for short/long answer).
            -   **General**:
                -   Explanation: Detailed step-by-step logic.
                -   Tags: 2-3 specific topics.
                -   Marks: Extract explicit marks if available (e.g. "[2 marks]", "(4)"), otherwise default to 1. 

            -   **Handling Paragraph/Comprehension Questions**:
                -   If there is a main paragraph/passage followed by questions:
                -   Create a "Paragraph" entry in the \`paragraphs\` array with a unique ID (e.g., "p1").
                -   For each question related to that paragraph, set \`paragraphId\` to the paragraph's ID ("p1").
                -   Do NOT create a separate question of type "paragraph". The paragraph itself is the entity.

            -   **Instructions**:
                -   Extract any exam-level instructions found at the top of the page (e.g., "All questions are compulsory", "Section A carries 1 mark each").
                -   Return them as an array of strings in the \`instructions\` field.

            RETURN JSON ONLY using this schema:
            {
              "instructions": ["Instruction 1", "Instruction 2"],
              "paragraphs": [
                { "id": "p1", "text": "Full text of the passage..." }
              ],
              "questions": [
                {
                  "type": "mcq" | "fill_blank" | "short_answer" | "long_answer",
                  "text": "Question text...",
                  "options": ["Option A", "Option B", "Option C", "Option D"], // Empty for non-mcq
                  "correctAnswer": "A" | "Answer text",
                  "explanation": "...",
                  "marks": 2, 
                  "paragraphId": "p1" // Optional, if linked to a paragraph
                }
              ]
            }
        `;

        const finalPrompt = customPrompt ? `${basePrompt}\n\nADDITIONAL INSTRUCTIONS:\n${customPrompt}` : basePrompt;

        for (const base64Image of images) {
            let text = '';

            try {
                let result;
                if (provider === 'gemini') {
                    result = await generateGemini(modelName, finalPrompt, base64Image, currentKeyIndex);
                } else if (provider === 'openai') {
                    result = await generateOpenAI(modelName, finalPrompt, base64Image, currentKeyIndex);
                } else if (provider === 'groq') {
                    result = await generateGroq(modelName, finalPrompt, base64Image, currentKeyIndex);
                }

                if (result) {
                    text = result.text;
                    currentKeyIndex = result.nextKeyIndex; // Update key index for continuity
                }

                // Advanced cleaning for JSON
                let cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

                // Find JSON object if surrounded by text
                const jsonStart = cleanedText.indexOf('{');
                const jsonEnd = cleanedText.lastIndexOf('}');
                if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON object found in response');
                cleanedText = cleanedText.substring(jsonStart, jsonEnd + 1);

                // Robust JSON Repair for Backslashes
                cleanedText = cleanedText.replace(/(\\["\\/bfnrtu]|\\u[0-9a-fA-F]{4})|(\\.)/g, (match, valid, invalid) => {
                    if (valid) return valid;
                    return '\\\\' + match.slice(1);
                });

                const parsed = JSON.parse(cleanedText);
                const loadedQuestions = parsed.questions || [];
                const loadedInstructions = parsed.instructions || [];
                const loadedParagraphs = parsed.paragraphs || [];

                // Add Meta to questions
                const questionsWithMeta = loadedQuestions.map((q: any, idx: number) => ({
                    ...q,
                    id: `page${pageIndex}_q${idx + 1}_${Date.now()}`,
                    page: pageIndex,
                    correctAnswer: q.correctAnswer?.replace(/Option\s?/i, '').trim().toUpperCase() || ''
                }));

                extractedQuestions.push(...questionsWithMeta);
                extractedInstructions.push(...loadedInstructions);
                extractedParagraphs.push(...loadedParagraphs);

            } catch (err: any) {
                console.error(`Error processing page ${pageIndex} with provider ${provider}:`, err.message);
                // Continue to next page
            }

            pageIndex++;
        }

        return NextResponse.json({
            success: true,
            questions: extractedQuestions,
            instructions: extractedInstructions,
            paragraphs: extractedParagraphs
        });

    } catch (error: any) {
        console.error('AI Extraction Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to process images.' },
            { status: 500 }
        );
    }
}
