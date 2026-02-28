import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
    try {
        const { topic } = await request.json();

        if (!topic) {
            return NextResponse.json({ success: false, error: 'Topic query is required' }, { status: 400 });
        }

        // 1. Get embedding for the user's search query
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const result = await model.embedContent(topic);
        const queryVector = result.embedding.values;

        // 2. Format vector for pgvector query
        const pgVectorString = `[${queryVector.join(',')}]`;

        // 3. Execute Semantic Search using Cosine Distance (<=>) operator
        // The <=> operator generates Cosine Distance. We want the SMALLEST distance (closest match).
        // Returning the top 3 most relevant chunks across all textbooks
        const closestChunks: any[] = await prisma.$queryRaw`
            SELECT 
                dc.id, 
                dc.content, 
                rm.title as source_title,
                1 - (dc.embedding <=> ${pgVectorString}::vector) as similarity
            FROM document_chunks dc
            JOIN reference_materials rm ON dc.reference_material_id = rm.id
            ORDER BY dc.embedding <=> ${pgVectorString}::vector
            LIMIT 3;
        `;

        return NextResponse.json({
            success: true,
            chunks: closestChunks
        });

    } catch (error: any) {
        console.error("Semantic Search Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
