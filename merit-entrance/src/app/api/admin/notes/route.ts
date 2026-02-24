import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const search = url.searchParams.get('search') || '';
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const offset = (page - 1) * limit;

        let notes;
        let countResult;

        if (search) {
            const searchPattern = `%${search}%`;
            notes = await sql`
                SELECT n.*, a.name as author_name 
                FROM admin_notes n
                JOIN admins a ON n.author_id = a.id
                WHERE n.title ILIKE ${searchPattern} OR n.content::text ILIKE ${searchPattern}
                ORDER BY n.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await sql`
                SELECT COUNT(*) 
                FROM admin_notes n
                WHERE n.title ILIKE ${searchPattern} OR n.content::text ILIKE ${searchPattern}
            `;
        } else {
            notes = await sql`
                SELECT n.*, a.name as author_name 
                FROM admin_notes n
                JOIN admins a ON n.author_id = a.id
                ORDER BY n.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
            countResult = await sql`SELECT COUNT(*) FROM admin_notes`;
        }

        const total = parseInt(countResult[0].count);

        return NextResponse.json({
            success: true,
            notes,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error: any) {
        console.error('Fetch Notes Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { title, content } = body;

        if (!title || !content) {
            return NextResponse.json({ error: 'Title and Content are required' }, { status: 400 });
        }

        // Store content as JSON directly
        // Make sure its a valid object or stringified properly
        const [newNote] = await sql`
            INSERT INTO admin_notes (title, content, author_id, updated_at)
            VALUES (${title}, ${JSON.stringify(content)}::jsonb, ${session.id}, NOW())
            RETURNING *
        `;

        return NextResponse.json({
            success: true,
            note: newNote
        });

    } catch (error: any) {
        console.error('Create Note Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
