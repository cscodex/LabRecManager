
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const type = searchParams.get('type') || 'all';
        const difficulty = searchParams.get('difficulty') || 'all';
        const tagId = searchParams.get('tagId') || '';
        const usageCountParam = searchParams.get('usageCount') || 'all';

        const offset = (page - 1) * limit;

        const searchPattern = `%${search}%`;
        const diffValue = difficulty === 'all' ? 0 : parseInt(difficulty);
        const usageValue = usageCountParam === 'all' ? -1 : parseInt(usageCountParam);
        const dateFrom = searchParams.get('dateFrom') || '';
        const dateTo = searchParams.get('dateTo') || '';

        let dateFilterSql = sql``;
        if (dateFrom && dateTo) {
            dateFilterSql = sql`AND q.created_at >= ${dateFrom}::timestamp AND q.created_at <= ${dateTo}::timestamp + interval '1 day' - interval '1 second'`;
        } else if (dateFrom) {
            dateFilterSql = sql`AND q.created_at >= ${dateFrom}::timestamp`;
        } else if (dateTo) {
            dateFilterSql = sql`AND q.created_at <= ${dateTo}::timestamp + interval '1 day' - interval '1 second'`;
        }

        // Count query
        let total = 0;

        if (tagId) {
            const totalResult = await sql`
                SELECT COUNT(DISTINCT q.id) as total FROM questions q
                JOIN question_tags qt_filter ON qt_filter.question_id = q.id AND qt_filter.tag_id = ${tagId}
                WHERE 
                    q.parent_id IS NULL
                    AND (${search} = '' OR (q.text->>'en' ILIKE ${searchPattern} OR q.text->>'pa' ILIKE ${searchPattern}))
                    AND (${type} = 'all' OR q.type = ${type})
                    AND (${difficulty} = 'all' OR q.difficulty = ${diffValue})
                    ${usageValue >= 0 ? sql`AND (
                        SELECT COUNT(DISTINCT e2.id)
                        FROM section_questions sq2
                        JOIN sections s2 ON sq2.section_id = s2.id
                        JOIN exams e2 ON s2.exam_id = e2.id
                        WHERE sq2.question_id = q.id
                    ) = ${usageValue}` : sql``}
            `;
            total = parseInt(totalResult[0].total);
        } else {
            const totalResult = await sql`
                SELECT COUNT(*) as total FROM questions q
                WHERE 
                    q.parent_id IS NULL
                    AND (${search} = '' OR (q.text->>'en' ILIKE ${searchPattern} OR q.text->>'pa' ILIKE ${searchPattern}))
                    AND (${type} = 'all' OR q.type = ${type})
                    AND (${difficulty} = 'all' OR q.difficulty = ${diffValue})
                    ${usageValue >= 0 ? sql`AND (
                        SELECT COUNT(DISTINCT e2.id)
                        FROM section_questions sq2
                        JOIN sections s2 ON sq2.section_id = s2.id
                        JOIN exams e2 ON s2.exam_id = e2.id
                        WHERE sq2.question_id = q.id
                    ) = ${usageValue}` : sql``}
            `;
            total = parseInt(totalResult[0].total);
        }

        // Fetch Query
        let questions;
        if (tagId) {
            questions = await sql`
                SELECT 
                    q.*, 
                    p.content as paragraph_text,
                    s.name as section_name,
                    e.title as exam_title,
                    (
                        SELECT json_agg(json_build_object('id', t.id, 'name', t.name))
                        FROM question_tags qt
                        JOIN tags t ON qt.tag_id = t.id
                        WHERE qt.question_id = q.id
                    ) as tags,
                    (
                        SELECT COUNT(DISTINCT e2.id)
                        FROM section_questions sq2
                        JOIN sections s2 ON sq2.section_id = s2.id
                        JOIN exams e2 ON s2.exam_id = e2.id
                        WHERE sq2.question_id = q.id
                    ) as usage_count
                FROM questions q
                LEFT JOIN paragraphs p ON q.paragraph_id = p.id
                LEFT JOIN sections s ON q.section_id = s.id
                LEFT JOIN exams e ON s.exam_id = e.id
                JOIN question_tags qt_filter ON qt_filter.question_id = q.id AND qt_filter.tag_id = ${tagId}
                WHERE 
                    q.parent_id IS NULL
                    AND (${search} = '' OR (q.text->>'en' ILIKE ${searchPattern} OR q.text->>'pa' ILIKE ${searchPattern}))
                    AND (${type} = 'all' OR q.type = ${type})
                    AND (${difficulty} = 'all' OR q.difficulty = ${diffValue})
                    ${usageValue >= 0 ? sql`AND (
                        SELECT COUNT(DISTINCT e2.id)
                        FROM section_questions sq2
                        JOIN sections s2 ON sq2.section_id = s2.id
                        JOIN exams e2 ON s2.exam_id = e2.id
                        WHERE sq2.question_id = q.id
                    ) = ${usageValue}` : sql``}
                    ${dateFilterSql}
                ORDER BY q.id DESC 
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else {
            questions = await sql`
                SELECT 
                    q.*, 
                    p.content as paragraph_text,
                    s.name as section_name,
                    e.title as exam_title,
                    (
                        SELECT json_agg(json_build_object('id', t.id, 'name', t.name))
                        FROM question_tags qt
                        JOIN tags t ON qt.tag_id = t.id
                        WHERE qt.question_id = q.id
                    ) as tags,
                    (
                        SELECT COUNT(DISTINCT e2.id)
                        FROM section_questions sq2
                        JOIN sections s2 ON sq2.section_id = s2.id
                        JOIN exams e2 ON s2.exam_id = e2.id
                        WHERE sq2.question_id = q.id
                    ) as usage_count
                FROM questions q
                LEFT JOIN paragraphs p ON q.paragraph_id = p.id
                LEFT JOIN sections s ON q.section_id = s.id
                LEFT JOIN exams e ON s.exam_id = e.id
                WHERE 
                    q.parent_id IS NULL
                    AND (${search} = '' OR (q.text->>'en' ILIKE ${searchPattern} OR q.text->>'pa' ILIKE ${searchPattern}))
                    AND (${type} = 'all' OR q.type = ${type})
                    AND (${difficulty} = 'all' OR q.difficulty = ${diffValue})
                    ${usageValue >= 0 ? sql`AND (
                        SELECT COUNT(DISTINCT e2.id)
                        FROM section_questions sq2
                        JOIN sections s2 ON sq2.section_id = s2.id
                        JOIN exams e2 ON s2.exam_id = e2.id
                        WHERE sq2.question_id = q.id
                    ) = ${usageValue}` : sql``}
                    ${dateFilterSql}
                ORDER BY q.id DESC 
                LIMIT ${limit} OFFSET ${offset}
            `;
        }

        // Global stats (not affected by pagination)
        const statsResult = await sql`
            SELECT 
                COUNT(*) as total_questions,
                COUNT(CASE WHEN q.correct_answer IS NOT NULL AND q.correct_answer::text != '[]' AND q.correct_answer::text != 'null' THEN 1 END) as with_answers,
                COUNT(CASE WHEN q.explanation IS NOT NULL AND q.explanation::text != 'null' AND q.explanation::text != '{}' THEN 1 END) as with_explanations,
                (SELECT COUNT(DISTINCT sq2.section_id) FROM section_questions sq2) as used_in_exams,
                (
                    SELECT MAX(uc.cnt)
                    FROM (
                        SELECT COUNT(DISTINCT e3.id) as cnt
                        FROM section_questions sq3
                        JOIN sections s3 ON sq3.section_id = s3.id
                        JOIN exams e3 ON s3.exam_id = e3.id
                        GROUP BY sq3.question_id
                    ) uc
                ) as max_usage
            FROM questions q
            WHERE q.parent_id IS NULL
        `;

        // Difficulty distribution
        const difficultyResult = await sql`
            SELECT difficulty, COUNT(*) as count 
            FROM questions WHERE parent_id IS NULL 
            GROUP BY difficulty ORDER BY difficulty
        `;
        const difficultyDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        difficultyResult.forEach((r: any) => { difficultyDist[r.difficulty] = parseInt(r.count); });

        // Type distribution
        const typeResult = await sql`
            SELECT type, COUNT(*) as count 
            FROM questions WHERE parent_id IS NULL 
            GROUP BY type
        `;
        const typeDist: Record<string, number> = {};
        typeResult.forEach((r: any) => { typeDist[r.type] = parseInt(r.count); });

        return NextResponse.json({
            success: true,
            questions: questions.map(q => ({
                ...q,
                section: q.section_id ? {
                    name: q.section_name,
                    exam: { title: q.exam_title }
                } : null,
                tags: q.tags || [],
                usage_count: parseInt(q.usage_count) || 0
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            stats: {
                totalQuestions: parseInt(statsResult[0].total_questions) || 0,
                withAnswers: parseInt(statsResult[0].with_answers) || 0,
                withExplanations: parseInt(statsResult[0].with_explanations) || 0,
                usedInExams: parseInt(statsResult[0].used_in_exams) || 0,
                maxUsage: parseInt(statsResult[0].max_usage) || 0,
                difficultyDistribution: difficultyDist,
                typeDistribution: typeDist,
            }
        });

    } catch (error: any) {
        console.error('=== QUESTIONS API ERROR ===');
        console.error('Error message:', error?.message || error);
        console.error('Error stack:', error?.stack);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch questions',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const {
            type,
            text,
            options,
            correct_answer,
            explanation,
            marks,
            negative_marks,
            difficulty,
            tags,
            image_url,
            order
        } = body;

        // Handle paragraph text
        let paragraphId = null;
        if (type === 'paragraph') {
            let pText = body.paragraph?.paragraphText || body.paragraphText || body.paragraph_text || (body.text?.en ? body.text : null);
            // Frontend might send text as title and paragraphText as content
            // As per QuestionEditor: textEn is Title, paragraphTextEn is Content.
            // body.text is Title. pText should be Content.

            // Insert into paragraphs
            const newPara = await sql`
                INSERT INTO paragraphs (text, content) 
                VALUES (${JSON.stringify(text)}::jsonb, ${JSON.stringify(pText)}::jsonb) 
                RETURNING id
            `;
            paragraphId = newPara[0].id;
        }

        const result = await sql`
            INSERT INTO questions (
                type, text, options, correct_answer, explanation, 
                marks, negative_marks, difficulty, image_url, "order", 
                parent_id, paragraph_id
            ) VALUES (
                ${type}, 
                ${JSON.stringify(text)}::jsonb, 
                ${options ? JSON.stringify(options) : null}::jsonb, 
                ${correct_answer ? (Array.isArray(correct_answer) ? JSON.stringify(correct_answer) : JSON.stringify([correct_answer])) : '[]'}::jsonb, 
                ${explanation ? JSON.stringify(explanation) : null}::jsonb, 
                ${marks}, 
                ${negative_marks || 0}, 
                ${difficulty || 1}, 
                ${image_url || null}, 
                ${order || 0}, 
                NULL,
                ${paragraphId}
            ) RETURNING id
        `;

        const questionId = result[0].id;

        // Insert Tags — handles both UUIDs and tag names (from AI extraction)
        if (tags && tags.length > 0) {
            for (const tag of tags) {
                let tagId = tag;
                // Check if it's a UUID or a tag name
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tag);
                if (!isUUID) {
                    // Find or create tag by name
                    const existing = await sql`SELECT id FROM tags WHERE LOWER(name) = LOWER(${tag}) LIMIT 1`;
                    if (existing.length > 0) {
                        tagId = existing[0].id;
                    } else {
                        const newTag = await sql`INSERT INTO tags (name) VALUES (${tag}) RETURNING id`;
                        tagId = newTag[0].id;
                    }
                }
                await sql`INSERT INTO question_tags (question_id, tag_id) VALUES (${questionId}, ${tagId}) ON CONFLICT DO NOTHING`;
            }
        }

        // Handle Sub-Questions if Paragraph
        const subQuestions = body.subQuestions || (body.paragraph ? body.subQuestions : []);

        if (type === 'paragraph' && subQuestions && Array.isArray(subQuestions)) {
            let subOrder = 1;
            for (const sq of subQuestions) {
                await sql`
                    INSERT INTO questions (
                        type, text, options, correct_answer, explanation, 
                        marks, negative_marks, difficulty, "order", parent_id, image_url
                    ) VALUES (
                        ${sq.type}, 
                        ${JSON.stringify(sq.text || sq.textEn)}::jsonb, 
                        ${JSON.stringify(sq.options)}::jsonb, 
                        ${JSON.stringify(sq.correctAnswer || [])}::jsonb, 
                        ${sq.explanation ? JSON.stringify(sq.explanation) : null}::jsonb, 
                        ${sq.marks}, 
                        ${sq.negativeMarks}, 
                        ${sq.difficulty}, 
                        ${subOrder++}, 
                        ${questionId}, 
                        ${sq.imageUrl || null}
                    )
                `;
            }
        }

        return NextResponse.json({ success: true, question: { id: questionId, ...body } });

    } catch (error: any) {
        console.error('Error creating question:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to create question' }, { status: 500 });
    }
}
