
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function testModel() {
    const modelName = 'gemini-flash-lite-latest';
    console.log(`Testing model: ${modelName}`);

    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Explain how AI works in one sentence.");
        console.log("✅ Success!");
        console.log("Response:", result.response.text());
    } catch (error) {
        console.error("❌ Failed:", error.message);
        if (error.response) {
            console.error("Error Details:", JSON.stringify(error.response, null, 2));
        }
    }
}

testModel();
