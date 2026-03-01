import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "embedding-001" });
async function test() {
    try {
        const result = await model.embedContent("Hello world");
        console.log("Success! Dimensions:", result.embedding.values.length);
    } catch(e) {
        console.error("Error:", e);
    }
}
test();
