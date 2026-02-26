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
        const { questionIds, targetSectionId } = await request.json() as { questionIds: string[], targetSectionId: string };

        if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
            return NextResponse.json({ error: 'No question IDs provided' }, { status: 400 });
        }

        if (!targetSectionId) {
            return NextResponse.json({ error: 'No target section ID provided' }, { status: 400 });
        }

        console.log(`Bulk moving ${questionIds.length} questions from section ${sectionId} to ${targetSectionId}`);

        // 1. Expand IDs to include children (if we are moving a parent/paragraph, move children too)
        const childrenResult = await sql`
            SELECT id FROM questions 
            WHERE parent_id = ANY(${questionIds}::uuid[])
        `;
        const childIds = childrenResult.map(c => c.id);

        // Combine original IDs and child IDs (deduplicate)
        const allIds = Array.from(new Set([...questionIds, ...childIds]));

        // 2. Get the current max order in the target section (from section_questions)
        const maxOrderResult = await sql`
            SELECT COALESCE(MAX("order"), 0) as max_order 
            FROM section_questions 
            WHERE section_id = ${targetSectionId}
        `;
        const targetMaxOrder = parseInt(maxOrderResult[0].max_order) || 0;

        // 3. MOVE: Update section_questions junction links
        await sql`
            UPDATE section_questions 
            SET section_id = ${targetSectionId}, "order" = ${targetMaxOrder + 10}
            WHERE question_id = ANY(${allIds}::uuid[]) 
            AND section_id = ${sectionId}
        `;

        // Also update base question section_id for backward compatibility
        const result = await sql`
            UPDATE questions 
            SET 
                section_id = ${targetSectionId},
                "order" = ${targetMaxOrder + 10}
            WHERE id = ANY(${allIds}::uuid[]) 
            AND section_id = ${sectionId}
            RETURNING id
        `;

        console.log(`Moved ${result.length} questions (requested: ${questionIds.length}, cascade: ${allIds.length})`);

        return NextResponse.json({
            success: true,
            moved: result.length,
            requested: questionIds.length,
        });
    } catch (error: any) {
        console.error('Error in bulk move:', error);
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
