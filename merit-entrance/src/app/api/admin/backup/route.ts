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

// POST - Restore from backup (simplified - complex restore should use CLI script)
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ error: 'Unauthorized - superadmin only' }, { status: 401 });
        }

        const body = await request.json();
        const { backup } = body;

        if (!backup || typeof backup !== 'object') {
            return NextResponse.json({ error: 'Invalid backup data' }, { status: 400 });
        }

        const results: Record<string, { inserted: number; errors: number }> = {};

        // Restore admins
        if (backup.admins?.length) {
            results.admins = { inserted: 0, errors: 0 };
            for (const row of backup.admins) {
                try {
                    await sql`INSERT INTO admins (id, email, password_hash, name, role, created_at) 
                        VALUES (${row.id}, ${row.email}, ${row.password_hash}, ${row.name}, ${row.role}, ${row.created_at})
                        ON CONFLICT (id) DO NOTHING`;
                    results.admins.inserted++;
                } catch { results.admins.errors++; }
            }
        }

        // Restore students
        if (backup.students?.length) {
            results.students = { inserted: 0, errors: 0 };
            for (const row of backup.students) {
                try {
                    await sql`INSERT INTO students (id, roll_number, name, name_regional, email, phone, password_hash, photo_url, class, school, is_active, created_at) 
                        VALUES (${row.id}, ${row.roll_number}, ${row.name}, ${row.name_regional}, ${row.email}, ${row.phone}, ${row.password_hash}, ${row.photo_url}, ${row.class}, ${row.school}, ${row.is_active}, ${row.created_at})
                        ON CONFLICT (id) DO NOTHING`;
                    results.students.inserted++;
                } catch { results.students.errors++; }
            }
        }

        // Restore exams
        if (backup.exams?.length) {
            results.exams = { inserted: 0, errors: 0 };
            for (const row of backup.exams) {
                try {
                    await sql`INSERT INTO exams (id, title, description, instructions, duration, total_marks, passing_marks, negative_marking, shuffle_questions, "showResults", status, created_by, created_at, updated_at) 
                        VALUES (${row.id}, ${JSON.stringify(row.title)}::jsonb, ${row.description ? JSON.stringify(row.description) : null}::jsonb, ${row.instructions ? JSON.stringify(row.instructions) : null}::jsonb, ${row.duration}, ${row.total_marks}, ${row.passing_marks}, ${row.negative_marking}, ${row.shuffle_questions}, ${row.showResults}, ${row.status}, ${row.created_by}, ${row.created_at}, ${row.updated_at})
                        ON CONFLICT (id) DO NOTHING`;
                    results.exams.inserted++;
                } catch { results.exams.errors++; }
            }
        }

        // Restore sections
        if (backup.sections?.length) {
            results.sections = { inserted: 0, errors: 0 };
            for (const row of backup.sections) {
                try {
                    await sql`INSERT INTO sections (id, exam_id, name, "order", duration) 
                        VALUES (${row.id}, ${row.exam_id}, ${JSON.stringify(row.name)}::jsonb, ${row.order}, ${row.duration})
                        ON CONFLICT (id) DO NOTHING`;
                    results.sections.inserted++;
                } catch { results.sections.errors++; }
            }
        }

        // Restore questions
        if (backup.questions?.length) {
            results.questions = { inserted: 0, errors: 0 };
            for (const row of backup.questions) {
                try {
                    await sql`INSERT INTO questions (id, section_id, type, text, options, correct_answer, explanation, marks, negative_marks, image_url, "order") 
                        VALUES (${row.id}, ${row.section_id}, ${row.type}, ${JSON.stringify(row.text)}::jsonb, ${row.options ? JSON.stringify(row.options) : null}::jsonb, ${JSON.stringify(row.correct_answer)}::jsonb, ${row.explanation ? JSON.stringify(row.explanation) : null}::jsonb, ${row.marks}, ${row.negative_marks}, ${row.image_url}, ${row.order})
                        ON CONFLICT (id) DO NOTHING`;
                    results.questions.inserted++;
                } catch { results.questions.errors++; }
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
