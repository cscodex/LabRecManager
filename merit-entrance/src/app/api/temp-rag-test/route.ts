import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function getDb() {
    const connStr = process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL || "";
    const adapter = new PrismaNeonHttp(connStr);
    return new PrismaClient({ adapter });
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "check";
    const db = getDb();
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    try {
        if (action === "admin") {
            const admin = await db.user.findFirst({ where: { role: "admin" }, select: { id: true, email: true } });
            return NextResponse.json({ success: true, admin });
        }

        if (action === "generate") {
            const admin = await db.user.findFirst({ where: { role: "admin" } });
            if (!admin) return NextResponse.json({ success: false, error: "No admin user" });

            const blueprint: any = await (db.examBlueprint.findFirst as any)({
                include: {
                    sections: {
                        include: { rules: { include: { topicTags: true } } },
                        orderBy: { order: "asc" },
                    },
                    materials: { select: { id: true } },
                },
            });

            if (!blueprint) return NextResponse.json({ success: false, error: "No blueprint found" });

            let contextMap = "";
            if (blueprint.materials && blueprint.materials.length > 0) {
                const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
                const aiPromptVector = await embedModel.embedContent(
                    "Computer Science fundamentals, Python programming, networking"
                );

                const materialIds = blueprint.materials.map((m: any) => `'${m.id}'`).join(",");
                const contextChunks = await db.$queryRawUnsafe<any[]>(
                    `SELECT chunk_text, 1 - (embedding <=> '[${aiPromptVector.embedding.values.join(",")}]') as similarity
                     FROM "DocumentChunk"
                     WHERE reference_material_id IN (${materialIds})
                     ORDER BY similarity DESC
                     LIMIT 5`
                );

                contextMap = contextChunks.map((c) => c.chunk_text).join("\n\n---\n\n");
            }

            const generatorModel = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                systemInstruction: `You are an expert CBSE Computer Science question author.
                Generate EXACTLY 2 highly original single-choice MCQ questions.
                Return a strict valid JSON array:
                [{"text":"...","options":["A","B","C","D"],"correctOption":1,"explanation":"..."}]
                NO markdown wrappers. RAW JSON ONLY.`,
            });

            const promptBody = contextMap
                ? `Use this book context to ensure accuracy:\n${contextMap}`
                : `Generate from general knowledge.`;

            const response = await generatorModel.generateContent(promptBody);
            let rawText = response.response.text().trim()
                .replace(/^```json/i, "").replace(/```$/i, "").trim();
            if (rawText.startsWith("```")) {
                rawText = rawText.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
            }

            const generatedQs = JSON.parse(rawText);

            const exam = await db.exam.create({
                data: {
                    title: "Test-09",
                    description: { en: "CBSE Computer Science RAG test", expected_questions: 2 },
                    duration: 30,
                    totalMarks: 2,
                    createdById: admin.id,
                    status: "draft",
                },
            });

            const section = await db.section.create({
                data: { examId: exam.id, name: "Section A - MCQ", order: 1 },
            });

            let orderCounter = 1;
            const savedQuestions: any[] = [];
            for (const q of generatedQs) {
                const dbQ = await db.question.create({
                    data: {
                        text: { en: q.text },
                        type: "mcq_single",
                        difficulty: 3,
                        explanation: { en: q.explanation },
                        options: q.options.map((opt: string) => ({ en: opt })),
                        correctAnswer: [q.correctOption.toString()],
                        isAiGenerated: true,
                        citation: {
                            source: "Gemini 2.5 RAG Engine",
                            text_excerpt: contextMap ? contextMap.substring(0, 50) + "..." : "General knowledge",
                        },
                        order: 0,
                    },
                });

                await db.$executeRawUnsafe(
                    `INSERT INTO "section_questions" ("section_id", "question_id", "marks", "negative_marks", "order") VALUES ($1, $2, $3, $4, $5)`,
                    section.id, dbQ.id, 1, 0, orderCounter++
                );

                savedQuestions.push({ id: dbQ.id, text: q.text, correct: q.options[q.correctOption] });
            }

            return NextResponse.json({
                success: true,
                examId: exam.id,
                message: "Test-09 created successfully!",
                ragContextUsed: contextMap.length > 0,
                ragContextLength: contextMap.length,
                questions: savedQuestions,
            });
        }

        // Default: check if Test-09 exists
        const exams = await db.exam.findMany({
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
                sections: { include: { sectionQuestions: { include: { question: true } } } },
            },
        });

        const test09 = exams.filter((e: any) => {
            if (typeof e.title === "string") return e.title === "Test-09";
            if (e.title && typeof e.title === "object") return (e.title as any).en === "Test-09";
            return false;
        });

        if (test09.length > 0) {
            return NextResponse.json({
                success: true,
                message: "Test-09 found!",
                data: test09.map((e: any) => ({
                    id: e.id,
                    title: e.title,
                    questionsGenerated: e.sections.reduce((a: number, s: any) => a + s.sectionQuestions.length, 0),
                })),
            });
        }

        return NextResponse.json({
            success: false,
            message: "Test-09 NOT FOUND.",
            latestExams: exams.slice(0, 5).map((e: any) => ({ title: e.title, status: e.status })),
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message, stack: e.stack?.substring(0, 500) });
    } finally {
        await db.$disconnect();
    }
}
