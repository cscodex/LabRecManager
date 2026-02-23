import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role || '')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // We use a self-join with the pg_trgm similarity function.
        // Limit to 200 pairs to avoid massive latency on huge databases.
        const duplicatePairs = await sql`
            SELECT 
                q1.id as id1, q1.text as text1, q1.type as type1, 
                q2.id as id2, q2.text as text2, q2.type as type2, 
                similarity(COALESCE(q1.text->>'en', ''), COALESCE(q2.text->>'en', '')) as sim
            FROM questions q1 
            JOIN questions q2 ON q1.id < q2.id 
            WHERE similarity(COALESCE(q1.text->>'en', ''), COALESCE(q2.text->>'en', '')) > 0.85
            ORDER BY sim DESC
            LIMIT 200
        `;

        if (duplicatePairs.length === 0) {
            return NextResponse.json({ success: true, groups: [] });
        }

        const groups: Array<Array<any>> = [];
        const processedIds = new Set<string>();
        const idToQuestionMap = new Map<string, any>();

        duplicatePairs.forEach((pair: any) => {
            if (!idToQuestionMap.has(pair.id1)) {
                idToQuestionMap.set(pair.id1, { id: pair.id1, text: pair.text1, type: pair.type1 });
            }
            if (!idToQuestionMap.has(pair.id2)) {
                idToQuestionMap.set(pair.id2, { id: pair.id2, text: pair.text2, type: pair.type2 });
            }
        });

        // Connected components approach for grouping
        const adjacencyList = new Map<string, string[]>();
        duplicatePairs.forEach((pair: any) => {
            if (!adjacencyList.has(pair.id1)) adjacencyList.set(pair.id1, []);
            if (!adjacencyList.has(pair.id2)) adjacencyList.set(pair.id2, []);
            adjacencyList.get(pair.id1)!.push(pair.id2);
            adjacencyList.get(pair.id2)!.push(pair.id1);
        });

        for (const [nodeId, neighbors] of Array.from(adjacencyList.entries())) {
            if (!processedIds.has(nodeId)) {
                const group: any[] = [];
                const queue = [nodeId];
                processedIds.add(nodeId);

                while (queue.length > 0) {
                    const curr = queue.shift()!;
                    group.push(idToQuestionMap.get(curr));

                    const edges = adjacencyList.get(curr) || [];
                    for (const neighbor of edges) {
                        if (!processedIds.has(neighbor)) {
                            processedIds.add(neighbor);
                            queue.push(neighbor);
                        }
                    }
                }

                if (group.length > 1) {
                    groups.push(group);
                }
            }
        }

        return NextResponse.json({ success: true, groups });
    } catch (error: any) {
        console.error('Find Duplicates Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
