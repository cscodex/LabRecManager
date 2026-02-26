import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';
import { generateQuestions, GenerateQuestionsRequest } from '@/lib/ai-question-generator';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

/**
 * POST /api/ai/generate-questions
 * 
 * Multi-agent AI pipeline that generates novel exam questions from reference text.
 * 
 * Body: {
 *   topic: string,           // "Thermodynamics"
 *   referenceText: string,    // The source material text
 *   count: number,            // How many questions to generate (1-20)
 *   type?: string,            // mcq_single, mcq_multiple, true_false, short_answer, fill_blank
 *   difficulty?: number,      // 1-5
 *   style?: string,           // jee_advanced, upsc_prelims, standard_board, gate, general
 *   language?: string,        // "en" or "both" (en + pa)
 *   marksPerQuestion?: number,
 *   negativeMarks?: number,
 *   saveToBank?: boolean,     // If true, save generated questions to the question bank
 *   sectionId?: string,       // If provided, also link to this section via section_questions
 *   tags?: string[]           // Tag IDs to attach to generated questions
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const {
            topic,
            referenceText,
            count = 5,
            type = 'mcq_single',
            difficulty = 3,
            style = 'general',
            language = 'en',
            marksPerQuestion = 1,
            negativeMarks = 0,
            saveToBank = false,
            sectionId,
            tags = []
        } = body;

        // Validation
        if (!topic || !referenceText) {
            return NextResponse.json({ error: 'topic and referenceText are required' }, { status: 400 });
        }
        if (count < 1 || count > 20) {
            return NextResponse.json({ error: 'count must be between 1 and 20' }, { status: 400 });
        }
        if (referenceText.length < 50) {
            return NextResponse.json({ error: 'referenceText must be at least 50 characters' }, { status: 400 });
        }

        // Run the multi-agent pipeline
        const request: GenerateQuestionsRequest = {
            topic,
            referenceText,
            count,
            type,
            difficulty,
            style,
            language,
            marksPerQuestion,
            negativeMarks
        };

        const result = await generateQuestions(request);

        // Optionally save to question bank
        let savedIds: string[] = [];
        if (saveToBank) {
            for (const q of result.questions) {
                const [saved] = await sql`
                    INSERT INTO questions (
                        type, text, options, correct_answer, explanation,
                        marks, difficulty, negative_marks,
                        is_ai_generated, citation, quality_score
                    ) VALUES (
                        ${q.type},
                        ${JSON.stringify(q.text)},
                        ${JSON.stringify(q.options || [])},
                        ${JSON.stringify(q.correctAnswer)},
                        ${JSON.stringify(q.explanation)},
                        ${q.marks},
                        ${q.difficulty},
                        ${q.negativeMarks || null},
                        true,
                        ${JSON.stringify(q.citation)},
                        ${q.reviewScore || null}
                    ) RETURNING id
                `;

                savedIds.push(saved.id);

                // Link to section if provided
                if (sectionId) {
                    const maxOrd = await sql`
                        SELECT COALESCE(MAX("order"), 0) as mx FROM section_questions WHERE section_id = ${sectionId}
                    `;
                    const nextOrder = parseInt(maxOrd[0].mx) + 1;

                    await sql`
                        INSERT INTO section_questions (section_id, question_id, marks, negative_marks, "order")
                        VALUES (${sectionId}, ${saved.id}, ${q.marks}, ${q.negativeMarks || null}, ${nextOrder})
                    `;
                }

                // Attach tags
                if (tags.length > 0) {
                    for (const tagId of tags) {
                        await sql`
                            INSERT INTO question_tags (question_id, tag_id)
                            VALUES (${saved.id}, ${tagId})
                            ON CONFLICT DO NOTHING
                        `;
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            questions: result.questions,
            savedIds: saveToBank ? savedIds : undefined,
            stats: result.stats
        });

    } catch (error: any) {
        console.error('[AI Generate Questions Error]', error);
        return NextResponse.json({
            error: error?.message || 'Failed to generate questions',
            details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
        }, { status: 500 });
    }
}
