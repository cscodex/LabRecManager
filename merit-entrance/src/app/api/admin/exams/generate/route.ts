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

// Shared helper: generate AI questions (used by both RAG and Gemini paths)
interface CitationMeta {
    pages: number[];
    chunks: { pageNumber: number; chunkIndex: number; startText: string; endText: string }[];
}

async function generateAiQuestions(
    count: number,
    questionType: string,
    tagNames: string,
    difficulty: number | null,
    contextMap: string, // empty string = Gemini general knowledge, non-empty = RAG
    tagIds: string[],
    citationMeta?: CitationMeta
): Promise<string[]> {
    const generatorModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: `You are an expert exam question author. Generate exactly ${count} highly original, novel questions.
            
            Topic requirements:
            ${tagNames}
            Type: ${questionType}
            Difficulty: ${difficulty || "medium"}
            
            ${contextMap ? "Use the provided reference context to fact-check your work, but output novel questions not directly copied." : "Generate from your own extensive knowledge on the topic. Provide highly accurate, verifiable answers."}
            
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

    const promptBody = contextMap
        ? `Context Book Knowledge:\n${contextMap}`
        : `Generate from your extensive general web knowledge on the topic. Provide highly accurate, verifiable answers.`;

    const response = await generatorModel.generateContent(promptBody);

    let generatedArray = [];
    try {
        const rawText = response.response.text().trim();
        const cleanText = rawText
            .replace(/^```json/i, "")
            .replace(/```$/i, "")
            .trim();
        generatedArray = JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse AI question generation", response.response.text());
        throw new Error("AI failed to return valid JSON for generated questions.");
    }

    const questionIds: string[] = [];

    for (const generatedQ of generatedArray) {
        let paragraphId = null;
        if (generatedQ.type === 'paragraph' && generatedQ.paragraphText) {
            const p = await prisma.paragraph.create({
                data: { text: { en: generatedQ.paragraphText } }
            });
            paragraphId = p.id;
        }

        const dbQuestion = await prisma.question.create({
            data: {
                text: { en: generatedQ.text },
                type: generatedQ.type,
                difficulty: generatedQ.difficulty || difficulty || 3,
                explanation: { en: generatedQ.explanation || "" },
                options: (generatedQ.options || []).map((opt: string) => ({ en: opt })),
                correctAnswer: generatedQ.correctOption !== undefined && generatedQ.correctOption !== null
                    ? [generatedQ.correctOption.toString()]
                    : [],
                paragraphId: paragraphId,
                isAiGenerated: true,
                citation: contextMap && citationMeta ? {
                    source: "RAG Knowledge Base Generation",
                    pages: citationMeta.pages,
                    chunks: citationMeta.chunks,
                    text_excerpt: citationMeta.chunks.length > 0
                        ? `Page ${citationMeta.chunks[0].pageNumber}: "${citationMeta.chunks[0].startText}" ... "${citationMeta.chunks[0].endText}"`
                        : contextMap.substring(0, 50) + "...",
                } : {
                    source: "Gemini General Knowledge",
                    text_excerpt: "Sourced from general AI knowledge.",
                },
                order: 0,
            },
        });

        if (tagIds && tagIds.length > 0) {
            for (const tId of tagIds) {
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "question_tags" ("question_id", "tag_id") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    dbQuestion.id,
                    tId
                );
            }
        }
        questionIds.push(dbQuestion.id);
    }

    return questionIds;
}

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
        // Source mixing percentages (default: 100% bank for backward compat)
        const pctBank = body.pctBank ?? 100;
        const pctRag = body.pctRag ?? 0;
        const pctGemini = body.pctGemini ?? 0;
        const repetitionPct = body.repetitionPct ?? 100;
        const bodyMaterialIds: string[] = body.materialIds || [];

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

                if (blueprint.generationMethod === 'generate_novel' && pctBank === 100 && pctRag === 0) {
                    // Backward compat: if blueprint says generate_novel but request didn't send percentages
                    // skip bank validation
                } else if (pctBank > 0) {
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

                    const bankCount = Math.round(numberOfQuestions * pctBank / 100);
                    if (matchingIds.length < bankCount) {
                        const shortage = bankCount - matchingIds.length;
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

        // --- Get previously used question IDs for repetition avoidance ---
        let previouslyUsedIds = new Set<string>();
        if (pctBank > 0 && repetitionPct < 100) {
            const prevExams = await prisma.$queryRawUnsafe<any[]>(
                `SELECT e.id FROM exams e WHERE e.description->>'blueprint_id' = $1`,
                blueprintId
            );
            if (prevExams.length > 0) {
                const examIds = prevExams.map((e: any) => `'${e.id}'`).join(',');
                const usedQs = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT DISTINCT sq.question_id FROM section_questions sq 
                     JOIN sections s ON s.id = sq.section_id 
                     WHERE s.exam_id IN (${examIds})`
                );
                previouslyUsedIds = new Set(usedQs.map((q: any) => q.question_id));
            }
        }

        // --- Determine effective material IDs for RAG ---
        const effectiveMaterialIds = bodyMaterialIds.length > 0
            ? bodyMaterialIds
            : (blueprint.materials?.map((m: any) => m.id) || []);

        // --- PHASE 3: Build the actual exam content ---
        let totalMarks = 0;
        // Collect generated question objects for review
        const generatedQuestionsForReview: any[] = [];
        const examSectionsToCreate: any[] = [];
        let expectedQuestionCount = 0;
        let rateLimitHit = false;
        let rateLimitError = '';
        let actualQuestionCount = 0;

        for (const blueprintSection of blueprint.sections) {
            let sectionMarks = 0;
            const collectedQuestions: any[] = [];

            if (rateLimitHit) {
                // Still push empty section so exam structure is complete
                examSectionsToCreate.push({
                    name: blueprintSection.name,
                    order: blueprintSection.order,
                    questions: [],
                });
                // Count expected from remaining rules
                for (const rule of blueprintSection.rules) {
                    expectedQuestionCount += Number(rule.numberOfQuestions);
                }
                continue;
            }

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
                const tagIds = topicTags ? topicTags.map((t: any) => t.id) : [];
                const selectedIds: string[] = [];

                // Split question counts across 3 sources
                const bankCount = Math.round(numberOfQuestions * pctBank / 100);
                const ragCount = Math.round(numberOfQuestions * pctRag / 100);
                const geminiCount = numberOfQuestions - bankCount - ragCount;

                // --- BANK SELECTION ---
                if (bankCount > 0) {
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

                    // Separate fresh vs reused
                    const freshIds = matchingIds.filter(q => !previouslyUsedIds.has(q.id));
                    const reusedIds = matchingIds.filter(q => previouslyUsedIds.has(q.id));

                    const maxRepeatable = Math.floor(bankCount * repetitionPct / 100);
                    const freshNeeded = bankCount - maxRepeatable;

                    const shuffledFresh = freshIds.sort(() => 0.5 - Math.random());
                    const shuffledReused = reusedIds.sort(() => 0.5 - Math.random());

                    const picked = [
                        ...shuffledFresh.slice(0, Math.min(freshNeeded, shuffledFresh.length)),
                        ...shuffledReused.slice(0, maxRepeatable)
                    ];

                    if (picked.length < bankCount) {
                        const remaining = bankCount - picked.length;
                        const alreadyPicked = new Set(picked.map(p => p.id));
                        const fallback = [...shuffledFresh, ...shuffledReused]
                            .filter(q => !alreadyPicked.has(q.id))
                            .slice(0, remaining);
                        picked.push(...fallback);
                    }

                    selectedIds.push(...picked.map(q => q.id));
                }

                // --- RAG GENERATION (with rate limit protection) ---
                if (ragCount > 0 && !rateLimitHit) {
                    try {
                        const tagNames = topicTags ? topicTags.map((t: any) => t.name).join(", ") : "General Knowledge";
                        let contextMap = '';
                        let ragCitationMeta: CitationMeta | undefined;

                        if (effectiveMaterialIds.length > 0) {
                            const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
                            const aiPromptVector = await embedModel.embedContent(
                                `Generate a ${questionType} question about ${tagNames}. Difficulty level: ${difficulty || "medium"}.`
                            );
                            const matIdsSql = effectiveMaterialIds.map((id: string) => `'${id}'`).join(',');
                            const contextChunks = await prisma.$queryRawUnsafe<any[]>(
                                `SELECT content, page_number, chunk_index, 1 - (embedding <=> '[${aiPromptVector.embedding.values.join(",")}]') as similarity 
                                 FROM "document_chunks" WHERE reference_material_id IN (${matIdsSql})
                                 ORDER BY similarity DESC LIMIT 15`
                            );
                            contextMap = contextChunks.map(c => c.content).join("\n\n---\n\n");

                            // Build rich citation metadata from retrieved chunks
                            ragCitationMeta = {
                                pages: [...new Set(contextChunks.map(c => c.page_number).filter(Boolean))].sort((a, b) => a - b),
                                chunks: contextChunks.slice(0, 5).map(c => {
                                    const text = (c.content || '').trim();
                                    const lines = text.split('\n').filter((l: string) => l.trim());
                                    return {
                                        pageNumber: c.page_number || 0,
                                        chunkIndex: c.chunk_index || 0,
                                        startText: lines[0]?.substring(0, 80) || '',
                                        endText: lines[lines.length - 1]?.substring(0, 80) || '',
                                    };
                                }),
                            };
                        }

                        const generatedQs = await generateAiQuestions(ragCount, questionType, tagNames, difficulty, contextMap, tagIds, ragCitationMeta);
                        selectedIds.push(...generatedQs);
                    } catch (aiErr: any) {
                        if (aiErr?.status === 429 || aiErr?.message?.includes('429') || aiErr?.message?.includes('quota')) {
                            rateLimitHit = true;
                            rateLimitError = `Gemini API rate limit hit after generating ${actualQuestionCount + selectedIds.length} questions. Remaining rules skipped.`;
                            console.warn('[RATE LIMIT]', rateLimitError);
                        } else {
                            throw aiErr; // Re-throw non-rate-limit errors
                        }
                    }
                }

                // --- GEMINI GENERATION (with rate limit protection) ---
                if (geminiCount > 0 && !rateLimitHit) {
                    try {
                        const tagNames = topicTags ? topicTags.map((t: any) => t.name).join(", ") : "General Knowledge";
                        const generatedQs = await generateAiQuestions(geminiCount, questionType, tagNames, difficulty, '', tagIds);
                        selectedIds.push(...generatedQs);
                    } catch (aiErr: any) {
                        if (aiErr?.status === 429 || aiErr?.message?.includes('429') || aiErr?.message?.includes('quota')) {
                            rateLimitHit = true;
                            rateLimitError = `Gemini API rate limit hit after generating ${actualQuestionCount + selectedIds.length} questions. Remaining rules skipped.`;
                            console.warn('[RATE LIMIT]', rateLimitError);
                        } else {
                            throw aiErr;
                        }
                    }
                }

                // Fetch all collected question IDs (bank + whatever AI managed to generate)
                if (selectedIds.length > 0) {
                    const questions = await prisma.question.findMany({
                        where: { id: { in: selectedIds } },
                        include: { tags: true },
                    });
                    // Append fetched questions to review collection
                    generatedQuestionsForReview.push(...questions);

                    for (let i = 0; i < questions.length; i++) {
                        const q = questions[i];
                        sectionMarks += Number(marksPerQuestion);
                        collectedQuestions.push({
                            original: q,
                            marks: Number(marksPerQuestion),
                            negativeMarks: negativeMarks ? Number(negativeMarks) : null,
                        });
                    }
                    actualQuestionCount += questions.length;
                }
            } // End rules loop

            totalMarks += sectionMarks;
            examSectionsToCreate.push({
                name: blueprintSection.name,
                order: blueprintSection.order,
                questions: collectedQuestions,
            });
        } // End sections loop

        // Store expected question count and blueprint ID in description JSON
        const examDescription = typeof description === 'object' && description !== null
            ? { ...description, expected_questions: expectedQuestionCount, blueprint_id: blueprint.id }
            : { en: description || '', pa: description || '', expected_questions: expectedQuestionCount, blueprint_id: blueprint.id };

        // 3. Create the Exam
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

        // 4. Create sections
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

        // 5. Link questions to exam sections
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

        // Log generation summary
        const summary = {
            examId: exam.id,
            expectedQuestions: expectedQuestionCount,
            actualQuestions: actualQuestionCount,
            rateLimitHit,
            rateLimitError: rateLimitError || null,
            timestamp: new Date().toISOString(),
        };
        console.log('[EXAM GENERATION SUMMARY]', JSON.stringify(summary, null, 2));

        return NextResponse.json({
            success: true,
            examId: exam.id,
            message: rateLimitHit
                ? `Exam created as incomplete draft. ${actualQuestionCount}/${expectedQuestionCount} questions generated before API rate limit was reached. You can add missing questions manually.`
                : "Exam generated successfully.",
            ...(rateLimitHit && {
                warning: rateLimitError,
                questionsGenerated: actualQuestionCount,
                questionsExpected: expectedQuestionCount,
            }),
        });
    } catch (error: any) {
        console.error("Failed to generate exam:", error);
        try {
            const fs = require('fs');
            fs.writeFileSync('RAG_ERROR.txt', error?.stack || error?.message || String(error));
        } catch (e) { }
        return NextResponse.json(
            {
                success: false,
                error: "Failed to generate exam: " + (error?.message || String(error)),
                debug_stack: error?.stack || null
            },
            { status: 500 },
        );
    }
}
