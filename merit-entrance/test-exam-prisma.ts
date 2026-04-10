import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function run() {
    console.log("Starting DB generation test for Test-09 CBSE Computer Science...");
    
    try {
        // 1. Get the admin user
        const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
        if (!admin) throw new Error("No admin user found to act as creator.");
        console.log(`Using admin: ${admin.email} (${admin.id})`);
        
        // 2. Find the CBSE Computer Science NCERT material
        const material = await prisma.referenceMaterial.findFirst({
            where: { title: { contains: 'Computer Science', mode: 'insensitive' } }
        });
        
        let materialIdToUse = material?.id;
        
        if (!material) {
             console.log("No specific 'Computer Science' material found. Falling back to the first available RAG document.");
             const fallback = await prisma.referenceMaterial.findFirst();
             if (!fallback) throw new Error("No RAG materials exist in the database!");
             materialIdToUse = fallback.id;
             console.log(`Using fallback material: ${fallback.title}`);
        } else {
             console.log(`Found material: ${material.title}`);
        }

        // 3. Set up the RAG prompt vector
        console.log("Generating embeddings for search query: 'Computer Science fundamentals, networking, Python'...");
        const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const aiPromptVector = await embedModel.embedContent(
            "Computer Science fundamentals, computer networks, Python programming, database management SQL."
        );
        
        // 4. Do the PGVector Search!
        console.log("Executing pgvector cosine similarity search against RAG chunks...");
        const contextChunks = await prisma.$queryRawUnsafe<any[]>(
            `SELECT chunk_text, 1 - (embedding <=> '[${aiPromptVector.embedding.values.join(",")}]') as similarity 
                FROM "DocumentChunk" 
                WHERE reference_material_id = '${materialIdToUse}'
                ORDER BY similarity DESC 
                LIMIT 5`
        );
        
        if (contextChunks.length === 0) {
            console.log("⚠️ No embedded chunks found for this material. Has it been processed by the vectorizer yet?");
        } else {
            console.log(`✅ Found ${contextChunks.length} highly relevant chunks!`);
            console.log("Top Chunk Preview:", contextChunks[0].chunk_text.substring(0, 150) + "...");
        }
        
        const contextMap = contextChunks.map((c) => c.chunk_text).join("\n\n---\n\n");
        
        // 5. Generate Exam Questions using Gemini 2.5 Flash + RAG Context
        console.log("Asking Gemini to generate 2 questions using this context...");
        const generatorModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: `You are an expert CBSE Computer Science question author.
            
            Generate EXACTLY 2 highly original single-choice MCQ questions based entirely on the text passage.
            
            CRITICAL: Return the questions inside a strict valid JSON array matching exactly this interface:
            [
              {
                "text": "The question here",
                "options": ["Option A", "Option B", "Option C", "Option D"], 
                "correctOption": 1, 
                "explanation": "Why it is correct"
              }
            ]
            
            NO MARKDOWN WRAPPERS OR TICK MARKS. RAW JSON ONLY.
            `
        });
        
        const promptBody = contextMap 
            ? `Use this book context to ensure accuracy:\n${contextMap}` 
            : `Generate from general knowledge as no context was found.`;
            
        const response = await generatorModel.generateContent(promptBody);
        let rawText = response.response.text().trim()
            .replace(/^```json/i, "")
            .replace(/```$/i, "")
            .trim();
            
        if (rawText.startsWith('```')) {
            rawText = rawText.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
        }

        const generatedQs = JSON.parse(rawText);
        console.log("\n✅ AI successfully generated questions:");
        generatedQs.forEach((q: any, i: number) => {
            console.log(`Q${i+1}: ${q.text}`);
            console.log(`Correct: ${q.options[q.correctOption]}`);
        });

        // 6. Create the Exam in DB
        console.log("\nSaving 'Test-09' directly to the database...");
        const exam = await prisma.exam.create({
            data: {
                title: "Test-09",
                description: { en: "CBSE Computer Science test generated via automated RAG pipeline", expected_questions: 2 },
                duration: 30,
                totalMarks: 2,
                createdById: admin.id,
                status: "draft"
            }
        });
        
        const section = await prisma.section.create({
            data: {
                examId: exam.id,
                name: "Section A - MCQ",
                order: 1
            }
        });
        
        let orderCounter = 1;
        for (const q of generatedQs) {
            const dbQ = await prisma.question.create({
                data: {
                    text: { en: q.text },
                    type: "mcq_single",
                    difficulty: 3,
                    explanation: { en: q.explanation },
                    options: q.options.map((opt: string) => ({ en: opt })),
                    correctAnswer: [q.correctOption.toString()],
                    isAiGenerated: true,
                    citation: {
                        source: "Gemini 2.5 Dynamic RAG Engine",
                        text_excerpt: contextMap ? contextMap.substring(0, 50) + "..." : "Sourced from general model knowledge."
                    },
                    order: 0
                }
            });
            
            await prisma.$executeRawUnsafe(
                `INSERT INTO "section_questions" ("section_id", "question_id", "marks", "negative_marks", "order") VALUES ($1, $2, $3, $4, $5)`,
                section.id,  dbQ.id,  1,  0,  orderCounter++
            );
        }

        console.log(`\n🎉 Test-09 successfully created! Exam ID: ${exam.id}`);
        console.log("You can view it in the UI under Exams -> Drafts.");
        
    } catch (e: any) {
        console.error("Test failed:", e.message || e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
