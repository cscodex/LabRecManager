import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// GET - List all cloud backups
export async function GET() {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ error: 'Unauthorized - superadmin only' }, { status: 401 });
        }

        // List all backups from Cloudinary
        const result = await cloudinary.api.resources({
            type: 'upload',
            resource_type: 'raw',
            prefix: 'merit-entrance/backups/',
            max_results: 50,
        });

        const backups = result.resources.map((r: { public_id: string; secure_url: string; created_at: string; bytes: number }) => ({
            publicId: r.public_id,
            url: r.secure_url,
            createdAt: r.created_at,
            size: (r.bytes / 1024).toFixed(2) + ' KB',
        }));

        return NextResponse.json({
            success: true,
            backups: backups.sort((a: { createdAt: string }, b: { createdAt: string }) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ),
        });
    } catch (error) {
        console.error('List backups error:', error);
        return NextResponse.json({
            error: 'Failed to list backups',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
