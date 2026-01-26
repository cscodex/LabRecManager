import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

interface ImportedQuestion {
    row?: number;
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

                    // We need the ID to allow re-use if we wanted, but here we just create one entry per paragraph question.
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
                            marks, negative_marks, "order"
                        ) VALUES (
                            ${questionId},
                            ${sectionId},
                            'paragraph',
                            ${JSON.stringify({ en: '', pa: '' })}::jsonb,
                            ${paragraphEntryId},
                            ${null}::jsonb,
                            ${JSON.stringify([])}::jsonb,
                            ${0},
                            ${0},
                            ${currentOrder}
                        )
                    `;
                    currentOrder++;
                    importedCount++;
                } catch (error: any) {
                    console.error('Error importing paragraph:', error?.message);
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
                const parentId = q.parentRow ? paragraphIdByRow[q.parentRow] || null : null;

                console.log('Inserting question:', {
                    questionId,
                    sectionId,
                    type: q.type,
                    marks: q.marks,
                    parentId,
                    parentRow: q.parentRow
                });

                await sql`
                    INSERT INTO questions (
                        id, section_id, type, text, options, correct_answer, 
                        explanation, marks, negative_marks, "order", parent_id
                    ) VALUES (
                        ${questionId},
                        ${sectionId},
                        ${q.type},
                        ${textJson}::jsonb,
                        ${optionsJson}::jsonb,
                        ${correctAnswerJson}::jsonb,
                        ${explanationJson}::jsonb,
                        ${q.marks || 4},
                        ${q.negativeMarks || 0},
                        ${currentOrder},
                        ${parentId}
                    )
                `;

                currentOrder++;
                importedCount++;
            } catch (error: any) {
                console.error('Error importing question row:', {
                    error: error?.message || error,
                    stack: error?.stack,
                    questionData: {
                        type: q.type,
                        textEn: q.textEn?.substring(0, 50),
                        marks: q.marks
                    }
                });
                // Continue with next question
            }
        }

        console.log(`Import complete: ${importedCount}/${questions.length} questions imported`);

        return NextResponse.json({
            success: true,
            imported: importedCount,
            total: questions.length,
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
