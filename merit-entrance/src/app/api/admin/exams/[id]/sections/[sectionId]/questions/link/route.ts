import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

/**
 * POST: Link existing bank questions to this section via section_questions junction.
 * Body: { questionIds: string[], marks?: number, negativeMarks?: number }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sectionId } = await params;
        const { questionIds, marks, negativeMarks } = await request.json();

        if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
            return NextResponse.json({ error: 'No question IDs provided' }, { status: 400 });
        }

        // Get current max order in section
        const maxOrderResult = await sql`
            SELECT COALESCE(MAX("order"), 0) as max_order 
            FROM section_questions 
            WHERE section_id = ${sectionId}
        `;
        let currentOrder = (parseInt(maxOrderResult[0].max_order) || 0) + 1;

        let linked = 0;
        let skipped = 0;

        for (const qId of questionIds) {
            // Check if already linked
            const existing = await sql`
                SELECT id FROM section_questions 
                WHERE section_id = ${sectionId} AND question_id = ${qId}
            `;

            if (existing.length > 0) {
                skipped++;
                continue;
            }

            // Get question's default marks if not specified
            let qMarks = marks;
            let qNegMarks = negativeMarks;
            if (qMarks === undefined) {
                const [q] = await sql`SELECT marks, negative_marks FROM questions WHERE id = ${qId}`;
                if (q) {
                    qMarks = parseInt(q.marks) || 1;
                    qNegMarks = qNegMarks ?? q.negative_marks;
                }
            }

            // Create junction entry
            await sql`
                INSERT INTO section_questions (section_id, question_id, marks, negative_marks, "order")
                VALUES (${sectionId}, ${qId}, ${qMarks || 1}, ${qNegMarks || null}, ${currentOrder})
            `;

            // Also stamp section_id on base question for backward compatibility
            await sql`
                UPDATE questions SET section_id = ${sectionId} WHERE id = ${qId}
            `;

            currentOrder++;
            linked++;
        }

        return NextResponse.json({
            success: true,
            linked,
            skipped,
            message: `Linked ${linked} questions${skipped > 0 ? `, ${skipped} already existed` : ''}`
        });
    } catch (error: any) {
        console.error('Error linking questions:', error);
        return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
    }
}
