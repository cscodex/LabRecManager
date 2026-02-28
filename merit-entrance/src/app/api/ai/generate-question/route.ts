import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const QuestionSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        text: { type: SchemaType.STRING, description: 'The question text. Use LaTeX \\( \\) for math.' },
        options: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: 'Array of 4 distractors/options. Do NOT include prefixes like A) or 1)'
        },
        correctAnswer: { type: SchemaType.STRING, description: 'The EXACT pure text of the correct option from the options array' },
        explanation: { type: SchemaType.STRING, description: 'Detailed step-by-step solution. Use LaTeX.' },
        difficulty: { type: SchemaType.INTEGER, description: '1 (Easy) to 5 (Hard)' },
        tags: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: 'Subject and Topic tags, e.g. ["Physics", "Thermodynamics"]'
        }
    },
    required: ["text", "options", "correctAnswer", "explanation", "difficulty", "tags"]
};

export async function POST(request: Request) {
    try {
        const { topic, difficulty, referenceText, styleProfile = 'jee_main' } = await request.json();

        if (!topic || !referenceText) {
            return NextResponse.json({ success: false, error: "Topic and Reference Text are required for RAG Generation." }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: QuestionSchema,
                temperature: 0.7, // Add a bit of creativity for question crafting
            }
        });

        const prompt = `
            You are an expert ${styleProfile} Exam Paper Setter. 
            Your goal is to draft a NOVEL, ORIGINAL Multiple Choice Question.

            **STRICT KNOWLEDGE BOUNDARY**:
            You MUST base the question and its underlying concept STRICTLY on the text provided below. 
            Do NOT hallucinate outside knowledge. If the text does not contain enough info to make a question, synthesize what you can.

            **REFERENCE TEXT**:
            """
            ${referenceText}
            """

            **QUESTION REQUIREMENTS**:
            - Topic: ${topic}
            - Target Difficulty (1-5): ${difficulty || 3}
            - Format: Multiple Choice Question (1 correct, 3 plausible distractors)
            - Style: ${styleProfile === 'jee_advanced' ? 'Highly conceptual, multi-step calculation' : 'Standard competitive testing'}

            **GENERATION RULES**:
            1. **The Question**: Make it rigorous and clear. Do not say "Based on the text...". Write it as a standalone exam question.
            2. **The Distractors (CRITICAL)**: The 3 wrong options must be "Plausible Misconceptions". E.g. what answer would a student get if they forgot to convert units? Or if they used the wrong formula? 
            3. **Formatting**: Use LaTeX for all math/science equations using \\( \\) for inline and \\[ \\] for blocks.
            4. **Clean Options**: Return exactly 4 options. Do NOT prepend letters or numbers (e.g. return "42 Joules", NOT "A) 42 Joules").
            5. **Correct Answer**: Return the exact string of the correct option.
            
            Return the output in the strict JSON schema provided.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const questionData = JSON.parse(responseText);

        return NextResponse.json({
            success: true,
            question: questionData
        });

    } catch (error: any) {
        console.error("AI Generation Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
