import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Client } from 'pg';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
    try {
        const { title, author, textContent } = await request.json();

        if (!title || !textContent) {
            return NextResponse.json({ success: false, error: 'Title and text content are required' }, { status: 400 });
        }

        // 1. Create Reference Material
        const refMaterial = await prisma.referenceMaterial.create({
            data: {
                title,
                author,
                textContent
            }
        });

        // 2. Chunk text
        // Very basic chunking by double newlines or large blocks
        let chunks = textContent.split(/\n\s*\n/).filter((c: string) => c.trim().length > 50);

        const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

        // Batch embed and insert
        for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks[i].trim();
            if (!chunkText) continue;

            try {
                // Generate 768-dimensional embedding from Gemini
                const result = await model.embedContent(chunkText);
                const embeddingVector = result.embedding.values;

                // Format vector for pgvector raw insertion: '[0.1, 0.2, ...]'
                // Native parameterization fails for unsupported types in Prisma sometimes,
                // but we also can't do direct string interpolation for security or parsing reasons unless using Prisma.raw.
                // However, Neon serverless adapter might be what is mangling it. Let's try explicit array casting format
                // required by pgvector: '[1,2,3]'
                const pgVectorString = `[${embeddingVector.join(',')}]`;

                const client = new Client({ connectionString: process.env.MERIT_DATABASE_URL });
                await client.connect();

                await client.query(`
                    INSERT INTO document_chunks (
                        reference_material_id, 
                        chunk_index, 
                        content, 
                        embedding
                    ) VALUES (
                        $1::uuid, 
                        $2, 
                        $3, 
                        $4::vector
                    )
                `, [refMaterial.id, i, chunkText, pgVectorString]);

                await client.end();
            } catch (e: any) {
                console.error("Failed to embed or insert chunk", i);
                console.error("Error Object:", e);
                console.error("Error Message:", e.message);
                if (e.code) console.error("Prisma Error Code:", e.code);
                if (e.meta) console.error("Prisma Error Meta:", e.meta);
            }
        }

        return NextResponse.json({ success: true, id: refMaterial.id });

    } catch (error: any) {
        console.error("Upload Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
