import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { questionIds } = body;

        if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }
        // First resolve foreign key constraint by deleting referenced question_responses
        await sql`
            DELETE FROM question_responses
            WHERE question_id = ANY(${questionIds}::uuid[])
        `;

        const deleted = await sql`
            DELETE FROM questions
            WHERE id = ANY(${questionIds}::uuid[])
            RETURNING id
        `;

        return NextResponse.json({
            success: true,
            deletedCount: deleted.length
        });

    } catch (error: any) {
        console.error('Bulk Delete Questions Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
