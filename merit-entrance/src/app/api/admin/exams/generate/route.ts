import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const QuestionSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        text: {
            type: SchemaType.STRING,
            description: "The question text. Use LaTeX \\( \\) for math.",
        },
        options: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
                "Array of 4 distractors/options. Do NOT include prefixes like A) or 1)",
        },
        correctAnswer: {
            type: SchemaType.STRING,
            description:
                "The EXACT pure text of the correct option from the options array",
        },
        explanation: {
            type: SchemaType.STRING,
            description: "Detailed step-by-step solution. Use LaTeX.",
        },
    },
    required: ["text", "options", "correctAnswer", "explanation"],
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { blueprintId, title, description, duration, createdById } = body;

        if (!blueprintId || !title || !duration || !createdById) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Missing required exam details (blueprintId, title, duration, createdById).",
                },
                { status: 400 },
            );
        }

        // 1. Fetch the blueprint and rules
        // @ts-ignore - Prisma type cache issue
        // Extract generation flags from request body
        const { allowAiGenerationForMissing, allowMissingQuestions } = body;

        const blueprint: any = await (prisma.examBlueprint.findUnique as any)({
            where: { id: blueprintId },
            include: {
                sections: {
                    include: {
                        rules: {
                            include: { topicTags: true },
                        },
                    },
                    orderBy: { order: "asc" },
                },
                materials: {
                    select: { id: true }
                }
            },
        });

        if (!blueprint) {
            return NextResponse.json(
                { success: false, error: "Blueprint not found" },
                { status: 404 },
            );
        }

        let totalMissingQuestionsFound = 0;
        const missingDetails: any[] = [];

        // --- PHASE 1: Validate Available Questions ---
        for (const blueprintSection of blueprint.sections) {
            for (const rule of blueprintSection.rules) {
                const { topicTags, questionType, numberOfQuestions, difficulty } = rule;
                const tagIds = topicTags ? topicTags.map((t: any) => t.id) : [];

                if (blueprint.generationMethod !== "generate_novel") {
                    const whereClause: any = { type: questionType };
                    if (topicTags && topicTags.length > 0) {
                        whereClause.tags = { some: { tagId: { in: tagIds } } };
                    }
                    if (difficulty) {
                        whereClause.difficulty = difficulty;
                    }

                    const matchingIds = await prisma.question.findMany({
                        where: whereClause,
                        select: { id: true },
                    });

                    if (matchingIds.length < numberOfQuestions) {
                        const shortage = numberOfQuestions - matchingIds.length;
                        totalMissingQuestionsFound += shortage;
                        const tagNames =
                            topicTags && topicTags.length > 0
                                ? topicTags.map((t: any) => t.name).join(", ")
                                : "Any";
                        missingDetails.push({
                            sectionName: blueprintSection.name,
                            ruleDescription: `Type: ${questionType}, Tags: ${tagNames}, Difficulty: ${difficulty}`,
                            shortage: shortage,
                        });
                    }
                }
            }
        }

        // --- PHASE 2: Shortage Validation Prompt ---
        // If there are missing questions and neither explicit flag was provided, return validation prompt
        if (
            totalMissingQuestionsFound > 0 &&
            !allowAiGenerationForMissing &&
            !allowMissingQuestions
        ) {
            return NextResponse.json(
                {
                    success: false,
                    requiresAiConfirmation: true,
                    missingCount: totalMissingQuestionsFound,
                    shortageDetails: missingDetails,
                    message: `Not enough questions in the bank. You are missing ${totalMissingQuestionsFound} questions across your blueprint rules.\n\nDo you want to use AI to generate the missing questions based on the rule parameters and available RAG context?`,
                },
                { status: 200 },
            );
        }

        // --- PHASE 3: Build the actual exam content ---
        let totalMarks = 0;
        const examSectionsToCreate: any[] = [];
        let expectedQuestionCount = 0;

        for (const blueprintSection of blueprint.sections) {
            let sectionMarks = 0;
            const collectedQuestions: any[] = [];

            for (const rule of blueprintSection.rules) {
                const {
                    topicTags,
                    questionType,
                    numberOfQuestions,
                    difficulty,
                    marksPerQuestion,
                    negativeMarks,
                } = rule;

                expectedQuestionCount += Number(numberOfQuestions);

                const selectedIds: string[] = [];
                const tagIds = topicTags ? topicTags.map((t: any) => t.id) : [];

                if (
                    blueprint.generationMethod === "generate_novel" ||
                    (totalMissingQuestionsFound > 0 && allowAiGenerationForMissing)
                ) {
                    // --- DYNAMIC AI RAG GENERATION --- //
                    const tagNames = topicTags
                        ? topicTags.map((t: any) => t.name).join(", ")
                        : "General Knowledge";

                    // Determine how many strictly need generating.
                    let numberToGenerate = numberOfQuestions;
                    const existingQuestionsFound = await prisma.question.findMany({
                        where: {
                            type: questionType,
                            difficulty: difficulty || undefined,
                            ...(topicTags && topicTags.length > 0
                                ? { tags: { some: { tagId: { in: tagIds } } } }
                                : {}),
                        },
                        take: numberOfQuestions,
                        select: { id: true },
                    });

                    // If we're filling gaps, only generate the missing amount
                    if (
                        blueprint.generationMethod !== "generate_novel" &&
                        totalMissingQuestionsFound > 0 &&
                        allowAiGenerationForMissing
                    ) {
                        numberToGenerate =
                            numberOfQuestions - existingQuestionsFound.length;

                        // Add the existing ones we DO have first
                        for (const q of existingQuestionsFound) {
                            selectedIds.push(q.id);
                        }
                    }

                    if (numberToGenerate > 0) {
                        const embedModel = genAI.getGenerativeModel({
                            model: "gemini-embedding-001",
                        });
                        const aiPromptVector = await embedModel.embedContent(
                            `Generate a ${questionType} question about ${tagNames}. Difficulty level: ${difficulty || "medium"}.`,
                        );

                        let contextMap = '';

                        if (blueprint.materials && blueprint.materials.length > 0) {
                            const materialIds = blueprint.materials.map((m: any) => `'${m.id}'`).join(',');
                            const contextFilter = `WHERE reference_material_id IN (${materialIds})`;

                            // Execute raw vector search with material filter
                            const contextChunks = await prisma.$queryRawUnsafe<any[]>(
                                `SELECT chunk_text, 1 - (embedding <=> '[${aiPromptVector.embedding.values.join(",")}]') as similarity 
                                FROM "DocumentChunk" 
                                ${contextFilter}
                                ORDER BY similarity DESC 
                                LIMIT 15`,
                            );

                            contextMap = contextChunks
                                .map((c) => c.chunk_text)
                                .join("\n\n---\n\n");
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
                            
                            DO NOT return markdown codeblocks. Return pure raw JSON ONLY.
                            `,
                        });

                        try {
                            const promptBody = contextMap
                                ? `Context Book Knowledge:\n${contextMap}`
                                : `Generate from your extensive general web knowledge on the topic. Provide highly accurate, verifiable answers.`;

                            const response = await generatorModel.generateContent(promptBody);

                            let generatedArray = [];
                            try {
                                const rawText = response.response.text().trim();
                                // strip possible markdown formatting
                                const cleanText = rawText
                                    .replace(/^```json/i, "")
                                    .replace(/```$/i, "")
                                    .trim();
                                generatedArray = JSON.parse(cleanText);
                            } catch (e) {
                                console.error(
                                    "Failed to parse AI question generation",
                                    response.response.text(),
                                );
                                throw new Error(
                                    "AI failed to return valid JSON for generated questions.",
                                );
                            }

                            // Save the generated questions to DB
                            for (const generatedQ of generatedArray) {
                                let paragraphData = undefined;
                                if (generatedQ.type === 'paragraph' && generatedQ.paragraphText) {
                                    paragraphData = {
                                        create: {
                                            text: { en: generatedQ.paragraphText }
                                        }
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
                                        citation: {
                                            source: contextMap ? "Gemini 2.5 Dynamic Generation Engine" : "Gemini 2.5 General Knowledge",
                                            text_excerpt: contextMap ? contextMap.substring(0, 50) + "..." : "Sourced from general internal model knowledge.",
                                        },
                                        order: 0,
                                    },
                                });

                                // Link Tags
                                if (tagIds.length > 0) {
                                    for (const tId of tagIds) {
                                        await prisma.$executeRawUnsafe(
                                            `INSERT INTO "_QuestionToTag" ("A", "B") VALUES ('${dbQuestion.id}', '${tId}') ON CONFLICT DO NOTHING;`,
                                        );
                                    }
                                }
                                selectedIds.push(dbQuestion.id);

                                // Fetch full question so it matches the expected array format downstream
                                const fullQuestion = await prisma.question.findUnique({
                                    where: { id: dbQuestion.id },
                                    include: { tags: true },
                                });

                                sectionMarks += Number(marksPerQuestion);
                                collectedQuestions.push({
                                    original: fullQuestion,
                                    marks: Number(marksPerQuestion),
                                    negativeMarks: negativeMarks ? Number(negativeMarks) : null,
                                });
                            }
                        } catch (err: any) {
                            console.error(
                                `RAG Generation failed for 1 question in rule ${tagNames}:`,
                                err.message,
                            );
                            return NextResponse.json(
                                {
                                    success: false,
                                    error: `Failed to synthesize AI question for topic '${tagNames}'. Error: ${err.message}`,
                                },
                                { status: 500 },
                            );
                        }
                    }
                } else {
                    // --- STATIC EXISTING QUESTION FETCH --- //
                    const whereClause: any = {
                        type: questionType,
                    };

                    if (topicTags && topicTags.length > 0) {
                        whereClause.tags = { some: { tagId: { in: tagIds } } };
                    }
                    if (difficulty) {
                        whereClause.difficulty = difficulty;
                    }

                    const matchingIds = await prisma.question.findMany({
                        where: whereClause,
                        select: { id: true },
                    });

                    if (!allowMissingQuestions && matchingIds.length < numberOfQuestions) {
                        const tagNames =
                            topicTags && topicTags.length > 0
                                ? topicTags.map((t: any) => t.name).join(", ")
                                : "Any";
                        return NextResponse.json(
                            {
                                success: false,
                                error: `Not enough unique questions available for Rule (Type: ${questionType}, Tags: ${tagNames}). Needed ${numberOfQuestions}, Found ${matchingIds.length}.`,
                            },
                            { status: 400 },
                        );
                    }

                    // Shuffle in JS
                    const shuffled = matchingIds.sort(() => 0.5 - Math.random());
                    // If allowMissingQuestions is true, we just cap the length at what we found
                    const sliceEnd = Math.min(numberOfQuestions, matchingIds.length);
                    selectedIds.push(
                        ...shuffled.slice(0, sliceEnd).map((q) => q.id),
                    );

                    // Fetch full questions to copy
                    const questions = await prisma.question.findMany({
                        where: { id: { in: selectedIds } },
                        include: { tags: true },
                    });

                    for (let i = 0; i < questions.length; i++) {
                        const q = questions[i];
                        sectionMarks += Number(marksPerQuestion);
                        collectedQuestions.push({
                            original: q,
                            marks: Number(marksPerQuestion),
                            negativeMarks: negativeMarks ? Number(negativeMarks) : null,
                        });
                    }
                }
            }

            totalMarks += sectionMarks;
            examSectionsToCreate.push({
                name: blueprintSection.name,
                order: blueprintSection.order,
                questions: collectedQuestions,
            });
        }

        // Store expected question count in description JSON for publish lock validation
        const examDescription = typeof description === 'object' && description !== null
            ? { ...description, expected_questions: expectedQuestionCount }
            : { en: description || '', pa: description || '', expected_questions: expectedQuestionCount };

        // 3. Create the Exam (no nested create to avoid Neon HTTP transaction error)
        const exam = await prisma.exam.create({
            data: {
                title,
                description: examDescription,
                duration: parseInt(duration),
                totalMarks,
                createdById,
                status: "draft",
            },
        });

        // 4. Create sections one by one (no transaction needed)
        const createdSections: any[] = [];
        for (const sec of examSectionsToCreate) {
            const section = await prisma.section.create({
                data: {
                    examId: exam.id,
                    name: sec.name,
                    order: sec.order,
                },
            });
            createdSections.push({ ...section, questions: sec.questions });
        }

        // 5. Link questions to exam sections via section_questions
        for (const secData of createdSections) {
            let orderCounter = 1;
            for (const cq of secData.questions) {
                const og = cq.original;
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "section_questions" ("section_id", "question_id", "marks", "negative_marks", "order") VALUES ($1, $2, $3, $4, $5)`,
                    secData.id,
                    og.id,
                    cq.marks,
                    cq.negativeMarks,
                    orderCounter++,
                );
            }
        }

        return NextResponse.json({
            success: true,
            examId: exam.id,
            message: "Exam generated successfully.",
        });
    } catch (error: any) {
        console.error("Failed to generate exam:", error);
        return NextResponse.json(
            { success: false, error: "Failed to generate exam: " + error.message },
            { status: 500 },
        );
    }
}
