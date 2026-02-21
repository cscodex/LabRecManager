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
        const { mode, questions, instructions, paragraphs } = body;

        if (!questions || !Array.isArray(questions)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        let targetExamId;
        let targetSectionId;

        if (mode === 'existing') {
            const { examId, sectionId } = body;
            if (!examId || !sectionId) {
                return NextResponse.json({ error: 'Missing exam or section ID' }, { status: 400 });
            }
            targetExamId = examId;
            targetSectionId = sectionId;

            // Append instructions to existing exam if provided
            if (instructions && Array.isArray(instructions) && instructions.length > 0) {
                const instructionsHtml = instructions.map((inst: string) => `<li>${inst}</li>`).join('');
                const instructionsContent = `<ul>${instructionsHtml}</ul>`;
                // Append to existing instructions
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
        } else {
            // Default to 'new'
            const { title, duration, totalMarks } = body;
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

            // 1. Create Exam
            const examResult = await sql`
                INSERT INTO exams (
                    title, 
                    description, 
                    duration, 
                    total_marks, 
                    instructions,
                    status, 
                    created_by,
                    created_at,
                    updated_at
                ) VALUES (
                    ${JSON.stringify({ en: title })}::jsonb,
                    ${JSON.stringify({ en: 'Imported via AI' })}::jsonb,
                    ${duration || 180},
                    ${totalMarks || 0},
                    ${instructionsJsonb}::jsonb,
                    'draft',
                    ${session.id},
                    NOW(),
                    NOW()
                ) RETURNING id
            `;
            targetExamId = examResult[0].id;

            // 2. Create Default Section (Name same as Exam Title)
            const sectionResult = await sql`
                INSERT INTO sections (
                    exam_id,
                    name,
                    "order"
                ) VALUES (
                    ${targetExamId},
                    ${JSON.stringify({ en: title })}::jsonb,
                    1
                ) RETURNING id
            `;
            targetSectionId = sectionResult[0].id;
        }

        // 2.5. Insert Paragraphs and build ID mapping (AI id -> DB UUID)
        const paragraphIdMap: Record<string, string> = {};
        if (paragraphs && Array.isArray(paragraphs) && paragraphs.length > 0) {
            for (const p of paragraphs) {
                try {
                    const pResult = await sql`
                        INSERT INTO paragraphs (text, content)
                        VALUES (
                            ${JSON.stringify({ en: p.title || 'Untitled Passage' })}::jsonb,
                            ${JSON.stringify({ en: p.content || '' })}::jsonb
                        ) RETURNING id
                    `;
                    paragraphIdMap[p.id] = pResult[0].id;
                    console.log(`Inserted paragraph '${p.id}' -> DB UUID '${pResult[0].id}'`);
                } catch (pError: any) {
                    console.error(`Failed to insert paragraph ${p.id}:`, pError.message);
                }
            }
        }

        // 3. Insert Questions
        let insertedCount = 0;
        const errors: string[] = [];

        for (let idx = 0; idx < questions.length; idx++) {
            const q = questions[idx];
            try {
                // Determine type
                let type = q.type || 'mcq_single';
                if (type === 'mcq') type = 'mcq_single';

                // Format options
                const formattedOptions = (q.options || []).map((opt: string, optIdx: number) => ({
                    id: String.fromCharCode(65 + optIdx),
                    text: { en: opt }
                }));

                // --- Answer Storage Logic ---
                // MCQ: correct_answer = ["A"] (letter of correct option)
                // fill_blank: correct_answer = ["exact answer"] (for strict comparison)
                // short_answer / long_answer: correct_answer = [] (empty), model_answer = JSONB with answer text (for AI grading)
                let correctAnswerValue: string[] = [];
                let modelAnswerValue: string | null = null;

                if (type === 'mcq_single') {
                    // MCQ: store the letter
                    if (q.correctAnswer && /^[A-Z]$/.test(q.correctAnswer)) {
                        correctAnswerValue = [q.correctAnswer];
                    }
                } else if (type === 'fill_blank') {
                    // Fill blank: store exact text for strict comparison
                    if (q.correctAnswer) {
                        correctAnswerValue = [q.correctAnswer];
                    }
                } else {
                    // short_answer / long_answer: store model answer separately for AI grading
                    if (q.correctAnswer) {
                        modelAnswerValue = q.correctAnswer;
                    }
                    // correct_answer stays empty []
                }

                // Resolve paragraph_id from AI paragraph ID to DB UUID
                const dbParagraphId = q.paragraphId ? (paragraphIdMap[q.paragraphId] || null) : null;

                const questionResult = await sql`
                    INSERT INTO questions (
                        section_id,
                        text,
                        type,
                        options,
                        correct_answer,
                        model_answer,
                        marks,
                        explanation,
                        difficulty,
                        paragraph_id,
                        "order"
                    ) VALUES (
                        ${targetSectionId},
                        ${JSON.stringify({ en: q.text })}::jsonb,
                        ${type},
                        ${JSON.stringify(formattedOptions)}::jsonb,
                        ${JSON.stringify(correctAnswerValue)}::jsonb,
                        ${modelAnswerValue ? JSON.stringify({ en: modelAnswerValue }) : null}::jsonb,
                        ${parseFloat(q.marks) || 1},
                        ${JSON.stringify({ en: q.explanation || '' })}::jsonb,
                        ${Math.round(Number(q.difficulty) || 1)},
                        ${dbParagraphId},
                        ${idx + 1}
                    ) RETURNING id
                `;
                const questionId = questionResult[0].id;

                // 4. Insert Tags
                if (q.tags && Array.isArray(q.tags) && q.tags.length > 0) {
                    for (const tagName of q.tags) {
                        const cleanedTag = tagName.trim();
                        if (!cleanedTag) continue;

                        // a. Upsert Tag
                        await sql`
                            INSERT INTO tags (name) VALUES (${cleanedTag}) 
                            ON CONFLICT (name) DO NOTHING
                        `;

                        // b. Get Tag ID
                        const tagRes = await sql`SELECT id FROM tags WHERE name = ${cleanedTag}`;

                        if (tagRes && tagRes.length > 0) {
                            const tagId = tagRes[0].id;
                            // c. Link Question to Tag
                            await sql`
                                INSERT INTO question_tags (question_id, tag_id)
                                VALUES (${questionId}, ${tagId})
                                ON CONFLICT DO NOTHING
                            `;
                        }
                    }
                }

                insertedCount++;
            } catch (qError: any) {
                console.error(`Failed to insert question ${idx + 1}:`, qError.message);
                errors.push(`Q${idx + 1}: ${qError.message}`);
            }
        }

        console.log(`Import complete: ${insertedCount}/${questions.length} questions inserted for exam ${targetExamId}`);

        return NextResponse.json({
            success: true,
            examId: targetExamId,
            questionCount: insertedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Import Exam Error:', error);
        return NextResponse.json({ error: 'Failed to save exam' }, { status: 500 });
    }
}
