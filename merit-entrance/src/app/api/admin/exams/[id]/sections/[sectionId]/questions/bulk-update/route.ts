import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// PATCH: Bulk update marks for selected questions
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sectionId } = await params;
        const { questionIds, marks, negativeMarks } = await request.json() as {
            questionIds: string[];
            marks?: number;
            negativeMarks?: number;
        };

        if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
            return NextResponse.json({ error: 'No question IDs provided' }, { status: 400 });
        }

        let updated = 0;

        for (const qId of questionIds) {
            const setClauses: string[] = [];
            if (marks !== undefined) {
                await sql`
                    UPDATE questions SET marks = ${marks}
                    WHERE id = ${qId} AND section_id = ${sectionId}
                `;
                updated++;
            }
            if (negativeMarks !== undefined) {
                await sql`
                    UPDATE questions SET negative_marks = ${negativeMarks}
                    WHERE id = ${qId} AND section_id = ${sectionId}
                `;
            }
        }

        return NextResponse.json({
            success: true,
            updated: questionIds.length,
        });
    } catch (error: any) {
        console.error('Error in bulk update:', error);
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
