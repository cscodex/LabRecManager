import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    },
    required: ["text", "options", "correctAnswer", "explanation"]
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { blueprintId, title, description, duration, createdById } = body;

        if (!blueprintId || !title || !duration || !createdById) {
            return NextResponse.json({ success: false, error: 'Missing required exam details (blueprintId, title, duration, createdById).' }, { status: 400 });
        }

        // 1. Fetch the blueprint and rules
        // @ts-ignore - Prisma type cache issue
        const blueprint = await prisma.examBlueprint.findUnique({
            where: { id: blueprintId },
            include: {
                sections: {
                    include: {
                        rules: {
                            include: { topicTags: true }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            }
        });

        if (!blueprint) {
            return NextResponse.json({ success: false, error: 'Blueprint not found' }, { status: 404 });
        }

        // 2. Collect Questions for Each Rule
        let totalMarks = 0;
        const examSectionsToCreate: any[] = [];

        for (const blueprintSection of blueprint.sections) {
            let sectionMarks = 0;
            const collectedQuestions: any[] = [];

            for (const rule of blueprintSection.rules) {
                const { topicTags, questionType, numberOfQuestions, difficulty, marksPerQuestion, negativeMarks } = rule;

                const selectedIds: string[] = [];
                const tagIds = topicTags ? topicTags.map((t: any) => t.id) : [];

                if (blueprint.generationMethod === 'generate_novel') {
                    // --- PHASE 3: DYNAMIC AI RAG GENERATION --- //
                    const tagNames = topicTags ? topicTags.map((t: any) => t.name).join(', ') : 'General Knowledge';

                    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
                    const generatorModel = genAI.getGenerativeModel({
                        model: "gemini-2.5-flash",
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: QuestionSchema,
                            temperature: 0.7,
                        }
                    });

                    // We execute sequentially to avoid destroying the LLM rate limit on a 50-question exam
                    for (let i = 0; i < numberOfQuestions; i++) {
                        try {
                            // 1. Vectorize query
                            const searchPhrase = `${tagNames} question concept`;
                            const embedResult = await embedModel.embedContent(searchPhrase);
                            const queryVector = embedResult.embedding.values;
                            const pgVectorString = `[${queryVector.join(',')}]`;

                            // 2. Fetch Top 1 Chunk via Cosine Distance
                            // We use OFFSET i loosely so different questions might pull slightly different chunks
                            const closestChunks: any[] = await prisma.$queryRawUnsafe(`
                                SELECT 
                                    dc.content, 
                                    rm.title as source_title
                                FROM document_chunks dc
                                JOIN reference_materials rm ON dc.reference_material_id = rm.id
                                ORDER BY dc.embedding <=> '${pgVectorString}'::vector
                                LIMIT 1 OFFSET ${i % 3}; 
                            `);

                            const referenceText = closestChunks[0]?.content || "Use general physics and chemistry principles to deduce the answer.";
                            const sourceTitle = closestChunks[0]?.source_title || "General Knowledge Base";

                            // 3. Generate Question
                            let promptDifficulty = "Standard";
                            if (difficulty === 1) promptDifficulty = "Very Easy / Fundamental";
                            if (difficulty === 5) promptDifficulty = "Extremely Hard / Complex Multi-step";

                            const prompt = `
                                You are an expert Exam Paper Setter. 
                                Your goal is to draft a NOVEL, ORIGINAL Multiple Choice Question.

                                **REFERENCE TEXT (STRICTLY BASE THE QUESTION ON THIS):**
                                """
                                ${referenceText}
                                """

                                **REQUIREMENTS:**
                                - Topic: ${tagNames}
                                - Difficulty: ${promptDifficulty}
                                - The 3 distractors MUST be plausible misconceptions (e.g. wrong formulas).
                                - Use LaTeX \\( \\) for math.
                                - Do NOT prepend letters (A, B, C) to options.
                                Return strictly in JSON.
                            `;

                            const aiResult = await generatorModel.generateContent(prompt);
                            const generatedQ = JSON.parse(aiResult.response.text());

                            // 4. Save to Database natively
                            const newQuestion = await prisma.question.create({
                                data: {
                                    text: generatedQ.text,
                                    options: generatedQ.options,
                                    correctAnswer: generatedQ.correctAnswer,
                                    explanation: generatedQ.explanation,
                                    type: questionType,
                                    difficulty: difficulty || 3,
                                    order: 0,
                                    isAiGenerated: true,
                                    citation: { source: sourceTitle, text_excerpt: referenceText.substring(0, 150) + '...' }
                                }
                            });

                            if (tagIds.length > 0) {
                                for (const tId of tagIds) {
                                    await prisma.$executeRawUnsafe(
                                        `INSERT INTO "question_tags" ("question_id", "tag_id") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                                        newQuestion.id, tId
                                    );
                                }
                            }

                            // Fetch full question so it matches the expected array format downstream
                            const fullQuestion = await prisma.question.findUnique({
                                where: { id: newQuestion.id },
                                include: { tags: true }
                            });

                            sectionMarks += Number(marksPerQuestion);
                            collectedQuestions.push({
                                original: fullQuestion,
                                marks: Number(marksPerQuestion),
                                negativeMarks: negativeMarks ? Number(negativeMarks) : null
                            });

                        } catch (err: any) {
                            console.error(`RAG Generation failed for 1 question in rule ${tagNames}:`, err.message);
                            return NextResponse.json({
                                success: false,
                                error: `Failed to synthesize AI question for topic '${tagNames}'. Error: ${err.message}`
                            }, { status: 500 });
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
                        select: { id: true }
                    });

                    if (matchingIds.length < numberOfQuestions) {
                        const tagNames = topicTags && topicTags.length > 0 ? topicTags.map((t: any) => t.name).join(', ') : 'Any';
                        return NextResponse.json({
                            success: false,
                            error: `Not enough unique questions available for Rule (Type: ${questionType}, Tags: ${tagNames}). Needed ${numberOfQuestions}, Found ${matchingIds.length}.`
                        }, { status: 400 });
                    }

                    // Shuffle in JS
                    const shuffled = matchingIds.sort(() => 0.5 - Math.random());
                    selectedIds.push(...shuffled.slice(0, numberOfQuestions).map(q => q.id));

                    // Fetch full questions to copy
                    const questions = await prisma.question.findMany({
                        where: { id: { in: selectedIds } },
                        include: { tags: true }
                    });

                    for (let i = 0; i < questions.length; i++) {
                        const q = questions[i];
                        sectionMarks += Number(marksPerQuestion);
                        collectedQuestions.push({
                            original: q,
                            marks: Number(marksPerQuestion),
                            negativeMarks: negativeMarks ? Number(negativeMarks) : null
                        });
                    }
                }
            }

            totalMarks += sectionMarks;
            examSectionsToCreate.push({
                name: blueprintSection.name,
                order: blueprintSection.order,
                questions: collectedQuestions
            });
        }

        // 3. Create the Exam (no nested create to avoid Neon HTTP transaction error)
        const exam = await prisma.exam.create({
            data: {
                title,
                description,
                duration: parseInt(duration),
                totalMarks,
                createdById,
                status: 'draft',
            }
        });

        // 4. Create sections one by one (no transaction needed)
        const createdSections: any[] = [];
        for (const sec of examSectionsToCreate) {
            const section = await prisma.section.create({
                data: {
                    examId: exam.id,
                    name: sec.name,
                    order: sec.order
                }
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
                    secData.id, og.id, cq.marks, cq.negativeMarks, orderCounter++
                );
            }
        }

        return NextResponse.json({ success: true, examId: exam.id, message: 'Exam generated successfully.' });
    } catch (error: any) {
        console.error('Failed to generate exam:', error);
        return NextResponse.json({ success: false, error: 'Failed to generate exam: ' + error.message }, { status: 500 });
    }
}
