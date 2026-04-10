import { PrismaClient } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const connectionString = process.env.DATABASE_URL || process.env.MERIT_DATABASE_URL;
if (!connectionString) throw new Error("No database string!");

let cleanDbUrl = connectionString.trim().replace(/^["']|["']$/g, '');
if (cleanDbUrl.startsWith('postgresql://')) {
    cleanDbUrl = 'postgres://' + cleanDbUrl.substring(13);
}

const adapter = new PrismaNeonHttp(cleanDbUrl, {
    fetchOptions: { cache: 'no-store' }
});

const prisma = new PrismaClient({ adapter, log: ['warn', 'error'] });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function run() {
    console.log("Starting pure node RAG Generation...");
    try {
        const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
        if (!admin) throw new Error("No admin");
        
        const blueprints = await prisma.examBlueprint.findMany({ select: { id: true, name: true, materials: true }});
        if (blueprints.length === 0) throw new Error("No BP");
        const blueprint = blueprints[0];
        
        console.log(`Using Blueprint: ${blueprint.name}`);

        // RAG Code Mirroring generate.ts
        if (blueprint.materials && blueprint.materials.length > 0) {
            console.log("Material processing loop starting...");
            
            const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
            const aiPromptVector = await embedModel.embedContent(
                "Generate a mcq question about General Knowledge. Difficulty level: medium."
            );
            
            const materialIds = blueprint.materials.map((m: any) => `'${m.id}'`).join(',');
            const contextFilter = `WHERE reference_material_id IN (${materialIds})`;

            console.log("Executing query:", contextFilter);

            const contextChunks = await prisma.$queryRawUnsafe<any[]>(
                `SELECT chunk_text, 1 - (embedding <=> '[${aiPromptVector.embedding.values.join(",")}]') as similarity 
                    FROM "DocumentChunk" 
                    ${contextFilter}
                    ORDER BY similarity DESC 
                    LIMIT 2`
            );

            console.log(`Found ${contextChunks.length} chunks.`);
            if (contextChunks.length > 0) {
                 console.log(contextChunks[0].chunk_text.substring(0, 100));
            }
        } else {
             console.log("No materials attached to blueprint!");
        }

    } catch (e: any) {
        console.error("Crash:", e.message);
        console.error(e.stack);
    } finally {
        await prisma.$disconnect();
    }
}
run();
