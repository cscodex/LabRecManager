
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

        const offset = (page - 1) * limit;

        const searchPattern = `%${search}%`;
        const diffValue = difficulty === 'all' ? 0 : parseInt(difficulty);

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
            `;
            total = parseInt(totalResult[0].total);
        }

        // Fetch Query
        let questions;
        if (tagId) {
            questions = await sql`
                SELECT 
                    q.*, 
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
                        FROM sections s2
                        JOIN exams e2 ON s2.exam_id = e2.id
                        WHERE s2.id = q.section_id
                    ) as usage_count
                FROM questions q
                LEFT JOIN sections s ON q.section_id = s.id
                LEFT JOIN exams e ON s.exam_id = e.id
                JOIN question_tags qt_filter ON qt_filter.question_id = q.id AND qt_filter.tag_id = ${tagId}
                WHERE 
                    q.parent_id IS NULL
                    AND (${search} = '' OR (q.text->>'en' ILIKE ${searchPattern} OR q.text->>'pa' ILIKE ${searchPattern}))
                    AND (${type} = 'all' OR q.type = ${type})
                    AND (${difficulty} = 'all' OR q.difficulty = ${diffValue})
                ORDER BY q.created_at DESC 
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else {
            questions = await sql`
                SELECT 
                    q.*, 
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
                        FROM sections s2
                        JOIN exams e2 ON s2.exam_id = e2.id
                        WHERE s2.id = q.section_id
                    ) as usage_count
                FROM questions q
                LEFT JOIN sections s ON q.section_id = s.id
                LEFT JOIN exams e ON s.exam_id = e.id
                WHERE 
                    q.parent_id IS NULL
                    AND (${search} = '' OR (q.text->>'en' ILIKE ${searchPattern} OR q.text->>'pa' ILIKE ${searchPattern}))
                    AND (${type} = 'all' OR q.type = ${type})
                    AND (${difficulty} = 'all' OR q.difficulty = ${diffValue})
                ORDER BY q.created_at DESC 
                LIMIT ${limit} OFFSET ${offset}
            `;
        }

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
        let pText = null;
        if (type === 'paragraph' && body.paragraph) {
            pText = body.paragraph.paragraphText;
        } else if (type === 'paragraph' && body.paragraphText) {
            pText = body.paragraphText; // Directly passed
        } else if (type === 'paragraph' && body.paragraph_text) {
            pText = body.paragraph_text;
        }

        const result = await sql`
            INSERT INTO questions (
                type, text, options, correct_answer, explanation, 
                marks, negative_marks, difficulty, image_url, "order", paragraph_text, parent_id
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
                ${pText ? JSON.stringify(pText) : null}::jsonb, 
                NULL
            ) RETURNING id
        `;

        const questionId = result[0].id;

        // Insert Tags
        if (tags && tags.length > 0) {
            for (const tagId of tags) {
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
