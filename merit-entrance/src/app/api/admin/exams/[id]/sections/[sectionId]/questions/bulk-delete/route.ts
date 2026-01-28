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

        // 1. Expand IDs to include children (if we are deleting a parent/paragraph, we must delete children)
        // Find all children for the given question IDs
        const childrenResult = await sql`
            SELECT id FROM questions 
            WHERE parent_id = ANY(${questionIds}::uuid[])
        `;

        const childIds = childrenResult.map(c => c.id);

        // Combine original IDs and child IDs (deduplicate)
        const allIds = Array.from(new Set([...questionIds, ...childIds]));

        // 2. Identify paragraphs to clean up
        // Get paragraph_ids from the questions we are about to delete (only if they are paragraph type questions)
        const paragraphsResult = await sql`
            SELECT paragraph_id FROM questions 
            WHERE id = ANY(${allIds}::uuid[]) 
            AND type = 'paragraph' 
            AND paragraph_id IS NOT NULL
        `;
        const paragraphIds = paragraphsResult.map(p => p.paragraph_id);

        // 3. Delete Responses for ALL involved questions
        if (allIds.length > 0) {
            await sql`
                DELETE FROM question_responses 
                WHERE question_id = ANY(${allIds}::uuid[])
            `;
        }

        // 4. Delete Questions
        const result = await sql`
            DELETE FROM questions 
            WHERE id = ANY(${allIds}::uuid[]) 
            AND section_id = ${sectionId}
            RETURNING id
        `;

        // 5. Delete Paragraphs entries
        if (paragraphIds.length > 0) {
            await sql`
                DELETE FROM paragraphs 
                WHERE id = ANY(${paragraphIds}::uuid[])
            `;
        }

        console.log(`Deleted ${result.length} questions (requested: ${questionIds.length}, cascade: ${allIds.length})`);

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
