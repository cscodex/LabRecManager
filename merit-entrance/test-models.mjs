import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
async function test() {
    try {
        const fetch = await import('node-fetch');
        const res = await fetch.default(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
        );
        const data = await res.json();
        console.log(data.models.map(m => m.name));
    } catch(e) {
        console.error("Error:", e);
    }
}
test();
