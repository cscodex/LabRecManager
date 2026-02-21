import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Expect: { pageImages: [{page, base64}], questions: [{questionIndex, imageBounds, page}] }
        const { pageImages, questions } = await req.json();

        if (!pageImages || !questions || questions.length === 0) {
            return NextResponse.json({ success: true, images: {} });
        }

        console.log(`[extract-images] Processing ${questions.length} question images from ${pageImages.length} pages`);

        const imageResults: Record<number, string> = {}; // questionIndex -> cloudinary URL

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

                // Upload to Cloudinary
                const base64Cropped = `data:image/png;base64,${croppedBuffer.toString('base64')}`;
                const uploadResult = await cloudinary.uploader.upload(base64Cropped, {
                    folder: 'merit-entrance/question-images',
                    resource_type: 'image',
                });

                imageResults[questionIndex] = uploadResult.secure_url;
                console.log(`[extract-images] Q${questionIndex} -> ${uploadResult.secure_url}`);

            } catch (err: any) {
                console.error(`[extract-images] Failed for question ${q.questionIndex}:`, err.message);
                // Continue with other images
            }
        }

        return NextResponse.json({
            success: true,
            images: imageResults
        });

    } catch (error: any) {
        console.error('[extract-images] Error:', error);
        return NextResponse.json(
            { error: 'Failed to extract images', details: error.message },
            { status: 500 }
        );
    }
}
