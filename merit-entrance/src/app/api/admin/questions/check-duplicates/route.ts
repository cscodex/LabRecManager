import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { questions } = await req.json();

        if (!questions || !Array.isArray(questions)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const questionTexts = questions.map((q: any) => q.text.trim());

        if (questionTexts.length === 0) {
            return NextResponse.json({ success: true, duplicateIndices: [] });
        }

        // Use pg_trgm similarity to check for fuzzy matches (> 0.85 threshold)
        const duplicates = await sql`
            SELECT i.input_text
            FROM questions q
            JOIN UNNEST(${questionTexts}::text[]) AS i(input_text)
            ON similarity(q.text->>'en', i.input_text) > 0.85
        `;

        // Create a Set of input texts that were flagged as duplicates
        const duplicateTexts = new Set(duplicates.map((d: any) => d.input_text));

        // Map back to original indices
        const duplicateIndices: number[] = [];
        questions.forEach((q: any, idx: number) => {
            if (duplicateTexts.has(q.text.trim())) {
                duplicateIndices.push(idx);
            }
        });

        return NextResponse.json({
            success: true,
            duplicateIndices
        });

    } catch (error: any) {
        console.error('Duplicate Check Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
