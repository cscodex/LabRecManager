
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Just to instantiate
        // The SDK doesn't have a direct listModels method on the client instance in some versions,
        // but let's try to see if we can just hit the API or if we need to use the model manager if available in this version.
        // Actually, looking at docs, it might be simpler to just try 'gemini-pro' as a fallback first 
        // BUT, let's try to use the fallback 'gemini-1.5-pro-latest' or just 'gemini-pro' in the main code.

        // Better yet, let's write a script that tries multiple model names and reports which one works.

        const modelsToTry = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash-001",
            "gemini-1.5-pro",
            "gemini-1.5-pro-latest",
            "gemini-1.5-pro-001",
            "gemini-pro",
            "gemini-pro-vision"
        ];

        console.log("Testing models for generateContent...");

        for (const modelName of modelsToTry) {
            try {
                const m = genAI.getGenerativeModel({ model: modelName });
                // Simple text test
                await m.generateContent("Hello");
                console.log(`✅ ${modelName} is AVAILABLE and working.`);
            } catch (error) {
                console.log(`❌ ${modelName} failed: ${error.message.split('\n')[0]}`);
            }
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
