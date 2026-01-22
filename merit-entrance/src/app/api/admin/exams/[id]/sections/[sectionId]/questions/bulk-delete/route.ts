import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sectionId } = await params;
        const { questionIds } = await request.json() as { questionIds: string[] };

        if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
            return NextResponse.json({ error: 'No question IDs provided' }, { status: 400 });
        }

        console.log(`Bulk deleting ${questionIds.length} questions from section ${sectionId}`);

        // Delete questions that belong to this section
        const result = await sql`
            DELETE FROM questions 
            WHERE id = ANY(${questionIds}::uuid[]) 
            AND section_id = ${sectionId}
            RETURNING id
        `;

        console.log(`Deleted ${result.length} questions`);

        return NextResponse.json({
            success: true,
            deleted: result.length,
            requested: questionIds.length,
        });
    } catch (error: any) {
        console.error('Error in bulk delete:', error);
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
