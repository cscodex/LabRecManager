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

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [imagePart, { text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 8192,
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });
            const response = await result.response;
            const text = response.text();

            await delay(2000); // Be nice to limits
            return { text, nextKeyIndex: currentKeyIndex }; // Return SUCCESS (keep same key index for next time unless we rotated inside)

        } catch (err: any) {
            console.error(`Gemini Attempt ${attempts} failed with key index ${currentKeyIndex}:`, err.message);
            if (err.message && (err.message.includes('429') || err.message.includes('503'))) {
                console.log('Rate limit/Service error. Switching keys and backing off...');
                currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;
                // Free tier is strictly 15 RPM. We must backoff aggressively.
                if (currentKeyIndex === 0) {
                    console.log('All keys exhausted, waiting 20s for bucket refill...');
                    await delay(20000);
                } else {
                    await delay(3000);
                }
            } else if (err.message && err.message.includes('RECITATION')) {
                console.error(`[Gemini] Candidate blocked due to RECITATION. This means the image contains copyrighted text (like past exams) that Google refuses to reproduce exactly.`);
                throw new Error('Gemini Security Block: Candidate was blocked due to RECITATION (Copyright). Please use OpenAI or Groq for this specific paper.');
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
                    response_format: { type: "json_object" },
                    max_tokens: 8192
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
                    response_format: { type: "json_object" },
                    max_tokens: 8192
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
        const extractedSections: any[] = [];
        const extractedInstructions: string[] = [];
        const extractedParagraphs: any[] = [];
        const pageErrors: string[] = [];
        let pageIndex = 1;
        let currentKeyIndex = 0;

        const basePrompt = `
            You are an expert OCR and exam digitization assistant specialized in Physics, Chemistry, and Mathematics.
            Analyze this image of a question paper page.
            
            **GOAL**: Extract all questions, instructions, and paragraphs from the page.

            **INSTRUCTIONS EXTRACTION**:
            -   If exam-level instructions (e.g., "All questions are compulsory", "Section A is 1 mark each") are found at the top, extract them.
            -   Return them as an array of strings in the \`instructions\` field.
            -   **IMPORTANT**: Also analyze instructions for sectional breakdown info (e.g., "Part A contains 20 MCQs", "Section B: Mathematics").

            **SECTION/PART DETECTION (CRITICAL)**:
            -   **Detect sections/parts** from:
                1. **Page headings**: "Part A", "Section 1", "Part II - Mathematics", "Section B: English" etc.
                2. **Exam instructions**: If instructions mention sections (e.g., "Part A contains 20 MCQs of 1 mark each"), use this to name sections.
                3. **Subject Topics**: If no explicit Part/Section headers exist, **GROUP QUESTIONS BY THEIR PRIMARY SUBJECT TAG**. 
                   - For example, if questions 1-10 are about Physics, put them in a section named "Physics". 
                   - If questions 11-20 are Chemistry, put them in a section named "Chemistry".
                   - The section name MUST match the primary subject tag (e.g., "Physics", "Mathematics", "English", "Logic").
            -   **Group all questions under their detected section** in the \`sections\` array.
            -   Each section should have a \`name\` and its own \`questions\` and \`paragraphs\` arrays.
            -   ❌ DO NOT lump everything into a single "General" section unless the entire page is completely mixed subjects.
            -   If a section has specific instructions (e.g., "Attempt any 5"), include them in the section's \`instructions\` array.

            **EXAM TYPE EXTRACTION**:
            -   Analyze the header or title of the page to identify the Exam Type.
            -   Look for keywords like "JEE Main", "JEE Advanced", "NEET", "UPSC", "GATE", "CAT", "School of Eminence", "Board Exam".
            -   Map this to one of the following codes: 'JEE_MAIN', 'JEE_ADV', 'NEET', 'UPSC_CSE', 'GATE', 'CAT', 'SOE', 'OTHER'.
            -   Return this single string value in the \`examType\` field.

            **ANSWERING METHODOLOGY (CRITICAL — READ CAREFULLY)**:
            -   For EVERY MCQ question, you MUST follow this EXACT 3-step process:
            
            **STEP 1 — SOLVE**: Work through the problem step-by-step. Derive the numerical answer, concept, or conclusion FIRST. Write this in the \`explanation\` field.
            
            **STEP 2 — MATCH**: After solving, RE-READ EVERY option (A, B, C, D) carefully. Find which option matches your derived answer. This is CRITICAL — do NOT skip this step.
            
            **STEP 3 — VERIFY**: Double-check that the option you selected actually matches your solution. If your answer is "24" and option C says "24", then correctAnswer = "C" (NOT "24").
            
            **COMMON MISTAKES TO AVOID**:
            -   ❌ DO NOT put the answer value in correctAnswer (e.g., "24", "True", "Newton's law")
            -   ❌ DO NOT put the full option text in correctAnswer (e.g., "A) 24 units")
            -   ❌ DO NOT guess the answer from option patterns — SOLVE FIRST
            -   ✅ DO put ONLY the option LETTER in correctAnswer (e.g., "A", "B", "C", "D")
            -   ✅ DO put the step-by-step solution in the \`explanation\` field
            -   ✅ DO verify your selected option matches your derived answer
            
            For Fill in the Blanks: Solve/recall the answer, THEN put the exact answer text in \`correctAnswer\`.
            For Short/Long Answer: Generate a complete model answer. Put this in the \`answer\` field (NOT correctAnswer).

            **QUESTION EXTRACTION RULES**:
            1.  **Multiple Choice Questions (MCQ)**:
                -   Extract all questions with options.
                -   **True/False Questions**: Treat these as MCQs with two options: "True" and "False".
                -   Remove question numbering (e.g., "1.", "Q1").
                -   Extract all options into the \`options\` array.
                -   **Solve the question first**, then identify the correct option letter (e.g., "A", "B").

            2.  **Fill in the Blank Questions**:
                -   Extract the question text.
                -   **Solve first**, then put the exact answer in \`correctAnswer\`.

            3.  **Short & Long Answer Questions**:
                -   Extract the full question text.
                -   Set \`options\` to [].
                -   **Solve the question first**, then generate a concise "Model Answer" or "Key Points" for grading purposes. Put this in the \`answer\` field.

            **FIELDS TO EXTRACT PER QUESTION**:
            -   **text**: The full question text. Preserve formatting.
            -   **type**: "mcq" (includes True/False), "fill_blank", "short_answer", "long_answer".
            -   **options**: Array of strings. Each option MUST start with its letter prefix: ["A) ...", "B) ...", "C) ...", "D) ..."].
            -   **correctAnswer**: 
                -   For MCQ: MUST be ONLY the option LETTER ("A", "B", "C", or "D"). NOT the option text, NOT the answer value.
                -   For fill_blank: The exact answer text.
                -   For short/long answer: Leave null.
            -   **answer**: ONLY for short_answer and long_answer types. A concise model answer for grading. Leave null for MCQ and fill_blank.
            -   **explanation**: Detailed step-by-step explanation of how to arrive at the answer.
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
            -   **Images**: If a question has a diagram/image/figure/graph/chart specifically tied to that question, insert placeholder: \`[IMAGE]\` at the end of the text.
            -   **Image Bounding Box (CRITICAL)**: ONLY return \`imageBounds\` for actual **diagrams, graphs, charts, figures, or illustrations** that are part of a specific question. 
                - ❌ DO NOT return imageBounds for page headers, footers, or exam title areas.
                - ❌ DO NOT return imageBounds for general exam instructions or logos.
                - ❌ DO NOT return imageBounds for Watermarks or decorative elements.
                - ❌ DO NOT return imageBounds for Text-only content (like the text of another question), even if formatted differently.
                Return the approximate position as percentages (0-1):
                \`"imageBounds": { "x": 0.1, "y": 0.3, "w": 0.8, "h": 0.25 }\`
                - If there is NO diagram/graph/figure for a question, do NOT include imageBounds at all.

            **MULTI-PAGE HANDLING (CRITICAL)**:
            - You are analyzing 2 pages at a time. 
            - If a question starts at the bottom of the first page and continues (options, image, or text) onto the top of the second page, you MUST **MERGE them into a single question object**.
            - DO NOT split it into two broken questions. 
            - Ensure NO questions from either page are skipped. Extract 100% of the questions.

            **PARAGRAPHS/COMPREHENSION / LINKED QUESTIONS**:
            -   **Definition**: Any content (passage, case study, common data problem) that applies to multiple questions.
            -   **CRITICAL EXCEPTION**: DO NOT treat section instructions (e.g., "Attempt any 5 questions from this section") as paragraphs! Paragraphs must be actual testing content/data/context that the questions rely on to be solved.
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
              "examType": "JEE_MAIN", 
              "instructions": ["General exam instruction 1"],
              "sections": [
                {
                  "name": "Part A - English",
                  "instructions": ["Attempt all questions"],
                  "paragraphs": [{ "id": "p1", "title": "Passage Title", "content": "Passage text..." }],
                  "questions": [
                    {
                      "type": "mcq" | "fill_blank" | "short_answer" | "long_answer",
                      "text": "Question text...",
                      "options": ["A) First option", "B) Second option", "C) Third option", "D) Fourth option"], 
                      "correctAnswer": "B",
                      "answer": null,
                      "explanation": "Step 1: ... Step 2: ... Therefore the answer is 42, which matches option B.",
                      "marks": 1,
                      "tags": ["Topic", "Subtopic"],
                      "paragraphId": "p1",
                      "imageBounds": { "x": 0.1, "y": 0.3, "w": 0.8, "h": 0.25 }
                    }
                  ]
                }
              ]
            }
            **IMPORTANT**: If no explicit section headers exist, sort the questions into sections named exactly after their first tag (e.g., "Physics", "Chemistry", "Mathematics").
            **CRITICAL**: Extract ALL questions from the page. Do NOT truncate or skip any questions, even if the page has many. Every single question must be included.
            **STRICT COMPLIANCE**: DO NOT output any "Chain of Thought", reasoning, or markdown text outside the JSON. Your VERY FIRST character must be \`{\` and your VERY LAST character must be \`}\`.
            **COPYRIGHT/RECITATION PREVENTION ZONE**: To bypass strict AI recitation filters, slightly rephrase NON-mathematical plain-text instructions or passages if they are from a highly known source, BUT keep ALL equations, values, options, and scientific terminology EXACTLY as written. NEVER refuse to answer. Do what you can to return valid JSON.
        `;

        const finalPrompt = customPrompt ? `${basePrompt}\n\nADDITIONAL INSTRUCTIONS:\n${customPrompt}` : basePrompt;

        let extractedExamType: string | null = null;
        let hasQuotaError = false;

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

                let parsed: any = { sections: [] };

                try {
                    parsed = JSON.parse(cleanedText);
                } catch (parseError: any) {
                    console.error(`[AI Parser] Initial JSON parse failed on page ${pageIndex}:`, parseError.message);
                    console.log(`[AI Parser] Attempting to auto-recover truncated JSON...`);

                    try {
                        // RECOVERY STRATEGY FOR TRUNCATED JSON
                        // 1. Remove trailing comma or broken string
                        let recoveredText = cleanedText.replace(/,\s*$/, '').replace(/"[^"]*$/, '');

                        // 2. Count open vs closed brackets/braces to append the missing ones
                        const openBraces = (recoveredText.match(/\{/g) || []).length;
                        const closeBraces = (recoveredText.match(/\}/g) || []).length;
                        const openBrackets = (recoveredText.match(/\[/g) || []).length;
                        const closeBrackets = (recoveredText.match(/\]/g) || []).length;

                        const missingBraces = openBraces - closeBraces;
                        const missingBrackets = openBrackets - closeBrackets;

                        // Usually it cuts off inside a question object inside an array.
                        // We will try an aggressive closure string.
                        let closure = '';
                        if (recoveredText.endsWith('"')) recoveredText += 'null'; // close broken key with null val

                        for (let i = 0; i < missingBrackets; i++) closure += ']';
                        for (let i = 0; i < missingBraces; i++) closure += '}';

                        // Try parsing permutations of brackets and braces just in case order matters
                        let fixed = false;
                        const closureAttempts = [
                            '}]}]}', '"]}]}', 'null}]}]}', '"]}', '}]}', '}', ']'
                        ];

                        for (const attempt of closureAttempts) {
                            try {
                                parsed = JSON.parse(recoveredText + attempt);
                                console.log('[AI Parser] Successfully recovered truncated JSON!');
                                fixed = true;
                                break;
                            } catch (e) { }
                        }

                        if (!fixed) {
                            // Ultimate fallback: Just extract objects using regex if structure is completely broken
                            console.log('[AI Parser] Brace matching failed. Attempting regex object extraction.');
                            const questionMatches = cleanedText.match(/\{[^{}]*"type"[^{}]*"text"[^{}]*\}/g);
                            if (questionMatches && questionMatches.length > 0) {
                                const recoveredQuestions = questionMatches.map(m => {
                                    try { return JSON.parse(m); } catch (e) { return null; }
                                }).filter(Boolean);
                                parsed = { sections: [{ name: 'General Recovered', questions: recoveredQuestions }] };
                                console.log(`[AI Parser] Recovered ${recoveredQuestions.length} questions via regex.`);
                            } else {
                                throw new Error('Regex recovery failed.');
                            }
                        }

                    } catch (recoveryError) {
                        console.error(`[AI Parser] All recovery attempts failed:`, recoveryError);
                        throw new Error(`Failed to parse AI response. Truncation too severe.`);
                    }
                }

                if (parsed.examType && !extractedExamType) {
                    extractedExamType = parsed.examType;
                }
                const loadedInstructions = parsed.instructions || [];
                extractedInstructions.push(...loadedInstructions);

                // Handle both new sections[] format and legacy flat questions[] format
                let sectionsFromPage: any[] = [];

                if (parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
                    // New format: sections[] containing questions
                    sectionsFromPage = parsed.sections;
                } else if (parsed.questions && Array.isArray(parsed.questions)) {
                    // Legacy format: flat questions array. Group them by their first tag dynamically!
                    const groupedMap = new Map<string, any>();

                    parsed.questions.forEach((q: any) => {
                        let dynamicSectionName = 'General';
                        if (q.tags && Array.isArray(q.tags) && q.tags.length > 0) {
                            dynamicSectionName = q.tags[0]; // e.g. "Physics"
                        }

                        if (!groupedMap.has(dynamicSectionName)) {
                            groupedMap.set(dynamicSectionName, {
                                name: dynamicSectionName,
                                questions: [],
                                paragraphs: [],
                                instructions: []
                            });
                        }
                        groupedMap.get(dynamicSectionName).questions.push(q);
                    });

                    // Assign any global paragraphs/instructions to the first section found, or a general bucket
                    if (groupedMap.size > 0) {
                        const firstSection = groupedMap.values().next().value;
                        if (parsed.paragraphs) firstSection.paragraphs.push(...parsed.paragraphs);
                        if (parsed.instructions) firstSection.instructions.push(...parsed.instructions);
                    } else {
                        // Failsafe if questions array was completely empty
                        groupedMap.set('General', {
                            name: 'General',
                            questions: [],
                            paragraphs: parsed.paragraphs || [],
                            instructions: []
                        });
                    }

                    sectionsFromPage = Array.from(groupedMap.values());
                }

                // Process each section and merge with existing by name
                for (const section of sectionsFromPage) {
                    // If the AI completely ignored our instructions and STILL named the section 'General', 
                    // we'll try to rename it based on the first question's tag inside that section
                    let sectionName = section.name || 'General';
                    if (sectionName.toLowerCase() === 'general' && section.questions && section.questions.length > 0) {
                        const firstQ = section.questions[0];
                        if (firstQ.tags && Array.isArray(firstQ.tags) && firstQ.tags.length > 0) {
                            sectionName = firstQ.tags[0];
                        }
                    }

                    const sectionQuestions = section.questions || [];
                    const sectionParagraphs = section.paragraphs || [];
                    const sectionInstructions = section.instructions || [];

                    // Add meta to questions
                    const questionsWithMeta = sectionQuestions.map((q: any, idx: number) => ({
                        ...q,
                        id: `page${pageIndex}_q${idx + 1}_${Date.now()}`,
                        page: pageIndex,
                        section: sectionName,
                        correctAnswer: (q.correctAnswer || q.answer || '').replace(/Option\s?/i, '').trim(),
                        marks: q.marks || (q.type === 'long_answer' ? 6 : q.type === 'short_answer' ? 3 : 1),
                        paragraphId: q.paragraphId,
                        imageBounds: q.imageBounds || null
                    }));

                    // Format paragraphs
                    const formattedParagraphs = sectionParagraphs.map((p: any) => ({
                        id: p.id,
                        title: p.title || p.text || 'Untitled Passage',
                        content: p.content || p.text || '',
                        section: sectionName
                    }));

                    // Merge into extractedSections by name
                    const existingSection = extractedSections.find((s: any) => s.name === sectionName);
                    if (existingSection) {
                        existingSection.questions.push(...questionsWithMeta);
                        existingSection.paragraphs.push(...formattedParagraphs);
                        if (sectionInstructions.length > 0) {
                            existingSection.instructions = [...(existingSection.instructions || []), ...sectionInstructions];
                        }
                    } else {
                        extractedSections.push({
                            name: sectionName,
                            questions: questionsWithMeta,
                            paragraphs: formattedParagraphs,
                            instructions: sectionInstructions
                        });
                    }

                    // Also add to flat arrays for backward compat
                    extractedQuestions.push(...questionsWithMeta);
                    extractedParagraphs.push(...formattedParagraphs);
                }

            } catch (err: any) {
                console.error(`Error processing page ${pageIndex} with provider ${provider}:`, err.message);
                console.error('Raw Text that failed parsing:', text.substring(0, 1000) + '...');
                // Forward rate limit errors to client
                if (err.message?.includes('429') || err.message?.includes('rate limit') || err.message?.includes('quota') || err.message?.includes('Resource has been exhausted')) {
                    pageErrors.push(`Page ${pageIndex}: API rate limit reached — try again in a few minutes or switch to a different AI model.`);
                    hasQuotaError = true;
                } else {
                    pageErrors.push(`Page ${pageIndex}: ${err.message}`);
                }
            }

            pageIndex++;
        }

        if (extractedQuestions.length === 0) {
            console.warn('No questions extracted from any page.');
        }

        return NextResponse.json({
            success: true,
            questions: extractedQuestions,
            sections: extractedSections,
            instructions: extractedInstructions,
            paragraphs: extractedParagraphs,
            examType: extractedExamType,
            errors: pageErrors.length > 0 ? pageErrors : undefined,
            quotaExceeded: hasQuotaError
        });

    } catch (error: any) {
        console.error('AI Extraction Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to process images.' },
            { status: 500 }
        );
    }
}
