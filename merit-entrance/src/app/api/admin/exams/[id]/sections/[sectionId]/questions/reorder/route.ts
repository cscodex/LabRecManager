
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string; sectionId: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { items } = await req.json();

        if (!Array.isArray(items)) {
            return NextResponse.json(
                { error: 'Invalid data format' },
                { status: 400 }
            );
        }

        // Execute updates concurrently (both base question and junction table)
        await Promise.all(
            items.map((item: { id: string; order: number }) =>
                Promise.all([
                    sql`UPDATE questions SET "order" = ${item.order} WHERE id = ${item.id}`,
                    sql`UPDATE section_questions SET "order" = ${item.order} WHERE question_id = ${item.id} AND section_id = ${params.sectionId}`
                ])
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Reorder failed:', error);
        return NextResponse.json(
            { error: 'Failed to reorder questions' },
            { status: 500 }
        );
    }
}
