import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const materialsRaw = await prisma.referenceMaterial.findMany({
            orderBy: { createdAt: 'desc' }
        });

        // Fetch counts manually to bypass Neon adapter BigInt serialization bugs on left-joins
        const chunkCounts = await prisma.documentChunk.groupBy({
            by: ['referenceMaterialId'],
            _count: {
                id: true
            }
        });

        const countMap = new Map(chunkCounts.map(c => [c.referenceMaterialId, c._count.id]));

        const materials = materialsRaw.map(m => ({
            ...m,
            _count: {
                chunks: countMap.get(m.id) || 0
            }
        }));

        return NextResponse.json({ success: true, materials });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
