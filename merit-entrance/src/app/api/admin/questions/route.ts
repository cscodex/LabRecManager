
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

        const offset = (page - 1) * limit;

        let whereConditions = ['parent_id IS NULL']; // Filter by parent_id IS NULL directly on table, alias q used later

        const params: any[] = [];
        let paramIndex = 1;

        if (search) {
            whereConditions.push(`(text->>'en' ILIKE $${paramIndex} OR text->>'pa' ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (type && type !== 'all') {
            whereConditions.push(`type = $${paramIndex}`);
            params.push(type);
            paramIndex++;
        }

        if (difficulty && difficulty !== 'all') {
            whereConditions.push(`difficulty = $${paramIndex}`);
            params.push(parseInt(difficulty));
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Count query
        const countQueryParts = [`SELECT COUNT(*) as total FROM questions`];
        if (whereClause) countQueryParts.push(whereClause);

        const countQuery = countQueryParts.join(' ');
        const totalResult = await sql(countQuery, params);
        const total = parseInt(totalResult[0].total);

        // Fetch Query
        // We use alias q here, so we need to adjust where clause if we used it in count. 
        // But count used no alias.
        // Let's consistently use alias q in main query and adjust where clause for it.

        const whereClauseWithAlias = whereConditions.length > 0 ? `WHERE ${whereConditions.map(c => c.replace(/parent_id/g, 'q.parent_id').replace(/^text/, 'q.text').replace(/^type/, 'q.type').replace(/^difficulty/, 'q.difficulty')).join(' AND ')}` : '';

        const queryParts = [`
            SELECT 
                q.*, 
                s.name as section_name,
                e.title as exam_title,
                (
                    SELECT json_agg(json_build_object('id', t.id, 'name', t.name))
                    FROM question_tags qt
                    JOIN tags t ON qt.tag_id = t.id
                    WHERE qt.question_id = q.id
                ) as tags
            FROM questions q
            LEFT JOIN sections s ON q.section_id = s.id
            LEFT JOIN exams e ON s.exam_id = e.id
        `];

        if (whereClauseWithAlias) queryParts.push(whereClauseWithAlias);

        queryParts.push(`ORDER BY q.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`);
        params.push(limit, offset);

        const questions = await sql(queryParts.join(' '), params);

        return NextResponse.json({
            success: true,
            questions: questions.map(q => ({
                ...q,
                section: q.section_id ? {
                    name: q.section_name,
                    exam: { title: q.exam_title }
                } : null,
                tags: q.tags || []
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error: any) {
        console.error('Error fetching questions:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch questions' }, { status: 500 });
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

        const insertQuery = `
            INSERT INTO questions (
                type, text, options, correct_answer, explanation, 
                marks, negative_marks, difficulty, image_url, "order", paragraph_text, parent_id
            ) VALUES (
                $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, 
                $6, $7, $8, $9, $10, $11::jsonb, $12
            ) RETURNING id
        `;

        // Handle paragraph text
        let pText = null;
        if (type === 'paragraph' && body.paragraph) {
            pText = body.paragraph.paragraphText;
        } else if (type === 'paragraph' && body.paragraphText) {
            pText = body.paragraphText; // Directly passed
        } else if (type === 'paragraph' && body.paragraph_text) {
            pText = body.paragraph_text;
        }

        const result = await sql(insertQuery, [
            type,
            JSON.stringify(text),
            options ? JSON.stringify(options) : null,
            correct_answer ? (Array.isArray(correct_answer) ? JSON.stringify(correct_answer) : JSON.stringify([correct_answer])) : '[]',
            explanation ? JSON.stringify(explanation) : null,
            marks,
            negative_marks || 0,
            difficulty || 1,
            image_url || null,
            order || 0,
            pText ? JSON.stringify(pText) : null,
            null // parent_id is null for top level
        ]);

        const questionId = result[0].id;

        // Insert Tags
        if (tags && tags.length > 0) {
            for (const tagId of tags) {
                await sql('INSERT INTO question_tags (question_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [questionId, tagId]);
            }
        }

        // Handle Sub-Questions if Paragraph
        const subQuestions = body.subQuestions || (body.paragraph ? body.subQuestions : []);

        if (type === 'paragraph' && subQuestions && Array.isArray(subQuestions)) {
            let subOrder = 1;
            for (const sq of subQuestions) {
                // Ensure options format
                const sqText = sq.text || sq.textEn; // Fallback mapping
                // Assuming QuestionEditor sends `text: {en...}` correctly or `textEn` if not mapped.
                // QuestionEditor onSave mapped it to `text: {en...}` but subQuestions array has `textEn` usage in `new/page.tsx` batch logic?
                // `new/page.tsx` does a mapping for batch endpoint.
                // But for this unified endpoint, `QuestionEditor` calls with body structure.
                // `new/page.tsx` `handleSave` creates `body` and calls POST.

                // We should ensure `new/page.tsx` sends `subQuestions` with correct structure:
                /*
                    subQuestions: [{
                        type: ...,
                        text: { en: ... },
                        options: [ ... ],
                        correctAnswer: [...],
                        ...
                    }]
                */

                // `new/page.tsx` does NOT map `subQuestions` for the standard POST currently. 
                // I need to update `new/page.tsx` to map `subQuestions` correctly in `body` for `type === 'paragraph'`.

                await sql(`
                    INSERT INTO questions (
                        type, text, options, correct_answer, explanation, 
                        marks, negative_marks, difficulty, "order", parent_id, image_url
                    ) VALUES (
                        $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, 
                        $6, $7, $8, $9, $10, $11
                    )
                `, [
                    sq.type,
                    JSON.stringify(sq.text),
                    JSON.stringify(sq.options),
                    JSON.stringify(sq.correctAnswer || []),
                    sq.explanation ? JSON.stringify(sq.explanation) : null,
                    sq.marks,
                    sq.negativeMarks,
                    sq.difficulty,
                    subOrder++,
                    questionId,
                    sq.imageUrl || null
                ]);
            }
        }

        return NextResponse.json({ success: true, question: { id: questionId, ...body } });

    } catch (error: any) {
        console.error('Error creating question:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to create question' }, { status: 500 });
    }
}
