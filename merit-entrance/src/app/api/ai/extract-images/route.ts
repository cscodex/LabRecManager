import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Gemini setup for image enhancement with key rotation
const geminiKeys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getGenAI() {
    if (geminiKeys.length === 0) return null;
    return new GoogleGenerativeAI(geminiKeys[currentKeyIndex % geminiKeys.length]);
}

function rotateKey() {
    currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;
    console.log(`[enhance] Rotated to API key ${currentKeyIndex + 1}/${geminiKeys.length}`);
}

interface ImageBounds {
    x: number; // Left edge (0-1)
    y: number; // Top edge (0-1)
    w: number; // Width (0-1)
    h: number; // Height (0-1)
}

interface QuestionImage {
    questionIndex: number;
    imageBounds: ImageBounds;
    page: number;
}

// ── Image Enhancement Pipeline ──────────────────────────────────────────
// Default: AI quality analysis + LOCAL sharp cleanup (preserves text perfectly)
// Optional: AI regeneration (aiRedraw=true) — may garble text, use with caution
async function enhanceImage(
    croppedBase64: string,
    questionText: string,
    forceEnhance: boolean = false,
    aiRedraw: boolean = false
): Promise<{ enhanced: boolean; base64: string; mimeType: string; quality?: number; imageType?: string }> {

    let analysis: any = null;

    // Step 1: AI quality analysis (if available)
    const genAI = getGenAI();
    if (genAI) {
        try {
            const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const analyzeResult = await visionModel.generateContent([
                `Analyze this exam question image. Rate its quality from 1-10 and describe what it contains.
Question context: "${questionText}"
OUTPUT: JSON only, no markdown.
{"quality": 7, "type": "circuit_diagram", "description": "detailed description of the image"}`,
                { inlineData: { mimeType: 'image/png', data: croppedBase64 } }
            ]);

            let analysisText = analyzeResult.response.text().trim();
            if (analysisText.startsWith('```json')) analysisText = analysisText.slice(7);
            if (analysisText.startsWith('```')) analysisText = analysisText.slice(3);
            if (analysisText.endsWith('```')) analysisText = analysisText.slice(0, -3);
            analysis = JSON.parse(analysisText.trim());

            console.log(`[enhance] Quality: ${analysis.quality}/10, Type: ${analysis.type}`);
        } catch (err: any) {
            console.warn(`[enhance] Quality analysis failed: ${err.message}`);
        }
    }

    // Skip if quality is good and no force/redraw requested
    if (analysis && analysis.quality >= 8 && !forceEnhance && !aiRedraw) {
        console.log('[enhance] Image quality is good (≥8), skipping enhancement');
        return { enhanced: false, base64: croppedBase64, mimeType: 'image/png', quality: analysis.quality, imageType: analysis.type };
    }

    // Step 2A: AI Redraw (only if explicitly requested — WARNING: may garble text)
    if (aiRedraw && genAI) {
        console.log('[enhance] AI Redraw requested — attempting full regeneration...');
        for (let attempt = 0; attempt < geminiKeys.length; attempt++) {
            const currentGenAI = getGenAI();
            if (!currentGenAI) break;
            try {
                const imageGenModel = currentGenAI.getGenerativeModel({
                    model: 'gemini-2.0-flash-preview-image-generation',
                });

                const regenResult = await imageGenModel.generateContent([
                    `Recreate ONLY the diagram/figure from this image as a clean, professional image for a printed exam paper.

TYPE: ${analysis?.type || 'diagram'}
DESCRIPTION: ${analysis?.description || 'educational diagram'}

CRITICAL RULES:
1. Background MUST be PURE WHITE (#FFFFFF). Remove any gray, yellow, or scanned paper texture.
2. REMOVE any question text that is NOT part of the diagram. Only keep diagram labels.
3. Preserve EXACTLY the same diagram content — same structure, numbers, labels within the diagram.
4. Use clean, crisp BLACK lines on white background.
5. Same proportions and layout as the original.

Generate ONLY the clean diagram with pure white background.`,
                    { inlineData: { mimeType: 'image/png', data: croppedBase64 } }
                ]);

                const parts = regenResult.response.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                    if (part.inlineData) {
                        console.log('[enhance] ✅ AI Redraw complete');
                        return {
                            enhanced: true,
                            base64: part.inlineData.data,
                            mimeType: part.inlineData.mimeType || 'image/png',
                            quality: analysis?.quality,
                            imageType: analysis?.type
                        };
                    }
                }
            } catch (err: any) {
                if (err.message?.includes('429') && attempt < geminiKeys.length - 1) {
                    console.warn(`[enhance] Key ${currentKeyIndex + 1} hit rate limit, rotating...`);
                    rotateKey();
                    continue;
                }
                console.warn(`[enhance] AI Redraw failed: ${err.message}`);
                break;
            }
        }
        console.log('[enhance] AI Redraw failed, falling back to local enhancement');
    }

    // Step 2B: Local Enhancement (DEFAULT — preserves original text perfectly)
    console.log('[enhance] Applying local enhancement (clean white bg + sharpen)...');
    return await localEnhance(croppedBase64, analysis);
}

// ── Local Image Enhancement (sharp-based, no API needed) ────────────────
// Best for scanned images: preserves original text perfectly, cleans background
async function localEnhance(
    base64: string,
    analysis: any
): Promise<{ enhanced: boolean; base64: string; mimeType: string; quality?: number; imageType?: string }> {
    try {
        const buffer = Buffer.from(base64, 'base64');

        // Step 1: Convert to grayscale for clean processing
        const grayscale = await sharp(buffer)
            .grayscale()
            .toBuffer();

        // Step 2: Apply threshold to force pure white background + clean black lines
        // Threshold at 200: anything lighter than this → pure white, darker → keep as dark
        const thresholded = await sharp(grayscale)
            .threshold(200)
            .toBuffer();

        // Step 3: Sharpen the clean image
        const enhanced = await sharp(thresholded)
            .sharpen({ sigma: 1.2 })
            .png()
            .toBuffer();

        const enhancedBase64 = enhanced.toString('base64');
        console.log('[enhance] ✅ Local enhancement applied (grayscale + threshold + sharpen → white bg)');

        return {
            enhanced: true,
            base64: enhancedBase64,
            mimeType: 'image/png',
            quality: analysis?.quality,
            imageType: analysis?.type
        };
    } catch (err) {
        console.warn('[enhance] Local enhancement failed, using original');
        return { enhanced: false, base64, mimeType: 'image/png', quality: analysis?.quality, imageType: analysis?.type };
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Expect: { pageImages, questions, enhanceImages?, forceEnhance?, aiRedraw? }
        const { pageImages, questions, enhanceImages: shouldEnhance = true, forceEnhance = false, aiRedraw = false } = await req.json();

        if (!pageImages || !questions || questions.length === 0) {
            return NextResponse.json({ success: true, images: {} });
        }

        console.log(`[extract-images] Processing ${questions.length} question images from ${pageImages.length} pages (enhance: ${shouldEnhance})`);

        const imageResults: Record<number, string> = {}; // questionIndex -> cloudinary URL
        const enhanceReport: Record<number, { enhanced: boolean; quality?: number; imageType?: string }> = {};

        for (const q of questions as QuestionImage[]) {
            try {
                const { questionIndex, imageBounds, page } = q;

                // Find the matching page image
                const pageImage = pageImages.find((p: any) => p.page === page);
                if (!pageImage || !pageImage.base64) {
                    console.warn(`[extract-images] No page image found for page ${page}`);
                    continue;
                }

                // Validate bounds
                if (!imageBounds || imageBounds.x == null || imageBounds.y == null || imageBounds.w == null || imageBounds.h == null) {
                    console.warn(`[extract-images] Invalid bounds for question ${questionIndex}`);
                    continue;
                }

                // Decode base64 to buffer
                const base64Data = pageImage.base64.includes(',')
                    ? pageImage.base64.split(',')[1]
                    : pageImage.base64;
                const imageBuffer = Buffer.from(base64Data, 'base64');

                // Get image dimensions
                const metadata = await sharp(imageBuffer).metadata();
                const imgWidth = metadata.width || 1000;
                const imgHeight = metadata.height || 1400;

                // Calculate crop region from percentage-based bounds
                // Add 5% margin on each side to avoid cutting labels/symbols
                const margin = 0.05;
                const bx = Math.max(0, imageBounds.x - margin);
                const by = Math.max(0, imageBounds.y - margin);
                const bw = Math.min(imageBounds.w + margin * 2, 1 - bx);
                const bh = Math.min(imageBounds.h + margin * 2, 1 - by);

                const left = Math.max(0, Math.round(bx * imgWidth));
                const top = Math.max(0, Math.round(by * imgHeight));
                const width = Math.min(Math.round(bw * imgWidth), imgWidth - left);
                const height = Math.min(Math.round(bh * imgHeight), imgHeight - top);

                if (width < 10 || height < 10) {
                    console.warn(`[extract-images] Crop region too small for question ${questionIndex}: ${width}x${height}`);
                    continue;
                }

                console.log(`[extract-images] Cropping Q${questionIndex}: ${left},${top} ${width}x${height} from ${imgWidth}x${imgHeight}`);

                // Crop using sharp
                const croppedBuffer = await sharp(imageBuffer)
                    .extract({ left, top, width, height })
                    .png()
                    .toBuffer();

                const croppedBase64 = croppedBuffer.toString('base64');

                // ── AI Enhancement (if enabled) ──────────────────────────
                let uploadBase64 = croppedBase64;
                let uploadMimeType = 'image/png';

                if (shouldEnhance) {
                    const questionText = (q as any).questionText || '';
                    const result = await enhanceImage(croppedBase64, questionText, forceEnhance, aiRedraw);
                    uploadBase64 = result.base64;
                    uploadMimeType = result.mimeType;
                    enhanceReport[questionIndex] = { enhanced: result.enhanced, quality: result.quality, imageType: result.imageType };
                }

                // Upload to Cloudinary
                const dataUri = `data:${uploadMimeType};base64,${uploadBase64}`;
                const uploadResult = await cloudinary.uploader.upload(dataUri, {
                    folder: 'merit-entrance/question-images',
                    resource_type: 'image',
                });

                imageResults[questionIndex] = uploadResult.secure_url;
                console.log(`[extract-images] Q${questionIndex} -> ${uploadResult.secure_url}${enhanceReport[questionIndex]?.enhanced ? ' (AI enhanced)' : ''}`);

            } catch (err: any) {
                console.error(`[extract-images] Failed for question ${q.questionIndex}:`, err.message);
                // Continue with other images
            }
        }

        return NextResponse.json({
            success: true,
            images: imageResults,
            enhancement: Object.keys(enhanceReport).length > 0 ? enhanceReport : undefined
        });

    } catch (error: any) {
        console.error('[extract-images] Error:', error);
        return NextResponse.json(
            { error: 'Failed to extract images', details: error.message },
            { status: 500 }
        );
    }
}

