import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// GET - List all demo content
export async function GET() {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const items = await sql`
      SELECT id, title, content, content_type as "contentType", 
             created_at as "createdAt", updated_at as "updatedAt"
      FROM demo_content
      ORDER BY updated_at DESC
    `;

        return NextResponse.json({ success: true, items });
    } catch (error) {
        console.error('Error fetching demo content:', error);
        return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
    }
}

// POST - Create new demo content
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { title, content, contentType } = await request.json();

        if (!title || !content) {
            return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
        }

        const result = await sql`
      INSERT INTO demo_content (title, content, content_type)
      VALUES (${title}, ${content}, ${contentType || 'general'})
      RETURNING id, title, content, content_type as "contentType", 
                created_at as "createdAt", updated_at as "updatedAt"
    `;

        return NextResponse.json({ success: true, item: result[0] });
    } catch (error) {
        console.error('Error creating demo content:', error);
        return NextResponse.json({ error: 'Failed to create content' }, { status: 500 });
    }
}
