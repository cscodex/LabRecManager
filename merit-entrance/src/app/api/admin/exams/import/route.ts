import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || '');

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session?.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { mode, questions, instructions, paragraphs, sections: sectionsPayload } = body;

        if (!questions || !Array.isArray(questions)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        let targetExamId;

        // Helper: insert questions into a section
        const insertQuestionsForSection = async (sectionId: string, sectionQuestions: any[], sectionParagraphs: any[]) => {
            // Insert paragraphs first
            const paragraphIdMap: Record<string, string> = {};
            if (sectionParagraphs && Array.isArray(sectionParagraphs) && sectionParagraphs.length > 0) {
                for (const p of sectionParagraphs) {
                    try {
                        const pResult = await sql`
                            INSERT INTO paragraphs (text, content)
                            VALUES (
                                ${JSON.stringify({ en: p.title || 'Untitled Passage' })}::jsonb,
                                ${JSON.stringify({ en: p.content || '' })}::jsonb
                            ) RETURNING id
                        `;
                        paragraphIdMap[p.id] = pResult[0].id;
                    } catch (pError: any) {
                        console.error(`Failed to insert paragraph ${p.id}:`, pError.message);
                    }
                }
            }

            let insertedCount = 0;
            const errors: string[] = [];

            for (let idx = 0; idx < sectionQuestions.length; idx++) {
                const q = sectionQuestions[idx];
                try {
                    let type = q.type || 'mcq_single';
                    if (type === 'mcq') type = 'mcq_single';

                    const formattedOptions = (q.options || []).map((opt: string, optIdx: number) => ({
                        id: String.fromCharCode(65 + optIdx),
                        text: { en: opt }
                    }));

                    let correctAnswerValue: string[] = [];
                    let modelAnswerValue: string | null = null;

                    if (type === 'mcq_single') {
                        if (q.correctAnswer && /^[A-Z]$/.test(q.correctAnswer)) {
                            correctAnswerValue = [q.correctAnswer];
                        }
                    } else if (type === 'fill_blank') {
                        if (q.correctAnswer) correctAnswerValue = [q.correctAnswer];
                    } else {
                        // Short/Long answer: use 'answer' field (new), fallback to 'correctAnswer' for backward compat
                        modelAnswerValue = q.answer || q.correctAnswer || null;
                    }

                    const dbParagraphId = q.paragraphId ? (paragraphIdMap[q.paragraphId] || null) : null;

                    const questionResult = await sql`
                        INSERT INTO questions (
                            section_id, text, type, options, correct_answer,
                            model_answer, marks, explanation, difficulty,
                            paragraph_id, image_url, "order"
                        ) VALUES (
                            ${sectionId},
                            ${JSON.stringify({ en: q.text })}::jsonb,
                            ${type},
                            ${JSON.stringify(formattedOptions)}::jsonb,
                            ${JSON.stringify(correctAnswerValue)}::jsonb,
                            ${modelAnswerValue ? JSON.stringify({ en: modelAnswerValue }) : null}::jsonb,
                            ${parseFloat(q.marks) || 1},
                            ${JSON.stringify({ en: q.explanation || '' })}::jsonb,
                            ${Math.round(Number(q.difficulty) || 1)},
                            ${dbParagraphId},
                            ${q.imageUrl || null},
                            ${idx + 1}
                        ) RETURNING id
                    `;
                    const questionId = questionResult[0].id;

                    // Also link it in section_questions!
                    await sql`
                        INSERT INTO section_questions (section_id, question_id, marks, negative_marks, "order")
                        VALUES (${sectionId}, ${questionId}, ${parseFloat(q.marks) || 1}, 0, ${idx + 1})
                    `;

                    // Insert Tags
                    if (q.tags && Array.isArray(q.tags) && q.tags.length > 0) {
                        for (const tagName of q.tags) {
                            const cleanedTag = tagName.trim();
                            if (!cleanedTag) continue;
                            await sql`INSERT INTO tags (name) VALUES (${cleanedTag}) ON CONFLICT(name) DO NOTHING`;
                            const tagRes = await sql`SELECT id FROM tags WHERE name = ${cleanedTag}`;
                            if (tagRes && tagRes.length > 0) {
                                await sql`
                                    INSERT INTO question_tags (question_id, tag_id)
                                    VALUES (${questionId}, ${tagRes[0].id})
                                    ON CONFLICT DO NOTHING
                                `;
                            }
                        }
                    }

                    insertedCount++;
                } catch (qError: any) {
                    console.error(`Failed to insert question ${idx + 1}: `, qError.message);
                    errors.push(`Q${idx + 1}: ${qError.message} `);
                }
            }

            return { insertedCount, errors };
        };

        // Determine if we have multi-section payload
        const hasMultiSections = sectionsPayload && Array.isArray(sectionsPayload) && sectionsPayload.length > 0;

        if (mode === 'existing') {
            const { examId, sectionId } = body;
            if (!examId) {
                return NextResponse.json({ error: 'Missing exam ID' }, { status: 400 });
            }
            targetExamId = examId;

            // Append instructions
            if (instructions && Array.isArray(instructions) && instructions.length > 0) {
                const instructionsHtml = instructions.map((inst: string) => `< li > ${inst} </li>`).join('');
                const instructionsContent = `<ul>${instructionsHtml}</ul>`;
                await sql`
                    UPDATE exams 
                    SET instructions = jsonb_set(
                        COALESCE(instructions, '{}'::jsonb),
                        '{en}',
                        to_jsonb(COALESCE(instructions->>'en', '') || ${instructionsContent})
                    ),
                    updated_at = NOW()
                    WHERE id = ${targetExamId}
                `;
            }

            const { sourcePdfUrl } = body;
            if (sourcePdfUrl) {
                await sql`
                    UPDATE exams 
                    SET 
                        source_pdf_url = ${sourcePdfUrl},
                        updated_at = NOW()
                    WHERE id = ${targetExamId}
                `;
            }

            if (hasMultiSections) {
                // Create new sections for each AI-detected section and append to existing exam
                const existingOrderResult = await sql`SELECT COALESCE(MAX("order"), 0) as max_order FROM sections WHERE exam_id = ${targetExamId}`;
                let nextOrder = (existingOrderResult[0]?.max_order || 0) + 1;

                let totalInserted = 0;
                const allErrors: string[] = [];

                for (const sec of sectionsPayload) {
                    if (!sec.questions || sec.questions.length === 0) continue;

                    const sectionResult = await sql`
                        INSERT INTO sections (exam_id, name, "order")
                        VALUES (${targetExamId}, ${JSON.stringify({ en: sec.name })}::jsonb, ${nextOrder})
                        RETURNING id
                    `;
                    const newSectionId = sectionResult[0].id;
                    nextOrder++;

                    const { insertedCount, errors } = await insertQuestionsForSection(newSectionId, sec.questions, sec.paragraphs || []);
                    totalInserted += insertedCount;
                    allErrors.push(...errors);
                }

                console.log(`Multi-section import to existing exam: ${totalInserted} questions in ${sectionsPayload.length} sections`);
                return NextResponse.json({
                    success: true,
                    examId: targetExamId,
                    questionCount: totalInserted,
                    sectionCount: sectionsPayload.length,
                    errors: allErrors.length > 0 ? allErrors : undefined
                });
            } else {
                // Legacy: single section
                if (!sectionId) {
                    return NextResponse.json({ error: 'Missing section ID' }, { status: 400 });
                }
                const { insertedCount, errors } = await insertQuestionsForSection(sectionId, questions, paragraphs || []);
                return NextResponse.json({
                    success: true,
                    examId: targetExamId,
                    questionCount: insertedCount,
                    errors: errors.length > 0 ? errors : undefined
                });
            }
        } else {
            // Mode: new exam
            const { title, duration, totalMarks, sourcePdfUrl } = body;
            if (!title) {
                return NextResponse.json({ error: 'Missing exam title' }, { status: 400 });
            }

            // Build instructions HTML
            let instructionsJsonb = '{}';
            if (instructions && Array.isArray(instructions) && instructions.length > 0) {
                const instructionsHtml = instructions.map((inst: string) => `<li>${inst}</li>`).join('');
                const instructionsContent = `<ul>${instructionsHtml}</ul>`;
                instructionsJsonb = JSON.stringify({ en: instructionsContent });
            }

            // Create Exam
            const examResult = await sql`
                INSERT INTO exams (
                    title, description, duration, total_marks, instructions,
                    status, created_by, created_at, updated_at, source_pdf_url
                ) VALUES (
                    ${JSON.stringify({ en: title })}::jsonb,
                    ${JSON.stringify({ en: 'Imported via AI' })}::jsonb,
                    ${duration || 180},
                    ${totalMarks || 0},
                    ${instructionsJsonb}::jsonb,
                    'draft',
                    ${session.id},
                    NOW(),
                    NOW(),
                    ${sourcePdfUrl || null}
                ) RETURNING id
            `;
            targetExamId = examResult[0].id;

            if (hasMultiSections) {
                // Create multiple sections
                let totalInserted = 0;
                const allErrors: string[] = [];
                let sectionOrder = 1;

                for (const sec of sectionsPayload) {
                    if (!sec.questions || sec.questions.length === 0) continue;

                    const sectionResult = await sql`
                        INSERT INTO sections (exam_id, name, "order")
                        VALUES (${targetExamId}, ${JSON.stringify({ en: sec.name })}::jsonb, ${sectionOrder})
                        RETURNING id
                    `;
                    const newSectionId = sectionResult[0].id;
                    sectionOrder++;

                    const { insertedCount, errors } = await insertQuestionsForSection(newSectionId, sec.questions, sec.paragraphs || []);
                    totalInserted += insertedCount;
                    allErrors.push(...errors);
                }

                console.log(`Multi-section import (new exam): ${totalInserted} questions in ${sectionOrder - 1} sections for exam ${targetExamId}`);
                return NextResponse.json({
                    success: true,
                    examId: targetExamId,
                    questionCount: totalInserted,
                    sectionCount: sectionOrder - 1,
                    errors: allErrors.length > 0 ? allErrors : undefined
                });
            } else {
                // Legacy: single section with exam title as name
                const sectionResult = await sql`
                    INSERT INTO sections (exam_id, name, "order")
                    VALUES (${targetExamId}, ${JSON.stringify({ en: title })}::jsonb, 1)
                    RETURNING id
                `;
                const targetSectionId = sectionResult[0].id;

                const { insertedCount, errors } = await insertQuestionsForSection(targetSectionId, questions, paragraphs || []);

                console.log(`Import complete: ${insertedCount}/${questions.length} questions inserted for exam ${targetExamId}`);
                return NextResponse.json({
                    success: true,
                    examId: targetExamId,
                    questionCount: insertedCount,
                    errors: errors.length > 0 ? errors : undefined
                });
            }
        }

    } catch (error) {
        console.error('Import Exam Error:', error);
        return NextResponse.json({ error: 'Failed to save exam' }, { status: 500 });
    }
}
