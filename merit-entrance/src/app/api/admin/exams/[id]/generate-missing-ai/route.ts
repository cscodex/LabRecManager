import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const examId = params.id;

        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                sections: true
            }
        });

        if (!exam) {
            return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
        }

        const blueprintId = (exam.description as any)?.blueprint_id;
        if (!blueprintId) {
            return NextResponse.json({ success: false, error: 'Exam was not created with a valid blueprint sequence. Missing blueprint ID.' }, { status: 400 });
        }

        const blueprint = await prisma.examBlueprint.findUnique({
            where: { id: blueprintId },
            include: {
                materials: true,
                sections: {
                    include: {
                        rules: {
                            include: {
                                topicTags: true
                            }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            }
        }) as any;

        if (!blueprint) {
            return NextResponse.json({ success: false, error: 'Associated blueprint no longer exists.' }, { status: 404 });
        }

        let totalGenerated = 0;

        for (const blueprintSection of blueprint.sections) {
            // Find corresponding exam section by order
            const examSection = exam.sections.find((s: any) => s.order === blueprintSection.order);
            if (!examSection) continue;

            for (const rule of blueprintSection.rules) {
                const questionType = rule.questionType;
                const difficulty = rule.difficulty ? Number(rule.difficulty) : null;
                const topicTags = rule.topicTags || [];
                const tagIds = topicTags.map((t: any) => t.id).filter(Boolean);

                const whereClause: any = {
                    sections: { some: { sectionId: examSection.id } },
                    type: questionType
                };
                if (difficulty) whereClause.difficulty = difficulty;
                if (tagIds.length > 0) whereClause.tags = { some: { tagId: { in: tagIds } } };

                const linkedCount = await prisma.question.count({ where: whereClause });
                const numberToGenerate = rule.numberOfQuestions - linkedCount;

                if (numberToGenerate > 0) {
                    const tagNames = topicTags && topicTags.length > 0
                        ? topicTags.map((t: any) => t.name).join(", ")
                        : "General Knowledge";

                    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
                    const aiPromptVector = await embedModel.embedContent(
                        `Generate a ${questionType} question about ${tagNames}. Difficulty level: ${difficulty || "medium"}.`
                    );

                    let contextMap = '';

                    if (blueprint.materials && (blueprint.materials as any[]).length > 0) {
                        const materialIds = (blueprint.materials as any[]).map((m: any) => `'${m.id}'`).join(',');
                        const contextFilter = `WHERE reference_material_id IN (${materialIds})`;

                        // Execute raw vector search
                        const contextChunks = await prisma.$queryRawUnsafe<any[]>(
                            `SELECT chunk_text, 1 - (embedding <=> '[${aiPromptVector.embedding.values.join(",")}]') as similarity 
                                FROM "DocumentChunk" 
                                ${contextFilter}
                                ORDER BY similarity DESC 
                                LIMIT 15`
                        );
                        contextMap = contextChunks.map((c) => c.chunk_text).join("\n\n---\n\n");
                    }

                    const generatorModel = genAI.getGenerativeModel({
                        model: "gemini-2.5-flash",
                        systemInstruction: `You are an expert exam question author. Generate exactly ${numberToGenerate} highly original, novel questions.
                        
                        Topic requirements:
                        ${tagNames}
                        Type: ${questionType}
                        Difficulty: ${difficulty || "medium"}
                        
                        Use the provided reference context if available to fact-check your work, but output novel questions not directly copied.
                        
                        CRITICAL: Return the questions inside a strict valid JSON array matching this interface:
                        [
                        {
                            "text": "The question text, use HTML exclusively for formatting math or sub/superscripts.",
                            "type": "${questionType === "mcq" ? "mcq" : "paragraph"}",
                            "options": ["Option A", "Option B", "Option C", "Option D"], // Only if MCQ, exactly 4.
                            "correctOption": 1, // The 0-indexed correct option (e.g. 1 means Option B). Only if MCQ.
                            "difficulty": ${difficulty || 3},
                            "explanation": "Detailed explanation of why the answer is correct.",
                            "paragraphText": "" // Only if type is paragraph
                        }
                        ]
                        
                        DO NOT return markdown codeblocks. Return pure raw JSON ONLY.`
                    });

                    const promptBody = contextMap
                        ? `Context Book Knowledge:\n${contextMap}`
                        : `Generate from your extensive general web knowledge on the topic. Provide highly accurate, verifiable answers.`;

                    const response = await generatorModel.generateContent(promptBody);
                    let generatedArray = [];
                    try {
                        let rawText = response.response.text().trim();
                        rawText = rawText.replace(/^```json/i, "").replace(/```$/i, "").trim();
                        generatedArray = JSON.parse(rawText);
                    } catch (e) {
                        console.error("Failed to parse AI generated missing questions", response.response.text());
                        throw new Error("AI failed to return valid JSON for generating missing questions");
                    }

                    for (const generatedQ of generatedArray) {
                        let paragraphData = undefined;
                        if (generatedQ.type === 'paragraph' && generatedQ.paragraphText) {
                            paragraphData = {
                                create: { text: { en: generatedQ.paragraphText } }
                            };
                        }

                        const dbQuestion = await prisma.question.create({
                            data: {
                                text: generatedQ.text,
                                type: generatedQ.type,
                                difficulty: generatedQ.difficulty || difficulty || 3,
                                explanation: generatedQ.explanation || "",
                                options: generatedQ.options || [],
                                correctAnswer: generatedQ.correctOption,
                                paragraph: paragraphData,
                                isAiGenerated: true,
                                citation: contextMap ? 'AI Synthesized RAG' : 'AI Internal Knowledge Base',
                                order: 999,
                                tags: {
                                    create: tagIds.map((tId: any) => ({
                                        tag: { connect: { id: tId } }
                                    }))
                                }
                            }
                        });

                        // Link to exam section natively
                        await prisma.sectionQuestion.create({
                            data: {
                                sectionId: examSection.id,
                                questionId: dbQuestion.id,
                                marks: rule.marksPerQuestion ? Number(rule.marksPerQuestion) : 1,
                                negativeMarks: rule.negativeMarks ? Number(rule.negativeMarks) : 0,
                                order: 999 // Put at end
                            }
                        });

                        totalGenerated++;
                    }
                }
            }
        }

        return NextResponse.json({ success: true, generatedCount: totalGenerated });

    } catch (error: any) {
        console.error('Error generating missing AI questions:', error);
        return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
    }
}
