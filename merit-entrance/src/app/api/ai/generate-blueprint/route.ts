import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import "dotenv/config";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
    try {
        const { prompt, images, materialIds } = await req.json();

        if (!prompt && (!images || images.length === 0)) {
            return NextResponse.json({ success: false, error: 'Prompt or image is required' }, { status: 400 });
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
The user has provided a natural language request to design a test, OR they have attached images (like a Syllabus Table showing Chapters, and Mark Distribution showing Rules for sections). Your job is to strictly output the JSON structure representing this blueprint.

Here are all the valid Topic Tags currently in the database, with their IDs and Names:
${tagListString}

# INSTRUCTIONS FOR TAG MATCHING & CREATION
Based on the user's prompt OR OCR extraction from provided images, deduce which topic tags apply to which sections.
If you find exact or very close matches in the known Tags list provided above, USE THEIR EXACT IDs in the \`topicTags\` array.
If an extracted Chapter or Topic DOES NOT EXIST in the known list, you MUST STILL INCLUDE IT, but INSTEAD of an ID, output the raw string Name (e.g. "Thermodynamics"). The system will intercept this, dynamically create the tag, and inject the new UUID later.
So, the \`topicTags\` array can contain a mix of verified UUIDs and raw string names for missing topics.

# INSTRUCTIONS FOR STRUCTURE
Break down the test into logical sections if warranted by the prompt or image (e.g. if the distribution table shows 'Section A' and 'Section B', create two sections).
Parse the mark distribution rules precisely. If an image states "Section A has 20 1-mark questions", generate a rule with numberOfQuestions: 20, marksPerQuestion: 1.
Apply reasonable defaults ONLY if the user doesn't specify explicit counts in the text or images:
- Default questionType: "mcq_single"
- Default marksPerQuestion: 4
- Default negativeMarks: 1
- Default difficulty: 3

Warning: Do not return conversational text, ONLY the raw JSON satisfying the required schema.

User Request: "${prompt || 'Extract blueprint structure from the provided image(s).'}"
`;

        const requestPayload: any[] = [systemPrompt];

        if (images && images.length > 0) {
            for (const imgBase64 of images) {
                // Determine mime type from the data URI (e.g., "data:image/png;base64,...")
                let mimeType = "image/jpeg";
                const match = imgBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
                if (match) mimeType = match[1];

                const base64Data = imgBase64.replace(/^data:image\/\w+;base64,/, "");
                requestPayload.push({
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                });
            }
        }

        const result = await model.generateContent(requestPayload);
        const responseText = result.response.text();
        const parsedData = JSON.parse(responseText);

        // --- TAG RESOLUTION PIPELINE (Phase 11) ---
        // Iterate through all parsed sections and rules to swap raw names with valid UUIDs.
        for (const section of parsedData.sections) {
            for (const rule of section.rules) {
                const resolvedTagIds = [];
                for (const rawTag of rule.topicTags) {
                    // Check if it's already a valid UUID format (means the AI matched an existing tag)
                    const isUuid = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi.test(rawTag);

                    if (isUuid) {
                        resolvedTagIds.push(rawTag);
                    } else {
                        // It's a raw string Name representing a MISSING tag. Create it automatically.
                        try {
                            const newTag = await prisma.tag.create({
                                data: { name: rawTag }
                            });
                            resolvedTagIds.push(newTag.id);
                        } catch (e: any) {
                            // If creation fails (e.g., rare race condition with unique name constraint), try to fetch it
                            const existingTag = await prisma.tag.findUnique({ where: { name: rawTag } });
                            if (existingTag) {
                                resolvedTagIds.push(existingTag.id);
                            } else {
                                console.error("Failed to dynamically create missing tag:", rawTag, e);
                            }
                        }
                    }
                }
                rule.topicTags = resolvedTagIds;
            }
        }

        return NextResponse.json({
            success: true,
            data: parsedData
        });

    } catch (error: any) {
        console.error('Error generating blueprint:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to generate blueprint'
        }, { status: 500 });
    }
}
