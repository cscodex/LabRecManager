import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, sectionId } = await params;

        // Cascading delete will handle questions
        await sql`DELETE FROM sections WHERE id = ${sectionId} AND exam_id = ${id}`;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting section:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, sectionId } = await params;
        const body = await request.json();
        const { name, order, duration } = body;

        console.log('Updating section:', { id, sectionId, name, order, duration });

        await sql`
      UPDATE sections SET
        name = ${JSON.stringify(name)}::jsonb,
        "order" = ${order},
        duration = ${duration || null}
      WHERE id = ${sectionId} AND exam_id = ${id}
    `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating section:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            error: 'Internal server error',
            details: errorMessage
        }, { status: 500 });
    }
}
