import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import "dotenv/config";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
    try {
        const { prompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
        }

        // Fetch all available tags to give the AI context of what topics it can choose from
        const tags = await prisma.tag.findMany({
            select: { id: true, name: true }
        });

        const tagListString = tags.map(t => `ID: ${t.id} | Name: ${t.name}`).join('\n');

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        name: { type: SchemaType.STRING, description: "A highly descriptive, professional name for the generated Blueprint (e.g. 'NEET Physics Grand Mock', 'Midterm Thermodynamics Evaluation')" },
                        description: { type: SchemaType.STRING, description: "A brief professional description of the Blueprint's intended use." },
                        sections: {
                            type: SchemaType.ARRAY,
                            description: "The list of sections in the exam blueprint.",
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    name: {
                                        type: SchemaType.OBJECT,
                                        properties: {
                                            en: { type: SchemaType.STRING },
                                            pa: { type: SchemaType.STRING }
                                        },
                                        required: ["en"]
                                    },
                                    rules: {
                                        type: SchemaType.ARRAY,
                                        description: "The list of rules within this section. Each rule defines a specific topic, difficulty, and question count.",
                                        items: {
                                            type: SchemaType.OBJECT,
                                            properties: {
                                                topicTags: {
                                                    type: SchemaType.ARRAY,
                                                    description: "An array of strict string Tag IDs mapping EXACTLY to the provided list of known tags.",
                                                    items: { type: SchemaType.STRING }
                                                },
                                                questionType: {
                                                    type: SchemaType.STRING,
                                                    description: "Must be ONE of: mcq_single, mcq_multiple, fill_blank, numerical, true_false, short_answer, long_answer"
                                                },
                                                numberOfQuestions: { type: SchemaType.NUMBER },
                                                marksPerQuestion: { type: SchemaType.NUMBER },
                                                negativeMarks: { type: SchemaType.NUMBER },
                                                difficulty: {
                                                    type: SchemaType.NUMBER,
                                                    description: "Integer from 1 (Easy) to 5 (Hard)"
                                                }
                                            },
                                            required: ["topicTags", "questionType", "numberOfQuestions", "marksPerQuestion", "negativeMarks", "difficulty"]
                                        }
                                    }
                                },
                                required: ["name", "rules"]
                            }
                        }
                    },
                    required: ["name", "description", "sections"]
                }
            }
        });

        // The exact prompt sent to Gemini
        const systemPrompt = `
You are an expert strict AI Exam Blueprint Architect.
The user has provided a natural language request to design a test. Your job is to strictly output the JSON structure representing this blueprint.

Here are all the valid Topic Tags currently in the database, with their IDs and Names:
${tagListString}

Based on the user's prompt, intelligently deduce which topic tags apply to which sections.
If the prompt asks for a "Physics and Chemistry" test, generate two sections, each with rules targeting those specific tag IDs.
If you cannot find exact tag matches, pick the closest conceptual tag IDs. DO NOT invent tag IDs. The 'topicTags' array MUST ONLY contain the exact ID strings listed above.

Break down the test into logical sections if warranted by the prompt, or just a single "Main Section" if it's a simple test.
Apply reasonable defaults if the user doesn't specify explicit counts:
- Default questionType: "mcq_single"
- Default marksPerQuestion: 4
- Default negativeMarks: 1
- Default difficulty: 3

Warning: Do not return conversational text, ONLY the raw JSON satisfying the required schema.

User Request: "${prompt}"
`;

        const result = await model.generateContent(systemPrompt);
        const responseText = result.response.text();

        return NextResponse.json({
            success: true,
            data: JSON.parse(responseText)
        });

    } catch (error: any) {
        console.error('Error generating blueprint:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to generate blueprint'
        }, { status: 500 });
    }
}
