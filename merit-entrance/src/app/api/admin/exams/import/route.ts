import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';
// import { logActivity } from '@/lib/logger'; // Assumed

const sql = neon(process.env.MERIT_DATABASE_URL || '');

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session?.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { mode, questions } = body;

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

            // Optional: Update Exam Total Marks?
            // For now, simpler to just add questions. Recalculation might be needed elsewhere.
        } else {
            // Default to 'new'
            const { title, duration, totalMarks } = body;
            if (!title) {
                return NextResponse.json({ error: 'Missing exam title' }, { status: 400 });
            }

            // 1. Create Exam
            const examResult = await sql`
                INSERT INTO exams (
                    title, 
                    description, 
                    duration, 
                    total_marks, 
                    status, 
                    created_by,
                    created_at,
                    updated_at
                ) VALUES (
                    ${JSON.stringify({ en: title })}::jsonb,
                    ${JSON.stringify({ en: 'Imported via AI' })}::jsonb,
                    ${duration || 180},
                    ${totalMarks || 0},
                    'draft',
                    ${session.id},
                    NOW(),
                    NOW()
                ) RETURNING id
            `;
            targetExamId = examResult[0].id;

            // 2. Create Default Section (Title same as Exam Title)
            const sectionResult = await sql`
                INSERT INTO sections (
                    exam_id,
                    title,
                    description,
                    "order",
                    total_marks
                ) VALUES (
                    ${targetExamId},
                    ${JSON.stringify({ en: title })}::jsonb,
                    ${JSON.stringify({ en: 'Imported Questions' })}::jsonb,
                    1,
                    ${totalMarks || 0}
                ) RETURNING id
            `;
            targetSectionId = sectionResult[0].id;
        }

        // 3. Insert Questions
        for (let idx = 0; idx < questions.length; idx++) {
            const q = questions[idx];
            // Determine type
            let type = q.type || 'mcq_single';
            if (type === 'mcq') type = 'mcq_single';

            // Helper function to format options
            const formattedOptions = q.options.map((opt: string, optIdx: number) => ({
                id: String.fromCharCode(65 + optIdx), // A, B, C...
                text: { en: opt }
            }));

            const questionResult = await sql`
                INSERT INTO questions (
                    section_id,
                    text,
                    type,
                    options,
                    correct_answer,
                    marks,
                    explanation,
                    "order"
                ) VALUES (
                    ${targetSectionId},
                    ${JSON.stringify({ en: q.text })}::jsonb,
                    ${type},
                    ${JSON.stringify(formattedOptions)}::jsonb,
                    ${JSON.stringify(q.correctAnswer)}::jsonb, 
                    ${q.marks},
                    ${JSON.stringify({ en: q.explanation || '' })}::jsonb,
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
        }

        return NextResponse.json({ success: true, examId: targetExamId });

    } catch (error) {
        console.error('Import Exam Error:', error);
        return NextResponse.json({ error: 'Failed to save exam' }, { status: 500 });
    }
}
