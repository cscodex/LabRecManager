import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { neon } from '@neondatabase/serverless';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '100mb',
        },
    },
};

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function POST(request: NextRequest) {
    try {
        // Check Cloudinary config
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.error('Cloudinary environment variables not configured');
            return NextResponse.json({ error: 'Upload service not configured' }, { status: 500 });
        }

        const session = await getSession();
        if (!session || !['admin', 'superadmin'].includes(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const folder = formData.get('folder') as string || 'merit-entrance';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Check file size limit from DB
        let maxUploadLimitMB = 10; // Default fallback
        try {
            const settingsResult = await sql`SELECT value FROM system_settings WHERE key = 'pdfUploadLimitMB'`;
            if (settingsResult.length > 0) {
                // Settings are usually JSON stringified in the DB, e.g. "20"
                const parsedLimit = parseInt(settingsResult[0].value.replace(/"/g, ''));
                if (!isNaN(parsedLimit) && parsedLimit > 0) {
                    maxUploadLimitMB = parsedLimit;
                }
            }
        } catch (dbError) {
            console.warn('Failed to fetch upload limit from DB, using default 10MB', dbError);
        }

        if (file.size > maxUploadLimitMB * 1024 * 1024) {
            return NextResponse.json({ error: `File too large (max ${maxUploadLimitMB}MB)` }, { status: 400 });
        }

        console.log('Uploading file:', { name: file.name, size: file.size, type: file.type, folder });

        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Data = buffer.toString('base64');
        const mimeType = file.type;
        const dataUri = `data:${mimeType};base64,${base64Data}`;

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: folder,
            resource_type: 'auto',
        });

        console.log('Upload successful:', result.secure_url);

        return NextResponse.json({
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
        });
    } catch (error) {
        console.error('Upload error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorDetails = error instanceof Error && 'http_code' in error
            ? `Cloudinary error: ${(error as any).http_code}`
            : errorMessage;
        return NextResponse.json(
            { error: 'Upload failed', details: errorDetails },
            { status: 500 }
        );
    }
}

