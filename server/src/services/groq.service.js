const Groq = require('groq-sdk');
const axios = require('axios');

class GroqService {
    constructor() {
        this.groq = null;
        this.initialize();
    }

    initialize() {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.warn('GROQ_API_KEY not set. Groq extraction will not work.');
            return;
        }
        this.groq = new Groq({ apiKey });
    }

    async extractInventoryFromDocument(mimeType, base64Data, documentUrl) {
        if (!this.groq) {
            throw new Error('Groq API not configured. Please set GROQ_API_KEY in environment variables.');
        }

        let base64Image = base64Data;
        let mime = mimeType;
        
        // If it's a PDF on Cloudinary, convert to JPG using Cloudinary's native transformation
        if (mimeType === 'application/pdf' && documentUrl && documentUrl.includes('cloudinary.com')) {
            const imageUrl = documentUrl.replace(/\.pdf$/i, '.jpg');
            try {
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                base64Image = Buffer.from(response.data, 'binary').toString('base64');
                mime = 'image/jpeg';
            } catch (err) {
                throw new Error('Failed to convert PDF to image via Cloudinary: ' + err.message);
            }
        } else if (mimeType === 'application/pdf') {
            throw new Error('Groq currently only supports image files. Cannot process non-Cloudinary PDFs directly.');
        }

        const dataUrl = `data:${mime};base64,${base64Image}`;

        const prompt = `You are a strict data extraction AI. You are given a document image containing an inventory report, usually a table of installed equipment with serial numbers.
Your task is to extract all items and return a JSON array. 
Extract the following columns if available:
- serialNumber: The serial number of the Desktop/PC
- monitorSerial: The serial number of the Monitor (if applicable)
- upsSerial: The serial number of the UPS (if applicable)
- labName: The room or lab name where it is installed (e.g., 'Computer Lab 1', 'CompLab-2')

If the document contains multiple items, extract all of them.
Return ONLY valid JSON in the format below, without any markdown formatting or code blocks:
[
  {
    "serialNumber": "...",
    "monitorSerial": "...",
    "upsSerial": "...",
    "labName": "..."
  }
]
If no inventory items are found, return an empty array [].`;

        try {
            const chatCompletion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: dataUrl } }
                        ]
                    }
                ],
                model: "llama-3.2-11b-vision-preview",
            });

            let text = chatCompletion.choices[0].message.content.trim();
            
            // Clean up the response
            text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
            
            // Some models might prepend explanatory text before the array, extract everything from [ to ]
            const startIdx = text.indexOf('[');
            const endIdx = text.lastIndexOf(']');
            if (startIdx !== -1 && endIdx !== -1) {
                text = text.substring(startIdx, endIdx + 1);
            }
            
            return JSON.parse(text);
        } catch (error) {
            console.error('Groq API Error:', error);
            throw new Error(`Failed to extract inventory with Groq: ${error.message}`);
        }
    }
}

module.exports = new GroqService();
