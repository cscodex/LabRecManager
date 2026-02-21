import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const geminiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);

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
            return { text, nextKeyIndex: currentKeyIndex }; // Return SUCCESS

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

const INSTRUCTIONS_PROMPT_TEMPLATE = `
You are an expert exam digitizer. Your task is to extract ONLY the General Instructions or Exam Rules from the provided image.
Do NOT extract any test questions. Ignore multiple-choice questions, passages, or subjective questions entirely.
If there are no instructions on this page, return an empty string.

Translate/transcribe the instructions into {LANGUAGE}.

**FORMATTING RULES**:
1. Output valid HTML.
2. Maintain headings using <h2> or <h3> tags.
3. Keep bulleted or numbered lists exactly as they appear using <ul>, <ol>, and <li> tags.
4. Preserve bold text using <strong> tags and italics using <em> tags.
5. Use <br> for line breaks where appropriate.
6. Do NOT wrap the entire output in HTML/BODY/HEAD/DIV/HTML markdown blocks. Just return the raw inner HTML content.
7. Exclude anything not resembling a rule, instruction, guideline, or exam metadata (like "Do not turn the page", "Time: 3 hours", "Marking Scheme").

RETURN ONLY HTML TEXT.
`;

export async function POST(req: NextRequest) {
    try {
        const { images, targetLanguage } = await req.json();

        if (!images || !Array.isArray(images) || images.length === 0) {
            return NextResponse.json({ error: 'No images provided' }, { status: 400 });
        }

        const language = targetLanguage === 'Punjabi' ? 'Punjabi' : 'English';
        const prompt = INSTRUCTIONS_PROMPT_TEMPLATE.replace('{LANGUAGE}', language);

        console.log(`Extracting instructions for ${images.length} pages into ${language}`);

        let allHtml = '';
        let currentKeyIndex = 0;

        for (let i = 0; i < images.length; i++) {
            console.log(`Processing instruction page image ${i + 1}/${images.length}...`);
            let rawText = '';

            try {
                const result = await generateGemini('gemini-2.5-flash', prompt, images[i], currentKeyIndex);
                rawText = result.text;
                currentKeyIndex = result.nextKeyIndex;
            } catch (error: any) {
                console.error(`AI extraction failed for page ${i + 1}:`, error.message);
                throw new Error(`AI Extraction failed on page ${i + 1}: ${error.message}`);
            }

            // Cleanup potential markdown fences
            let cleanHtml = rawText;
            if (cleanHtml.includes('\`\`\`html')) {
                cleanHtml = cleanHtml.replace(/\`\`\`html/g, '').replace(/\`\`\`/g, '');
            } else if (cleanHtml.includes('\`\`\`')) {
                cleanHtml = cleanHtml.replace(/\`\`\`/g, '');
            }

            allHtml += cleanHtml + '<br><br>';
        }

        return NextResponse.json({
            success: true,
            html: allHtml.trim()
        });

    } catch (error: any) {
        console.error('Error in /api/ai/extract-instructions:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
