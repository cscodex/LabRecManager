import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.MERIT_DATABASE_URL;

let cleanDbUrl = connectionString.trim().replace(/^["']|["']$/g, '');
if (cleanDbUrl.startsWith('postgresql://')) {
    cleanDbUrl = 'postgres://' + cleanDbUrl.substring(13);
}

const pool = new Pool({
  connectionString: cleanDbUrl,
  ssl: { rejectUnauthorized: false }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function run() {
    console.log("Starting pure Postgres RAG Generation...");
    try {
        const adminRes = await pool.query("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1");
        if (adminRes.rows.length === 0) throw new Error("No admin");
        const admin = adminRes.rows[0];
        console.log(`Using Admin: ${admin.email}`);
        
        const bpRes = await pool.query("SELECT id, name FROM exam_blueprints LIMIT 1");
        if (bpRes.rows.length === 0) throw new Error("No BP");
        const blueprint = bpRes.rows[0];
        console.log(`Using Blueprint: ${blueprint.name}`);
        
        console.log("Fetching blueprint materials...");
        const matReq = await pool.query(`SELECT "A" as bp_id, "B" as mat_id FROM "_BlueprintMaterials" WHERE "A" = $1`, [blueprint.id]);
        console.log("Materials count:", matReq.rows.length);
        
        if (matReq.rows.length > 0) {
            console.log("Material processing loop starting...");
            
            console.log("Calling Gemini embedContent()...");
            const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
            const aiPromptVector = await embedModel.embedContent(
                "Generate a mcq question about General Knowledge. Difficulty level: medium."
            );
            console.log("Got embeddings!");
            
            const materialIds = matReq.rows.map(r => `'${r.mat_id}'`).join(',');
            const contextFilter = `WHERE reference_material_id IN (${materialIds})`;

            console.log("Executing Vector Query against chunks...");

            const chunkRes = await pool.query(`
                SELECT chunk_text, 1 - (embedding <=> '[${aiPromptVector.embedding.values.join(",")}]') as similarity 
                FROM "DocumentChunk" 
                ${contextFilter}
                ORDER BY similarity DESC 
                LIMIT 2
            `);

            console.log(`Found ${chunkRes.rows.length} chunk(s).`);
            if (chunkRes.rows.length > 0) {
                 console.log(chunkRes.rows[0].chunk_text.substring(0, 150) + "...");
            }
            
            const contextMap = chunkRes.rows.map(c => c.chunk_text).join("\n\n---\n\n");
            
            console.log("Generating with context length:", contextMap.length);
            
            const generatorModel = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                systemInstruction: `You are an expert CBSE Computer Science question author.
                
                Generate EXACTLY 2 highly original single-choice MCQ questions.
                
                CRITICAL: Return the questions inside a strict valid JSON array:
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
            
            console.log("Calling Gemini generateContent()...");
            const promptBody = contextMap 
                ? `Use this book context to ensure accuracy:\n${contextMap}` 
                : `Generate from general knowledge as no context was found.`;
                
            const response = await generatorModel.generateContent(promptBody);
            console.log("Got GenAI output!");
            
            let rawText = response.response.text().trim()
                .replace(/^```json/i, "")
                .replace(/```$/i, "")
                .trim();
                
            if (rawText.startsWith('```')) {
                rawText = rawText.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
            }

            const generatedQs = JSON.parse(rawText);
            console.log("\n✅ AI successfully generated questions:");
            generatedQs.forEach((q, i) => {
                console.log(`Q${i+1}: ${q.text}`);
                console.log(`Correct: ${q.options[q.correctOption]}`);
            });
            
        } else {
             console.log("No materials attached to blueprint!");
        }

    } catch (e) {
        console.error("Crash:", e.message);
        console.error(e.stack);
    } finally {
        await pool.end();
        console.log("Finished script.");
    }
}
run();
