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

        // Use neon sql query to check text->>'en'
        // We assume questions are stored with 'en' key in JSON text column
        // Neon uses tagged template literals for parameterized queries
        // BUT arrays in WHERE IN clause need careful handling with neon/postgres
        // Typically: WHERE text->>'en' = ANY($1::text[])

        const duplicates = await sql`
            SELECT id, text 
            FROM questions 
            WHERE text->>'en' = ANY(${questionTexts}::text[])
        `;

        // Initialize a Set of duplicate texts for O(1) lookups
        const duplicateTexts = new Set(duplicates.map((d: any) => {
            // Handle potential variations in JSON structure if necessary
            if (d.text && typeof d.text === 'object' && 'en' in d.text) {
                return d.text.en;
            }
            // Fallback for string or different structure
            return typeof d.text === 'string' ? d.text : '';
        }));

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
