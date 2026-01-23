import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// GET - Generate backup and optionally upload to cloud
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ error: 'Unauthorized - superadmin only' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const uploadToCloud = searchParams.get('upload') === 'true';

        console.log('Starting database backup...');
        const backup: Record<string, unknown[]> = {};

        // Backup each table
        try { backup.admins = await sql`SELECT * FROM admins`; } catch { backup.admins = []; }
        try { backup.students = await sql`SELECT * FROM students`; } catch { backup.students = []; }
        try { backup.exams = await sql`SELECT * FROM exams`; } catch { backup.exams = []; }
        try { backup.sections = await sql`SELECT * FROM sections`; } catch { backup.sections = []; }
        try { backup.questions = await sql`SELECT * FROM questions`; } catch { backup.questions = []; }
        try { backup.exam_schedules = await sql`SELECT * FROM exam_schedules`; } catch { backup.exam_schedules = []; }
        try { backup.exam_assignments = await sql`SELECT * FROM exam_assignments`; } catch { backup.exam_assignments = []; }
        try { backup.exam_attempts = await sql`SELECT * FROM exam_attempts`; } catch { backup.exam_attempts = []; }
        try { backup.question_responses = await sql`SELECT * FROM question_responses`; } catch { backup.question_responses = []; }
        try { backup.demo_content = await sql`SELECT * FROM demo_content`; } catch { backup.demo_content = []; }

        const backupData = JSON.stringify(backup, null, 2);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `merit-backup-${timestamp}.json`;

        // Calculate stats
        const stats = {
            admins: backup.admins.length,
            students: backup.students.length,
            exams: backup.exams.length,
            sections: backup.sections.length,
            questions: backup.questions.length,
            exam_schedules: backup.exam_schedules.length,
            exam_assignments: backup.exam_assignments.length,
            exam_attempts: backup.exam_attempts.length,
            question_responses: backup.question_responses.length,
            demo_content: backup.demo_content.length,
            size: (Buffer.byteLength(backupData) / 1024).toFixed(2) + ' KB',
            timestamp: new Date().toISOString(),
        };

        let cloudUrl = null;
        if (uploadToCloud) {
            // Upload to Cloudinary as raw file
            const base64Data = Buffer.from(backupData).toString('base64');
            const dataUri = `data:application/json;base64,${base64Data}`;

            const result = await cloudinary.uploader.upload(dataUri, {
                folder: 'merit-entrance/backups',
                resource_type: 'raw',
                public_id: filename.replace('.json', ''),
            });
            cloudUrl = result.secure_url;
        }

        return NextResponse.json({
            success: true,
            filename,
            stats,
            cloudUrl,
            data: uploadToCloud ? undefined : backup, // Only include data if not uploading
        });
    } catch (error) {
        console.error('Backup error:', error);
        return NextResponse.json({
            error: 'Backup failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// POST - Restore from backup
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ error: 'Unauthorized - superadmin only' }, { status: 401 });
        }

        const body = await request.json();
        const { backup, tables } = body;

        if (!backup || typeof backup !== 'object') {
            return NextResponse.json({ error: 'Invalid backup data' }, { status: 400 });
        }

        const results: Record<string, { inserted: number; errors: number }> = {};

        // Tables to restore in order (handle FK constraints)
        const restoreOrder = tables || [
            'admins', 'students', 'exams', 'sections', 'questions',
            'exam_schedules', 'exam_assignments', 'exam_attempts',
            'question_responses', 'demo_content'
        ];

        for (const tableName of restoreOrder) {
            if (!backup[tableName] || !Array.isArray(backup[tableName])) {
                continue;
            }

            results[tableName] = { inserted: 0, errors: 0 };

            for (const row of backup[tableName]) {
                try {
                    const columns = Object.keys(row);
                    const values = Object.values(row);

                    // Build insert query dynamically
                    const columnsStr = columns.map(c => `"${c}"`).join(', ');
                    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

                    // Use ON CONFLICT DO NOTHING to skip duplicates
                    await sql`
                        INSERT INTO ${sql.identifier([tableName])} 
                        SELECT * FROM jsonb_populate_record(null::${sql.identifier([tableName])}, ${JSON.stringify(row)}::jsonb)
                        ON CONFLICT DO NOTHING
                    `;
                    results[tableName].inserted++;
                } catch (e) {
                    results[tableName].errors++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Restore completed',
            results,
        });
    } catch (error) {
        console.error('Restore error:', error);
        return NextResponse.json({
            error: 'Restore failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// DELETE - List and manage cloud backups
export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ error: 'Unauthorized - superadmin only' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const publicId = searchParams.get('publicId');

        if (!publicId) {
            return NextResponse.json({ error: 'Public ID required' }, { status: 400 });
        }

        await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });

        return NextResponse.json({ success: true, message: 'Backup deleted' });
    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json({
            error: 'Delete failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
