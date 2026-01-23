import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// GET - Get single demo content by ID
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const result = await sql`
      SELECT id, title, content, content_type as "contentType", 
             created_at as "createdAt", updated_at as "updatedAt"
      FROM demo_content
      WHERE id = ${id}::uuid
    `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, item: result[0] });
    } catch (error) {
        console.error('Error fetching demo content:', error);
        return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
    }
}

// PUT - Update demo content
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const { title, content, contentType } = await request.json();

        if (!title || !content) {
            return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
        }

        const result = await sql`
      UPDATE demo_content
      SET title = ${title}, 
          content = ${content}, 
          content_type = ${contentType || 'general'},
          updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING id, title, content, content_type as "contentType", 
                created_at as "createdAt", updated_at as "updatedAt"
    `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, item: result[0] });
    } catch (error) {
        console.error('Error updating demo content:', error);
        return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
    }
}

// DELETE - Delete demo content
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const result = await sql`
      DELETE FROM demo_content
      WHERE id = ${id}::uuid
      RETURNING id
    `;

        if (result.length === 0) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, deleted: id });
    } catch (error) {
        console.error('Error deleting demo content:', error);
        return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
    }
}
