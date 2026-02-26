import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

interface ImportedQuestion {
    row: number;
    type: string;
    textEn: string;
    textPa: string;
    optionAEn?: string;
    optionAPa?: string;
    optionBEn?: string;
    optionBPa?: string;
    optionCEn?: string;
    optionCPa?: string;
    optionDEn?: string;
    optionDPa?: string;
    correctAnswer: string;
    marks: number;
    negativeMarks: number;
    explanationEn?: string;
    explanationPa?: string;
    parentRow?: number; // For sub-questions linked to paragraphs
    tags?: string[];
}

interface RowError {
    row: number;
    error: string;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: examId, sectionId } = await params;
        const { questions, language } = await request.json() as {
            questions: ImportedQuestion[];
            language: 'both' | 'en' | 'pa'
        };

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
        }

        // Verify section exists and belongs to exam
        const sectionCheck = await sql`
            SELECT id FROM sections WHERE id = ${sectionId} AND exam_id = ${examId}
        `;
        if (sectionCheck.length === 0) {
            return NextResponse.json({ error: 'Section not found' }, { status: 404 });
        }

        // Get current max order
        const maxOrderResult = await sql`
            SELECT COALESCE(MAX("order"), 0) as max_order 
            FROM questions 
            WHERE section_id = ${sectionId}
        `;
        let currentOrder = (maxOrderResult[0]?.max_order || 0) + 1;

        let importedCount = 0;
        const errors: RowError[] = [];

        // Track paragraph IDs by row for linking sub-questions
        const paragraphIdByRow: Record<number, string> = {};

        // First pass: import paragraph questions
        for (const q of questions) {
            if (q.type === 'paragraph' && q.row) {
                try {
                    const questionId = randomUUID();
                    paragraphIdByRow[q.row] = questionId;

                    const paragraphText: Record<string, string> = {};
                    if (language === 'both' || language === 'en') {
                        paragraphText.en = q.textEn || '';
                    }
                    if (language === 'both' || language === 'pa') {
                        paragraphText.pa = q.textPa || '';
                    }

                    // Create paragraph entry
                    const paragraphEntryId = randomUUID();
                    await sql`
                        INSERT INTO paragraphs (id, text, content)
                        VALUES (
                           ${paragraphEntryId},
                           ${JSON.stringify({ en: '', pa: '' })}::jsonb,
                           ${JSON.stringify(paragraphText)}::jsonb
                        )
                    `;

                    await sql`
                        INSERT INTO questions (
                            id, section_id, type, text, paragraph_id, options, correct_answer, 
                            marks, difficulty, negative_marks, "order"
                        ) VALUES (
                            ${questionId},
                            ${sectionId},
                            'paragraph',
                            ${JSON.stringify({ en: '', pa: '' })}::jsonb,
                            ${paragraphEntryId},
                            ${null}::jsonb,
                            ${JSON.stringify([])}::jsonb,
                            ${0},
                            ${1},
                            ${0},
                            ${currentOrder}
                        )
                    `;

                    // Also create junction entry
                    await sql`
                        INSERT INTO section_questions (section_id, question_id, marks, negative_marks, "order")
                        VALUES (${sectionId}, ${questionId}, ${0}, ${0}, ${currentOrder})
                    `;

                    // Handle Tags for Paragraph
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

                    currentOrder++;
                    importedCount++;
                } catch (error: any) {
                    errors.push({ row: q.row, error: error.message || 'Failed to import paragraph' });
                }
            }
        }

        // Second pass: import regular questions and sub-questions
        for (const q of questions) {
            if (q.type === 'paragraph') continue; // Already processed
            try {
                const questionId = randomUUID();

                // Build text based on language selection
                const text: Record<string, string> = {};
                if (language === 'both' || language === 'en') {
                    text.en = q.textEn || '';
                }
                if (language === 'both' || language === 'pa') {
                    text.pa = q.textPa || '';
                }

                // Build options for MCQ questions
                let options = null;
                let correctAnswer: string[] = [];

                if (q.type === 'mcq_single' || q.type === 'mcq_multiple') {
                    options = [];

                    // Option A
                    if (q.optionAEn || q.optionAPa) {
                        const optText: Record<string, string> = {};
                        if (language === 'both' || language === 'en') optText.en = q.optionAEn || '';
                        if (language === 'both' || language === 'pa') optText.pa = q.optionAPa || '';
                        options.push({ id: 'a', text: optText });
                    }

                    // Option B
                    if (q.optionBEn || q.optionBPa) {
                        const optText: Record<string, string> = {};
                        if (language === 'both' || language === 'en') optText.en = q.optionBEn || '';
                        if (language === 'both' || language === 'pa') optText.pa = q.optionBPa || '';
                        options.push({ id: 'b', text: optText });
                    }

                    // Option C
                    if (q.optionCEn || q.optionCPa) {
                        const optText: Record<string, string> = {};
                        if (language === 'both' || language === 'en') optText.en = q.optionCEn || '';
                        if (language === 'both' || language === 'pa') optText.pa = q.optionCPa || '';
                        options.push({ id: 'c', text: optText });
                    }

                    // Option D
                    if (q.optionDEn || q.optionDPa) {
                        const optText: Record<string, string> = {};
                        if (language === 'both' || language === 'en') optText.en = q.optionDEn || '';
                        if (language === 'both' || language === 'pa') optText.pa = q.optionDPa || '';
                        options.push({ id: 'd', text: optText });
                    }

                    // Parse correct answer(s)
                    correctAnswer = q.correctAnswer.split(',').map(a => a.trim().toLowerCase());
                } else if (q.type === 'fill_blank') {
                    // For fill_blank, the correct answer is the text itself
                    correctAnswer = [q.correctAnswer];
                }

                // Build explanation
                let explanation = null;
                if (q.explanationEn || q.explanationPa) {
                    explanation = {};
                    if (language === 'both' || language === 'en') {
                        (explanation as Record<string, string>).en = q.explanationEn || '';
                    }
                    if (language === 'both' || language === 'pa') {
                        (explanation as Record<string, string>).pa = q.explanationPa || '';
                    }
                }

                // Insert question - cast JSON strings properly for PostgreSQL
                const textJson = JSON.stringify(text);
                const optionsJson = options ? JSON.stringify(options) : null;
                const correctAnswerJson = JSON.stringify(correctAnswer);
                const explanationJson = explanation ? JSON.stringify(explanation) : null;

                // Determine parent_id if this is a sub-question
                let parentId = null;
                if (q.parentRow) {
                    if (paragraphIdByRow[q.parentRow]) {
                        parentId = paragraphIdByRow[q.parentRow];
                    } else {
                        throw new Error(`Parent paragraph at row ${q.parentRow} not found (or failed to import).`);
                    }
                }

                await sql`
                    INSERT INTO questions (
                        id, section_id, type, text, options, correct_answer, 
                        explanation, marks, difficulty, negative_marks, "order", parent_id
                    ) VALUES (
                        ${questionId},
                        ${sectionId},
                        ${q.type},
                        ${textJson}::jsonb,
                        ${optionsJson}::jsonb,
                        ${correctAnswerJson}::jsonb,
                        ${explanationJson}::jsonb,
                        ${q.marks || 1},
                        ${1},
                        ${q.negativeMarks || 0},
                        ${currentOrder},
                        ${parentId}
                    )
                `;

                // Also create junction entry
                await sql`
                    INSERT INTO section_questions (section_id, question_id, marks, negative_marks, "order")
                    VALUES (${sectionId}, ${questionId}, ${q.marks || 1}, ${q.negativeMarks || 0}, ${currentOrder})
                `;

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

                currentOrder++;
                importedCount++;
            } catch (error: any) {
                errors.push({ row: q.row, error: error.message || 'Failed to import question' });
            }
        }

        return NextResponse.json({
            success: true,
            imported: importedCount,
            total: questions.length,
            errors
        });
    } catch (error: any) {
        console.error('Error in bulk import:', {
            error: error?.message || error,
            stack: error?.stack
        });
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
