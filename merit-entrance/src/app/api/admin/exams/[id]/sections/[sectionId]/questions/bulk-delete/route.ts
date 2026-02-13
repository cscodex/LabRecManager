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

        console.log(`Bulk delinking ${questionIds.length} questions from section ${sectionId}`);

        // 1. Expand IDs to include children (if we are delinking a parent/paragraph, delink children too)
        const childrenResult = await sql`
            SELECT id FROM questions 
            WHERE parent_id = ANY(${questionIds}::uuid[])
        `;
        const childIds = childrenResult.map(c => c.id);

        // Combine original IDs and child IDs (deduplicate)
        const allIds = Array.from(new Set([...questionIds, ...childIds]));

        // 2. DELINK: Set section_id to NULL instead of deleting
        // This keeps the questions in the database for future use in the question bank
        const result = await sql`
            UPDATE questions 
            SET section_id = NULL
            WHERE id = ANY(${allIds}::uuid[]) 
            AND section_id = ${sectionId}
            RETURNING id
        `;

        console.log(`Delinked ${result.length} questions (requested: ${questionIds.length}, cascade: ${allIds.length})`);

        return NextResponse.json({
            success: true,
            deleted: result.length,
            requested: questionIds.length,
        });
    } catch (error: any) {
        console.error('Error in bulk delink:', error);
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
