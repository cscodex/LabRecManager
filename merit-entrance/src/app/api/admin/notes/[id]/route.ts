import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { title, content } = body;

        if (!title || !content) {
            return NextResponse.json({ error: 'Title and Content are required' }, { status: 400 });
        }

        const [updatedNote] = await sql`
            UPDATE admin_notes
            SET title = ${title}, content = ${JSON.stringify(content)}::jsonb, updated_at = NOW()
            WHERE id = ${id}
            RETURNING *
        `;

        if (!updatedNote) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, note: updatedNote });

    } catch (error: any) {
        console.error('Update Note Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const deleted = await sql`
            DELETE FROM admin_notes
            WHERE id = ${id}
            RETURNING id
        `;

        if (deleted.length === 0) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, deletedId: id });

    } catch (error: any) {
        console.error('Delete Note Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
