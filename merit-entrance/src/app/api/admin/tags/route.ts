import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL!);

// GET all tags
export async function GET() {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const tags = await sql`
            SELECT t.id, t.name, t.created_at, COUNT(qt.question_id)::int as question_count
            FROM tags t
            LEFT JOIN question_tags qt ON t.id = qt.tag_id
            GROUP BY t.id, t.name, t.created_at
            ORDER BY t.name ASC
        `;

        return NextResponse.json({ success: true, tags });
    } catch (error) {
        console.error('Error fetching tags:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST create new tag
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name } = await request.json();

        if (!name || name.trim() === '') {
            return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
        }

        const trimmedName = name.trim();

        // Check if tag already exists
        const existing = await sql`
            SELECT id FROM tags WHERE LOWER(name) = LOWER(${trimmedName})
        `;

        if (existing.length > 0) {
            return NextResponse.json({ error: 'Tag already exists' }, { status: 409 });
        }

        const result = await sql`
            INSERT INTO tags (name)
            VALUES (${trimmedName})
            RETURNING id, name, created_at
        `;

        return NextResponse.json({ success: true, tag: result[0] });
    } catch (error) {
        console.error('Error creating tag:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE tag
export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const tagId = searchParams.get('id');

        if (!tagId) {
            return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 });
        }

        // Remove tag from questions first
        await sql`UPDATE questions SET tag_id = NULL WHERE tag_id = ${tagId}`;

        // Delete the tag
        await sql`DELETE FROM tags WHERE id = ${tagId}`;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting tag:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
