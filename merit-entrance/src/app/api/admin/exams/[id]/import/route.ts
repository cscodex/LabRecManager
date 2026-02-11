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
        const { questions, language } = body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
        }

        // 1. Fetch all sections for validation
        const sections = await sql`
            SELECT id, name, "order" 
            FROM sections 
            WHERE exam_id = ${id}
        `;

        const sectionMap = new Map(sections.map(s => [s.id, s]));

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
            let currentOrder = lastQuestion.length > 0 ? lastQuestion[0].order : 0;

            // Map row number to created question ID
            const rowToIdMap = new Map<number, string>();

            // Sort by row
            sectionQuestions.sort((a, b) => a.row - b.row);

            for (const q of sectionQuestions) {
                try {
                    currentOrder++;

                    // Parent ID logic
                    let parentId: string | null = null;
                    if (q.parentRow) {
                        if (rowToIdMap.has(q.parentRow)) {
                            parentId = rowToIdMap.get(q.parentRow)!;
                        } else {
                            throw new Error(`Parent question at row ${q.parentRow} not found (or failed to import).`);
                        }
                    }

                    // JSON fields
                    const textJson = JSON.stringify({
                        en: (language === 'both' || language === 'en') ? q.textEn : '',
                        pa: (language === 'both' || language === 'pa') ? q.textPa : ''
                    });

                    const explanationJson = (q.explanationEn || q.explanationPa) ? JSON.stringify({
                        en: (language === 'both' || language === 'en') ? q.explanationEn : '',
                        pa: (language === 'both' || language === 'pa') ? q.explanationPa : ''
                    }) : null;

                    // Handle Paragraph Creation
                    let paragraphId: string | null = null;
                    if (q.type === 'paragraph') {
                        const paragraphContent = JSON.stringify({
                            en: (language === 'both' || language === 'en') ? q.textEn : '',
                            pa: (language === 'both' || language === 'pa') ? q.textPa : ''
                        });

                        const [pEntry] = await sql`
                            INSERT INTO paragraphs (text, content)
                            VALUES (
                                ${textJson}::jsonb,
                                ${paragraphContent}::jsonb
                            ) RETURNING id
                        `;
                        paragraphId = pEntry.id;
                    }

                    // Handle Options (Construct JSON)
                    let optionsJson = null;
                    if (['mcq_single', 'mcq_multiple'].includes(q.type)) {
                        const options = [
                            { id: 'a', text: { en: q.optionAEn || '', pa: q.optionAPa || '' } },
                            { id: 'b', text: { en: q.optionBEn || '', pa: q.optionBPa || '' } },
                            { id: 'c', text: { en: q.optionCEn || '', pa: q.optionCPa || '' } },
                            { id: 'd', text: { en: q.optionDEn || '', pa: q.optionDPa || '' } },
                        ].filter(o => o.text.en || o.text.pa);

                        if (options.length > 0) {
                            optionsJson = JSON.stringify(options);
                        }
                    }

                    // Insert Question
                    const [insertedQuestion] = await sql`
                        INSERT INTO questions (
                            section_id, type, text, marks, negative_marks, "order", explanation, parent_id, paragraph_id, correct_answer, options
                        ) VALUES (
                            ${sectionId},
                            ${q.type},
                            ${textJson}::jsonb,
                            ${q.marks},
                            ${q.negativeMarks},
                            ${currentOrder},
                            ${explanationJson}::jsonb,
                            ${parentId},
                            ${paragraphId},
                            ${q.correctAnswer ? JSON.stringify([q.correctAnswer]) : '[]'}::jsonb,
                            ${optionsJson}::jsonb
                        )
                        RETURNING id
                    `;

                    const questionId = insertedQuestion.id;
                    rowToIdMap.set(q.row, questionId);

                    // Handle Tags
                    if (q.tags && Array.isArray(q.tags) && q.tags.length > 0) {
                        for (const tagName of q.tags) {
                            if (!tagName) continue;
                            const cleanTagName = tagName.trim();

                            // Find or create tag
                            // Note: We could optimize this by caching tags, but for import safely 1-by-1 is okay or valid
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

                    importedCount++;
                } catch (err: any) {
                    errors.push({ row: q.row, error: err.message });
                }
            }
        }

        return NextResponse.json({ success: true, imported: importedCount, errors });
    } catch (error: any) {
        console.error('Master Import error details:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error',
            details: error.toString()
        }, { status: 500 });
    }
}
