import { PrismaClient } from '@prisma/client';
import { PrismaNeonHttp } from '@prisma/adapter-neon';
import { neon } from '@neondatabase/serverless';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("No database str");

const sql = neon(connectionString);
const adapter = new PrismaNeonHttp(connectionString);
const prisma = new PrismaClient({ adapter });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function runTest() {
    try {
        console.log("Starting Prisma Neon HTTP Test...");
        const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
        console.log("Admin:", admin?.email);

        const blueprint = await prisma.examBlueprint.findFirst({
            include: { materials: true }
        });
        console.log("Blueprint:", blueprint?.name);

        if (!blueprint?.materials?.length) {
            console.log("No materials attached, skipping RAG");
            return;
        }

        console.log("Calling Gemini Embeddings...");
        const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const aiPromptVector = await embedModel.embedContent("Test query");
        console.log("Got embeddings back:", aiPromptVector.embedding.values.length, "dimensions");

        const materialIds = blueprint.materials.map((m: any) => `'${m.id}'`).join(',');
        console.log("Querying PGVector...");

        const contextChunks = await prisma.$queryRawUnsafe<any[]>(
            `SELECT chunk_text FROM "DocumentChunk" WHERE reference_material_id IN (${materialIds}) LIMIT 1`
        );
        console.log("Found Chunks:", contextChunks.length);

        console.log("Calling Gemini Generation...");
        const generatorModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: `Generate 1 MCQ question.`
        });
        const response = await generatorModel.generateContent("Test prompt");
        console.log("Gemini Output:", response.response.text());

    } catch (e: any) {
        console.error("Test Failed:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
runTest();
