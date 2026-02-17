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
            Analyze this image of a question paper page.
            
            **GOAL**: Extract all questions, instructions, and paragraphs from the page.

            **INSTRUCTIONS EXTRACTION**:
            -   If exam-level instructions (e.g., "All questions are compulsory", "Section A is 1 mark each") are found at the top, extract them.
            -   Return them as an array of strings in the \`instructions\` field.
            -   These will be appended to the exam instructions.

            **QUESTION EXTRACTION RULES**:
            1.  **Multiple Choice Questions (MCW)**:
                -   Extract all questions with options.
                -   **True/False Questions**: Treat these as MCQs with two options: "True" and "False".
                -   Remove question numbering (e.g., "1.", "Q1").
                -   Extract all options into the \`options\` array.
                -   Identify the correct answer (Option letter or "True"/"False").

            2.  **Short & Long Answer Questions**:
                -   Extract the full question text.
                -   Set \`options\` to [].
                -   **Model Answer**: Generate a concise "Model Answer" or "Key Points" for grading purposes. Put this in the \`answer\` field.

            **FIELDS TO EXTRACT PER QUESTION**:
            -   **text**: The full question text. Preserve formatting.
            -   **type**: "mcq" (includes True/False), "fill_blank", "short_answer", "long_answer".
            -   **options**: Array of strings (e.g. ["A) ...", "B) ..."] or ["True", "False"]).
            -   **correctAnswer**: The correct option (e.g., "A", "True") or the answer text for fill_blank.
            -   **explanation**: Detailed explanation of the answer.
            -   **marks**: 
                -   Extract explicit marks if available (e.g., "[2]", "(3 marks)").
                -   **DEFAULT MARKS IF NOT FOUND**:
                    -   MCQ / True/False / Fill_Blank / One Word: **1 mark**
                    -   Short Answer: **3 marks**
                    -   Short Answer: **3 marks**
                    -   Long Answer: **6 marks**
            -   **tags**:
                -   Extract relevant **Subjects**, **Topics**, or **Chapters** relative to the content (e.g., ["Physics", "Thermodynamics", "Heat"]).
                -   Infer **Difficulty** if possible (["Easy"], ["Medium"], ["Hard"]).
                -   Return as an array of strings.

            **FORMATTING RULES**:
            -   **Math/Science**: Convert ALL expressions (Math, Physics, Chemistry) to **LaTeX**.
                -   Inline: \\( E = mc^2 \\)
                -   Block: \\[ \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\]
                -   Chemical: \\( H_2SO_4 \\)
            -   **Images**: If a question has a diagram/image, insert placeholder: \`[IMAGE]\` at the end of the text.
            -   **Structural & Code Formatting**:
                -   **Tables**: Detect any tabular data and convert it to valid HTML \`<table>\` structures with \`<thead>\`, \`<tbody>\`, \`<tr>\`, \`<th>\`, and \`<td>\`.
                -   **Code Blocks**: Convert code snippets into \`<pre><code>...</code></pre>\` blocks. Preserve indentation and line breaks within these blocks.
                -   **Line Breaks & Indentation**: 
                    -   Use \`<br>\` for explicit line breaks in questions, options, answers, or explanations.
                    -   Use \`&nbsp;\` or appropriate HTML entities for significant indentation in non-code text.

            **PARAGRAPHS/COMPREHENSION / LINKED QUESTIONS**:
            -   **Definition**: Any content (passage, case study, common data problem) that applies to multiple questions.
            -   **Action**: 
                -   Extract **EVERY** passage found. **DO NOT SKIP ANY PARAGRAPHS.**
                -   Extract the common text/data into the \`paragraphs\` array with a unique \`id\` (e.g., "p1").
                -   **Title Extraction**: Extract the title if present. **If no title is provided, GENERATE a relevant, short title based on the content (e.g., 'Physics Problem', 'Comprehension Passage', 'Case Study').** put this in the \`title\` field.
                -   **Content**: Put the main body text in the \`content\` field. Preserve all formatting.
                -   **Formatting**: Use **HTML** tags for structural elements like tables (\`<table>\`), lists (\`<ul>\`, \`<ol>\`), and line breaks (\`<br>\`). Use LaTeX for Math.
                -   **CRITICAL**: If a single problem statement has multiple follow-up parts (e.g., "(i), (ii), (iii)"), treat the main problem as a **Paragraph** and the parts as separate questions linked to it.
                -   Link each follow-up question to the paragraph using \`paragraphId\`.

            RETURN JSON ONLY using this schema:
            {
              "instructions": ["Instruction 1"],
              "paragraphs": [{ "id": "p1", "title": "Passage Title", "content": "Passage text..." }],
              "questions": [
                {
                  "type": "mcq" | "fill_blank" | "short_answer" | "long_answer",
                  "text": "Question text... [IMAGE] if needed",
                  "options": ["A) ...", "B) ..."], 
                  "correctAnswer": "A"Or "Model/Exact Answer",
                  "explanation": "Explanation...",
                  "marks": 1,
                  "explanation": "Explanation...",
                  "marks": 1,
                  "tags": ["Topic", "Subtopic"],
                  "paragraphId": "p1" 
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
                    correctAnswer: (q.correctAnswer || q.answer || '').replace(/Option\s?/i, '').trim(),
                    marks: q.marks || (q.type === 'long_answer' ? 6 : q.type === 'short_answer' ? 3 : 1),
                    paragraphId: q.paragraphId // Explicitly preserve paragraphId
                }));

                extractedQuestions.push(...questionsWithMeta);
                extractedInstructions.push(...loadedInstructions);

                // Map paragraphs to ensure consistent structure
                const formattedParagraphs = loadedParagraphs.map((p: any) => ({
                    id: p.id,
                    title: p.title || p.text || 'Untitled Passage',
                    content: p.content || p.text || ''
                }));
                extractedParagraphs.push(...formattedParagraphs);

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
