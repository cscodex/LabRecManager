/**
 * AI Image Enhancement Pipeline
 * 
 * 1. Fetches all question images from DB
 * 2. Uses Gemini Vision (2.5-flash) to describe the image content
 * 3. Uses Gemini Image Generation (nano-banana-pro) to recreate a cleaner version
 * 4. Uploads the new image to Cloudinary
 * 5. Updates the question's image_url in the DB
 * 
 * Usage: node enhance-images.js [--dry-run] [--limit N] [--question-id ID]
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Client } = require('pg');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// ── Config ──────────────────────────────────────────────────────────────
const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '';
const geminiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 999;
const qidIdx = args.indexOf('--question-id');
const QUESTION_ID = qidIdx !== -1 ? args[qidIdx + 1] : null;

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ── Gemini Setup ────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(geminiKeys[0]);

async function fetchImageAsBase64(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/png';
    return { base64, mimeType };
}

// ── Step 1: Analyze image with Gemini Vision ────────────────────────────
async function analyzeImage(imageUrl, questionText) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const { base64, mimeType } = await fetchImageAsBase64(imageUrl);

    const prompt = `You are an expert image analyst for educational exam content.

Analyze this image attached to an exam question and provide a DETAILED description that could be used to recreate it as a clean, high-quality diagram.

QUESTION CONTEXT: "${questionText}"

Describe:
1. WHAT type of diagram/figure it is (circuit diagram, geometric figure, pattern, chart, table, etc.)
2. EXACT content — every element, label, number, measurement, angle, connection point
3. Layout and spatial arrangement of elements
4. Any text labels, numbers, or symbols visible in the image
5. Colors used (if any meaningful ones)

Be extremely precise and exhaustive. Include every detail needed to perfectly recreate this image.

OUTPUT: JSON only, no markdown.
{
    "type": "geometric_figure | circuit_diagram | pattern | chart | table | other",
    "quality_rating": 1-10,
    "quality_issues": ["blurry", "low_res", "cropped", "noisy", "faded"],
    "description": "Detailed description of the image content",
    "recreation_prompt": "A precise prompt that could be used to recreate this exact image as a clean, high-quality educational diagram. Be very specific about every element, position, label, and measurement."
}`;

    const result = await model.generateContent([
        prompt,
        {
            inlineData: { mimeType, data: base64 }
        }
    ]);

    let text = result.response.text().trim();
    if (text.startsWith('```json')) text = text.slice(7);
    if (text.startsWith('```')) text = text.slice(3);
    if (text.endsWith('```')) text = text.slice(0, -3);

    return JSON.parse(text.trim());
}

// ── Step 2: Regenerate image with Gemini Image Gen ──────────────────────
async function regenerateImage(analysis, originalImageUrl) {
    const model = genAI.getGenerativeModel({ model: 'nano-banana-pro-preview' });

    // Fetch original image to show as reference
    const { base64, mimeType } = await fetchImageAsBase64(originalImageUrl);

    const prompt = `Recreate this educational diagram as a clean, high-quality, professional image.

TYPE: ${analysis.type}
DESCRIPTION: ${analysis.description}

RECREATION INSTRUCTIONS: ${analysis.recreation_prompt}

IMPORTANT RULES:
1. The recreated image must contain EXACTLY the same content as the original — same numbers, labels, measurements, and structure.
2. Make it clean, sharp, and professional — suitable for a printed exam paper.
3. Use clear black lines on white background for diagrams.
4. Use legible fonts for all text and labels.
5. Maintain the same proportions and layout as the original.
6. Do NOT add any extra elements or decorations.

Generate the recreated image.`;

    try {
        const result = await model.generateContent([
            prompt,
            { inlineData: { mimeType, data: base64 } }
        ]);

        const response = result.response;
        const parts = response.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
            if (part.inlineData) {
                return {
                    base64: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'image/png'
                };
            }
        }

        console.log('    ⚠️ No image in response, trying text-only prompt...');
    } catch (err) {
        console.log(`    ⚠️ Image gen with reference failed: ${err.message}`);
        console.log('    Retrying with text-only prompt...');
    }

    // Fallback: text-only prompt without reference image
    try {
        const result = await model.generateContent(
            `Create a clean, high-quality educational diagram:

TYPE: ${analysis.type}
DESCRIPTION: ${analysis.description}
INSTRUCTIONS: ${analysis.recreation_prompt}

Generate this as a professional, print-quality black-and-white diagram suitable for an exam paper.`
        );

        const response = result.response;
        const parts = response.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
            if (part.inlineData) {
                return {
                    base64: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'image/png'
                };
            }
        }

        return null;
    } catch (err) {
        console.log(`    ❌ Text-only image gen also failed: ${err.message}`);
        return null;
    }
}

// ── Step 3: Upload to Cloudinary ────────────────────────────────────────
async function uploadToCloudinary(base64Data, mimeType, questionId) {
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'merit-entrance/questions-enhanced',
        public_id: `enhanced_${questionId}`,
        overwrite: true,
    });

    return result.secure_url;
}

// ── Main Pipeline ───────────────────────────────────────────────────────
async function main() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log('✅ Connected to database');
        console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '🚀 LIVE MODE'}`);
        console.log('');

        // Fetch questions with images
        let query = `
            SELECT id, text->>'en' as text_en, image_url, type
            FROM questions 
            WHERE image_url IS NOT NULL AND image_url != ''
        `;
        const params = [];

        if (QUESTION_ID) {
            query += ` AND id = $1`;
            params.push(QUESTION_ID);
        }

        query += ` ORDER BY id LIMIT ${LIMIT}`;

        const { rows: questions } = await client.query(query, params);
        console.log(`Found ${questions.length} questions with images\n`);

        let enhanced = 0;
        let skipped = 0;
        let failed = 0;
        const report = [];

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            console.log(`\n${'='.repeat(70)}`);
            console.log(`[${i + 1}/${questions.length}] Question: ${q.id}`);
            console.log(`  Text: ${(q.text_en || '').substring(0, 60)}...`);
            console.log(`  Original: ${q.image_url}`);

            try {
                // Step 1: Analyze
                console.log('  📊 Agent 1: Analyzing image quality...');
                const analysis = await analyzeImage(q.image_url, q.text_en || '');

                console.log(`    Type: ${analysis.type}`);
                console.log(`    Quality: ${analysis.quality_rating}/10`);
                console.log(`    Issues: ${analysis.quality_issues?.join(', ') || 'none'}`);

                // Skip if quality is already good (>= 8)
                if (analysis.quality_rating >= 8) {
                    console.log('    ⏩ Image quality is already good, skipping...');
                    skipped++;
                    report.push({ id: q.id, status: 'skipped', quality: analysis.quality_rating, reason: 'Good quality' });
                    continue;
                }

                // Step 2: Regenerate
                console.log('  🎨 Agent 2: Regenerating image with AI...');
                await delay(2000); // Rate limit protection

                const newImage = await regenerateImage(analysis, q.image_url);

                if (!newImage) {
                    console.log('    ❌ Image generation returned no image');
                    failed++;
                    report.push({ id: q.id, status: 'failed', quality: analysis.quality_rating, reason: 'No image returned' });
                    continue;
                }

                console.log(`    ✅ Generated new image (${newImage.mimeType})`);

                if (DRY_RUN) {
                    console.log('    🔍 DRY RUN — would upload and update DB');
                    enhanced++;
                    report.push({ id: q.id, status: 'would_enhance', quality: analysis.quality_rating });
                    continue;
                }

                // Step 3: Upload to Cloudinary
                console.log('  ☁️  Uploading to Cloudinary...');
                const newUrl = await uploadToCloudinary(newImage.base64, newImage.mimeType, q.id);
                console.log(`    New URL: ${newUrl}`);

                // Step 4: Update DB (keep old URL for reference)
                await client.query(
                    `UPDATE questions SET image_url = $1 WHERE id = $2`,
                    [newUrl, q.id]
                );
                console.log('    ✅ Database updated');

                enhanced++;
                report.push({
                    id: q.id,
                    status: 'enhanced',
                    quality: analysis.quality_rating,
                    oldUrl: q.image_url,
                    newUrl
                });

            } catch (err) {
                console.log(`    ❌ Error: ${err.message}`);
                failed++;
                report.push({ id: q.id, status: 'failed', quality: 0, reason: err.message });
            }

            // Rate limit delay between questions
            if (i < questions.length - 1) {
                await delay(3000);
            }
        }

        // Summary
        console.log(`\n${'='.repeat(70)}`);
        console.log('📊 RESULTS SUMMARY');
        console.log('='.repeat(70));
        console.log(`  Total processed: ${questions.length}`);
        console.log(`  Enhanced: ${enhanced}`);
        console.log(`  Skipped (good quality): ${skipped}`);
        console.log(`  Failed: ${failed}`);

        console.log('\n📋 Detailed Report:');
        for (const r of report) {
            const icon = r.status === 'enhanced' ? '✅' :
                r.status === 'would_enhance' ? '🔍' :
                    r.status === 'skipped' ? '⏩' : '❌';
            console.log(`  ${icon} ${r.id} — Quality: ${r.quality}/10 — ${r.status}${r.reason ? ` (${r.reason})` : ''}`);
        }

    } catch (err) {
        console.error('❌ Fatal error:', err);
    } finally {
        await client.end();
    }
}

main();
