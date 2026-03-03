import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const groqKeys = (process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const openaiKey = process.env.OPENAI_API_KEY || '';

function getProvider(model: string): 'gemini' | 'groq' | 'openai' {
    if (model.includes('llama') || model.includes('meta-llama') || model.includes('mixtral')) return 'groq';
    if (model.includes('gpt')) return 'openai';
    return 'gemini';
}

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const examId = params.id;
        const url = new URL(request.url);
        const targetSectionId = url.searchParams.get('sectionId');
        const limitParam = url.searchParams.get('limit');
        const generationLimit = limitParam ? parseInt(limitParam, 10) : Infinity;

        // Parse model from request body
        let selectedModel = 'gemini-2.5-flash';
        let boardContext = 'PSEB';
        let classLevel = '12th';
        let subjectContext = '';
        try {
            const body = await request.json();
            if (body.model) selectedModel = body.model;
            if (body.board) boardContext = body.board;
            if (body.class) classLevel = body.class;
            if (body.subject) subjectContext = body.subject;
        } catch { /* no body, use defaults */ }
        const provider = getProvider(selectedModel);

        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                sections: true
            }
        });

        if (!exam) {
            return NextResponse.json({ success: false, error: 'Exam not found' }, { status: 404 });
        }

        let blueprintId = null;
        if (typeof exam.description === 'object' && exam.description !== null) {
            blueprintId = (exam.description as any).blueprint_id;
        } else if (typeof exam.description === 'string') {
            try {
                blueprintId = JSON.parse(exam.description).blueprint_id;
            } catch (e) {
                console.error("Failed to parse description", e);
            }
        }

        if (!blueprintId) {
            return NextResponse.json({ success: false, error: 'Exam was not created with a valid blueprint sequence. Missing blueprint ID.' }, { status: 400 });
        }

        const blueprint = await (prisma.examBlueprint.findUnique as any)({
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
        });

        if (!blueprint) {
            return NextResponse.json({ success: false, error: 'Associated blueprint no longer exists.' }, { status: 404 });
        }

        // Filter blueprint sections strictly by targetSectionId if requested
        let sectionsToProcess = blueprint.sections || [];
        if (targetSectionId) {
            const targetExamSection = exam.sections.find((s: any) => s.id === targetSectionId);
            if (targetExamSection) {
                // Match by order, which is how sections are linked
                sectionsToProcess = sectionsToProcess.filter((bs: any) => bs.order === targetExamSection.order);
            }
        }

        let totalGenerated = 0;
        let limitReached = false;

        for (const blueprintSection of sectionsToProcess) {
            if (limitReached) break;
            // Find corresponding exam section by order
            const examSection = exam.sections.find((s: any) => s.order === blueprintSection.order);
            if (!examSection) continue;

            // Fetch ALL questions currently linked to this section ONCE
            const allSectionQuestions = await prisma.sectionQuestion.findMany({
                where: { sectionId: examSection.id },
                include: {
                    question: {
                        include: { tags: { select: { tagId: true } } }
                    }
                }
            }) as any[];

            // Track which questions have been "claimed" by earlier rules
            const claimedIds = new Set<string>();

            for (const rule of blueprintSection.rules) {
                if (limitReached) break;
                const questionType = rule.questionType;
                const difficulty = rule.difficulty ? Number(rule.difficulty) : null;
                const topicTags = rule.topicTags || [];
                const tagIds = topicTags.map((t: any) => t.id).filter(Boolean);

                // Count unclaimed questions matching this rule
                let claimedForThisRule = 0;
                for (const sq of allSectionQuestions) {
                    const q = sq.question;
                    if (claimedIds.has(q.id)) continue;
                    if (q.type !== questionType) continue;
                    if (difficulty && Number(q.difficulty) !== difficulty) continue;
                    if (tagIds.length > 0) {
                        const qTagIds = q.tags?.map((t: any) => t.tagId) || [];
                        if (!tagIds.some((tid: string) => qTagIds.includes(tid))) continue;
                    }
                    claimedIds.add(q.id);
                    claimedForThisRule++;
                    if (claimedForThisRule >= Number(rule.numberOfQuestions)) break;
                }

                const numberToGenerate = Number(rule.numberOfQuestions) - claimedForThisRule;

                if (numberToGenerate > 0) {
                    // Cap by the remaining generation budget
                    const budgetRemaining = generationLimit - totalGenerated;
                    if (budgetRemaining <= 0) { limitReached = true; break; }
                    let remainingToGenerate = Math.min(numberToGenerate, budgetRemaining);

                    while (remainingToGenerate > 0 && totalGenerated < generationLimit) {
                        const batchSize = Math.min(remainingToGenerate, 5);

                        const tagNames = topicTags && topicTags.length > 0
                            ? topicTags.map((t: any) => t.name).join(", ")
                            : "General Knowledge";

                        // Build context from knowledge base (only if materials exist and provider is Gemini for embeddings)
                        let contextMap = '';
                        if (blueprint.materials && (blueprint.materials as any[]).length > 0 && provider === 'gemini') {
                            try {
                                const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
                                const aiPromptVector = await embedModel.embedContent(
                                    `Generate a ${questionType} question about ${tagNames}. Difficulty level: ${difficulty || "medium"}.`
                                );
                                const materialIds = (blueprint.materials as any[]).map((m: any) => `'${m.id}'`).join(',');
                                const contextFilter = `WHERE reference_material_id IN (${materialIds})`;
                                const contextChunks = await prisma.$queryRawUnsafe<any[]>(
                                    `SELECT chunk_text, 1 - (embedding <=> '[${aiPromptVector.embedding.values.join(",")}]') as similarity 
                                        FROM "DocumentChunk" 
                                        ${contextFilter}
                                        ORDER BY similarity DESC 
                                        LIMIT 15`
                                );
                                contextMap = contextChunks.map((c) => c.chunk_text).join("\n\n---\n\n");
                            } catch (embedErr) {
                                console.warn("Embedding search failed, continuing without context:", embedErr);
                            }
                        }

                        const isMCQ = questionType.startsWith('mcq');
                        const optionsInstruction = isMCQ
                            ? `IMPORTANT: Each question MUST include an "options" array with exactly 4 distinct answer choices as plain strings, and a "correctOption" field with the 0-indexed position of the correct answer (0, 1, 2, or 3).`
                            : `For non-MCQ types, do NOT include options. If the type is "paragraph", include a "paragraphText" field with a reading passage.`;

                        // Build dynamic board context
                        const boardFullNames: Record<string, string> = {
                            'PSEB': 'Punjab School Education Board',
                            'CBSE': 'Central Board of Secondary Education',
                            'ICSE': 'Indian Certificate of Secondary Education',
                            'State Board': 'State Education Board',
                            'University': 'University Level',
                            'Competitive': 'Competitive Examination'
                        };
                        const boardFull = boardFullNames[boardContext] || boardContext;
                        const subjectLabel = subjectContext || tagNames;
                        const classLabel = classLevel ? `Class ${classLevel}` : '';

                        // Get material names for additional context (for all providers)
                        const materialNames = blueprint.materials && (blueprint.materials as any[]).length > 0
                            ? (blueprint.materials as any[]).map((m: any) => m.title).join(', ')
                            : '';

                        const fullPrompt = `You are an expert question paper setter for ${boardContext} (${boardFull}) ${classLabel} ${subjectLabel} examination.

CONTEXT:
- Board: ${boardContext} (${boardFull})
${classLabel ? `- Level: ${classLabel}` : ''}
${subjectLabel ? `- Subject: ${subjectLabel}` : ''}
- Topic: ${tagNames}
${materialNames ? `- Syllabus/Reference Materials: ${materialNames}` : ''}

STRICT RULES:
1. Match the style, language complexity, and difficulty of actual ${boardContext} ${classLabel} exam papers for ${subjectLabel}
2. Questions must be age-appropriate and use language suitable for ${classLabel || 'the target'} students
3. Use simple, direct language — avoid unnecessarily verbose or academic phrasing
4. MCQ question text: MAX 2 sentences (≤80 words). Each option: MAX 20 words, concise and clear
5. Short answer questions: MAX 60 words
6. Include practical/real-world scenarios where appropriate but keep them brief
7. Do NOT prefix options with A), B), etc. — just provide the text
8. Questions should follow the ${boardContext} syllabus and curriculum standards

Generate exactly ${batchSize} questions.
Question type: ${questionType}
Difficulty: ${difficulty || 3}/5

${optionsInstruction}

${contextMap ? `Reference Context (use for accuracy, not copying):\n${contextMap}` : 'Generate from your knowledge of the syllabus and curriculum. Ensure answers are factually correct and verifiable.'}

Return a JSON array (NO markdown, NO code fences, ONLY valid JSON):
[
  {
    "text": "Concise question text",
    "type": "${questionType}",
    ${isMCQ ? `"options": ["Short option A", "Short option B", "Short option C", "Short option D"],
    "correctOption": 0,` : `"paragraphText": "",`}
    "difficulty": ${difficulty || 3},
    "explanation": "Brief explanation"
  }
]`;

                        // Call the appropriate provider
                        let rawText = '';
                        try {
                            if (provider === 'groq' || provider === 'openai') {
                                const apiUrl = provider === 'groq'
                                    ? 'https://api.groq.com/openai/v1/chat/completions'
                                    : 'https://api.openai.com/v1/chat/completions';
                                const apiKey = provider === 'groq' ? groqKeys[0] : openaiKey;

                                if (!apiKey) throw new Error(`${provider} API key not configured`);

                                const chatResponse = await fetch(apiUrl, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${apiKey}`
                                    },
                                    body: JSON.stringify({
                                        model: selectedModel,
                                        messages: [
                                            { role: 'system', content: 'You are an expert exam question author. Return ONLY valid JSON arrays, NO markdown, NO code fences.' },
                                            { role: 'user', content: fullPrompt }
                                        ],
                                        temperature: 0.7,
                                        max_tokens: 4096,
                                        response_format: { type: "json_object" }
                                    })
                                });

                                if (!chatResponse.ok) {
                                    const errData = await chatResponse.json().catch(() => ({}));
                                    throw new Error(`${provider} API error ${chatResponse.status}: ${(errData as any)?.error?.message || chatResponse.statusText}`);
                                }

                                const chatData = await chatResponse.json();
                                rawText = chatData.choices?.[0]?.message?.content || '';
                            } else {
                                // Gemini provider
                                const generatorModel = genAI.getGenerativeModel({
                                    model: selectedModel,
                                    generationConfig: { responseMimeType: "application/json" }
                                });
                                const geminiResponse = await generatorModel.generateContent(fullPrompt);
                                rawText = geminiResponse.response.text();
                            }
                        } catch (apiErr: any) {
                            const errMsg = apiErr.message || '';
                            console.error(`${provider} API call failed:`, errMsg);

                            // Auto-fallback: if Gemini hits 429 quota, retry with Groq
                            if (provider === 'gemini' && (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Too Many Requests'))) {
                                const groqKey = groqKeys?.[0];
                                if (groqKey) {
                                    console.log('⚡ Gemini quota exhausted — auto-falling back to Groq/Llama...');
                                    try {
                                        const fallbackModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
                                        const chatResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${groqKey}`
                                            },
                                            body: JSON.stringify({
                                                model: fallbackModel,
                                                messages: [
                                                    { role: 'system', content: 'You are an expert exam question author. Return ONLY valid JSON arrays, NO markdown, NO code fences.' },
                                                    { role: 'user', content: fullPrompt }
                                                ],
                                                temperature: 0.7,
                                                max_tokens: 4096
                                            })
                                        });

                                        if (chatResponse.ok) {
                                            const chatData = await chatResponse.json();
                                            rawText = chatData.choices?.[0]?.message?.content || '';
                                            console.log('✅ Groq fallback succeeded');
                                        } else {
                                            const errData = await chatResponse.json().catch(() => ({}));
                                            console.error('Groq fallback also failed:', (errData as any)?.error?.message || chatResponse.statusText);
                                            break;
                                        }
                                    } catch (groqErr: any) {
                                        console.error('Groq fallback error:', groqErr.message);
                                        break;
                                    }
                                } else {
                                    console.error('No GROQ_API_KEY configured for fallback');
                                    break;
                                }
                            } else {
                                // Non-quota error — wait and break
                                await new Promise(r => setTimeout(r, 2000));
                                break;
                            }
                        }

                        // Parse the JSON response
                        let generatedArray = [];
                        try {
                            rawText = rawText.trim();
                            // Robust extraction: find the JSON array between first [ and last ]
                            const firstBracket = rawText.indexOf('[');
                            const lastBracket = rawText.lastIndexOf(']');
                            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                                rawText = rawText.substring(firstBracket, lastBracket + 1);
                            } else {
                                rawText = rawText.replace(/^```[\s\S]*?\n/i, "").replace(/\n?```\s*$/i, "").trim();
                            }
                            generatedArray = JSON.parse(rawText);
                        } catch (e) {
                            console.warn("Failed to parse AI batch response, skipping this batch and continuing...", e);
                            break;
                        }

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
                                    options: (generatedQ.options || []).map((opt: string, idx: number) => ({
                                        id: String.fromCharCode(65 + idx), // A, B, C, D
                                        text: { en: opt }
                                    })),
                                    correctAnswer: generatedQ.correctOption !== undefined && generatedQ.correctOption !== null
                                        ? [String.fromCharCode(65 + Number(generatedQ.correctOption))] // 0→"A", 1→"B", etc.
                                        : [],
                                    paragraphId: paragraphId,
                                    isAiGenerated: true,
                                    citation: contextMap ? 'AI Synthesized RAG' : 'AI Internal Knowledge Base',
                                    order: 999
                                }
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

                        // Deduct exactly what was generated, not what was requested.
                        remainingToGenerate -= generatedArray.length;

                        // Failsafe: if the LLM completely refuses to generate anything new (length 0),
                        // break out to avoid an infinite API ping loop.
                        if (generatedArray.length === 0) {
                            console.warn("Gemini returned 0 valid questions in this chunk. Skipping remaining for this rule.");
                            break;
                        }

                        // Add an artificial delay to prevent hitting Gemini API free tier 15 RPM limits
                        await new Promise(resolve => setTimeout(resolve, 4500));
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
