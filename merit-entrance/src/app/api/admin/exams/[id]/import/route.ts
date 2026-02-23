import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session || !['admin', 'superadmin'].includes(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await req.json();
        const { questions, language, instructions, paragraphs } = body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
        }

        // 1. Fetch all sections for validation
        const sections = await sql`
            SELECT id, name, "order" 
            FROM sections 
            WHERE exam_id = ${id}
        `;

        // 1.5 Handle Instructions
        if (instructions && Array.isArray(instructions) && instructions.length > 0) {
            const currentExam = await sql`SELECT instructions FROM exams WHERE id = ${id}`;
            let currentInstructions = currentExam[0]?.instructions || {};

            // Allow for string instructions (legacy)
            if (typeof currentInstructions === 'string') {
                try { currentInstructions = JSON.parse(currentInstructions); } catch (e) { currentInstructions = { en: currentInstructions }; }
            }

            const instructionHtml = `<ul>${instructions.map((i: string) => `<li>${i}</li>`).join('')}</ul>`;

            const newEn = (currentInstructions.en || '') + instructionHtml;
            const newPa = (currentInstructions.pa || '') + instructionHtml; // Append to Punjabi too for now as fallback

            await sql`
                UPDATE exams 
                SET instructions = ${JSON.stringify({ ...currentInstructions, en: newEn, pa: newPa })}::jsonb
                WHERE id = ${id}
            `;
        }

        // 1.5 Handle Paragraphs
        const paragraphMap = new Map<string, string>(); // tempId -> realDbId
        const paraDetailsMap = new Map<string, any>();

        if (paragraphs && Array.isArray(paragraphs) && paragraphs.length > 0) {
            for (const p of paragraphs) {
                if (!p.id) continue;
                paraDetailsMap.set(p.id, p);

                // Construct JSON content
                const titleJson = JSON.stringify({
                    en: (language === 'both' || language === 'en') ? (p.title || p.text || 'Untitled Passage') : '',
                    pa: (language === 'both' || language === 'pa') ? (p.title || p.text || 'Untitled Passage') : ''
                });

                const contentJson = JSON.stringify({
                    en: (language === 'both' || language === 'en') ? (p.content || '') : '',
                    pa: (language === 'both' || language === 'pa') ? (p.content || '') : ''
                });

                const [inserted] = await sql`
                    INSERT INTO paragraphs (text, content)
                    VALUES (${titleJson}::jsonb, ${contentJson}::jsonb)
                    RETURNING id
                `;
                paragraphMap.set(p.id, inserted.id);
            }
        }

        const sectionMap = new Map(sections.map((s: any) => [s.id, s]));

        // 2. Process questions
        let importedCount = 0;
        const errors: { row: number, error: string }[] = [];

        // Group questions by section
        const questionsBySection: Record<string, any[]> = {};
        for (const q of questions) {
            if (!sectionMap.has(q.section)) {
                errors.push({ row: q.row, error: `Section ID ${q.section} not found` });
                continue;
            }
            if (!questionsBySection[q.section]) questionsBySection[q.section] = [];
            questionsBySection[q.section].push(q);
        }

        // Map to store created Parent Questions for Paragraphs (tempParaId -> dbQuestionId)
        const parentQuestionMap = new Map<string, string>();

        for (const sectionId of Object.keys(questionsBySection)) {
            const sectionQuestions = questionsBySection[sectionId];

            // Get current max order for this section
            const lastQuestion = await sql`
                SELECT "order" 
                FROM questions 
                WHERE section_id = ${sectionId} 
                ORDER BY "order" DESC 
                LIMIT 1
            `;
            let currentOrder = (lastQuestion[0]?.order || 0) + 1;

            // Sort by row if row numbers are present, otherwise trust array order
            sectionQuestions.sort((a, b) => (a.row || 0) - (b.row || 0));

            for (const q of sectionQuestions) {
                try {
                    let parentId = null;
                    let paragraphId = null;

                    // Check if this question belongs to a paragraph
                    if (q.paragraphId && paragraphMap.has(q.paragraphId)) {
                        const realParaId = paragraphMap.get(q.paragraphId);

                        // Check if we've already created a Parent Question for this paragraph
                        if (parentQuestionMap.has(q.paragraphId)) {
                            parentId = parentQuestionMap.get(q.paragraphId);
                        } else {
                            // Create the Parent Question (Type='paragraph')
                            const pDetails = paraDetailsMap.get(q.paragraphId) || {};

                            const parentTitle = JSON.stringify({
                                en: (language === 'both' || language === 'en') ? (pDetails.title || pDetails.text || 'Passage') : '',
                                pa: (language === 'both' || language === 'pa') ? (pDetails.title || pDetails.text || 'Passage') : ''
                            });

                            const [parentQ] = await sql`
                                INSERT INTO questions (
                                    section_id, type, "order", 
                                    text, marks, difficulty, paragraph_id
                                )
                                VALUES (
                                    ${sectionId}, 'paragraph', ${currentOrder},
                                    ${parentTitle}::jsonb, 0, 1, ${realParaId}
                                )
                                RETURNING id
                            `;

                            parentId = parentQ.id;
                            parentQuestionMap.set(q.paragraphId, parentQ.id);
                            currentOrder++; // Increment for the parent question
                        }
                    } else if (q.type === 'paragraph') {
                        // Legacy handling for direct paragraph type (if passed explicitly)
                        if (q.paragraphId && paragraphMap.has(q.paragraphId)) {
                            // If it already has a paragraph ID from the map, use it
                            paragraphId = paragraphMap.get(q.paragraphId);
                        } else {
                            const pText = JSON.stringify({
                                en: (language === 'both' || language === 'en') ? q.text : '',
                                pa: (language === 'both' || language === 'pa') ? q.text : ''
                            });
                            const [pEntry] = await sql`
                                 INSERT INTO paragraphs (text) VALUES (${pText}::jsonb) RETURNING id
                            `;
                            paragraphId = pEntry.id;
                        }
                    }

                    // Prepare current question data
                    const textJson = JSON.stringify({
                        en: (language === 'both' || language === 'en') ? q.text : '',
                        pa: (language === 'both' || language === 'pa') ? q.text : ''
                    });

                    const explanationJson = q.explanation ? JSON.stringify({
                        en: (language === 'both' || language === 'en') ? q.explanation : '',
                        pa: (language === 'both' || language === 'pa') ? q.explanation : ''
                    }) : null;

                    // Handle Options
                    let optionsJson = '[]';
                    if ((q.type === 'mcq' || !q.type || q.type === 'mcq_multiple') && Array.isArray(q.options)) {
                        const opts = q.options.map((opt: string, idx: number) => ({
                            id: String.fromCharCode(97 + idx),
                            textEn: (language === 'both' || language === 'en') ? opt : '',
                            textPa: (language === 'both' || language === 'pa') ? opt : ''
                        }));
                        optionsJson = JSON.stringify(opts);
                    }

                    // Map internal type 'mcq' to likely 'mcq_single' used by Editor
                    let dbType = q.type || 'mcq_single';
                    if (dbType === 'mcq') dbType = 'mcq_single';

                    // Insert Question
                    const [insertedQuestion] = await sql`
                        INSERT INTO questions (
                            section_id, type, "order", text, 
                            options, correct_answer, explanation, 
                            marks, difficulty, parent_id, paragraph_id
                        )
                        VALUES (
                            ${sectionId}, ${dbType}, ${currentOrder}, ${textJson}::jsonb,
                            ${optionsJson}::jsonb, ${JSON.stringify(q.correctAnswer ? [q.correctAnswer] : [])}::jsonb, ${explanationJson}::jsonb,
                            ${q.marks}, 1, ${parentId}, ${paragraphId}
                        )
                        RETURNING id
                    `;

                    const questionId = insertedQuestion.id;
                    currentOrder++;
                    importedCount++;

                    // Handle Tags
                    if (q.tags && Array.isArray(q.tags) && q.tags.length > 0) {
                        for (const tagName of q.tags) {
                            if (!tagName) continue;
                            const cleanTagName = tagName.trim();

                            // Find or create tag
                            const existingTag = await sql`SELECT id FROM tags WHERE name = ${cleanTagName}`;
                            let tagId;
                            if (existingTag.length > 0) {
                                tagId = existingTag[0].id;
                            } else {
                                const newTag = await sql`INSERT INTO tags (name) VALUES (${cleanTagName}) RETURNING id`;
                                tagId = newTag[0].id;
                            }

                            await sql`
                                 INSERT INTO question_tags (question_id, tag_id)
                                 VALUES (${questionId}, ${tagId})
                                 ON CONFLICT DO NOTHING
                             `;
                        }
                    }

                } catch (err: any) {
                    errors.push({ row: q.row || 0, error: err.message });
                }
            }
        }

        return NextResponse.json({ success: true, imported: importedCount, errors });

    } catch (error: any) {
        console.error('Import Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to import exam.' },
            { status: 500 }
        );
    }
}
