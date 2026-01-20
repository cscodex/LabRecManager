import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const sections = await sql`
      SELECT 
        s.id,
        s.name,
        s."order",
        s.duration,
        (SELECT COUNT(*) FROM questions WHERE section_id = s.id) as question_count
      FROM sections s
      WHERE s.exam_id = ${params.id}
      ORDER BY s."order"
    `;

        return NextResponse.json({
            success: true,
            sections: sections.map(s => ({
                ...s,
                name: typeof s.name === 'string' ? JSON.parse(s.name) : s.name,
            })),
        });
    } catch (error) {
        console.error('Error fetching sections:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, order, duration } = body;

        if (!name?.en) {
            return NextResponse.json({ error: 'Section name is required' }, { status: 400 });
        }

        const result = await sql`
      INSERT INTO sections (exam_id, name, "order", duration)
      VALUES (${params.id}, ${JSON.stringify(name)}::jsonb, ${order}, ${duration || null})
      RETURNING id
    `;

        return NextResponse.json({
            success: true,
            sectionId: result[0].id,
        });
    } catch (error) {
        console.error('Error creating section:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
