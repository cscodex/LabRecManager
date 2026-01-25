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

// GET - Generate SQL backup and optionally upload to cloud
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ error: 'Unauthorized - superadmin only' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const uploadToCloud = searchParams.get('upload') === 'true';

        console.log('Starting database backup...');
        let sqlDump = `-- Merit Entrance Database Backup\n-- Generated at: ${new Date().toISOString()}\n\n`;

        // Helper to escape string for SQL
        const escape = (val: any) => {
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            // Handle timestamps
            if (val instanceof Date) return `'${val.toISOString()}'`;
            return `'${String(val).replace(/'/g, "''")}'`;
        };

        // Table definitions and data
        const tables = [
            'admins', 'students', 'exams', 'sections', 'questions',
            'exam_schedules', 'exam_assignments', 'exam_attempts',
            'question_responses', 'demo_content'
        ];

        // Fetch data for each table explicitly to satisfy tagged template requirement
        const tableData: Record<string, any[]> = {};
        try { tableData.admins = await sql`SELECT * FROM admins`; } catch { tableData.admins = []; }
        try { tableData.students = await sql`SELECT * FROM students`; } catch { tableData.students = []; }
        try { tableData.exams = await sql`SELECT * FROM exams`; } catch { tableData.exams = []; }
        try { tableData.sections = await sql`SELECT * FROM sections`; } catch { tableData.sections = []; }
        try { tableData.questions = await sql`SELECT * FROM questions`; } catch { tableData.questions = []; }
        try { tableData.exam_schedules = await sql`SELECT * FROM exam_schedules`; } catch { tableData.exam_schedules = []; }
        try { tableData.exam_assignments = await sql`SELECT * FROM exam_assignments`; } catch { tableData.exam_assignments = []; }
        try { tableData.exam_attempts = await sql`SELECT * FROM exam_attempts`; } catch { tableData.exam_attempts = []; }
        try { tableData.question_responses = await sql`SELECT * FROM question_responses`; } catch { tableData.question_responses = []; }
        try { tableData.demo_content = await sql`SELECT * FROM demo_content`; } catch { tableData.demo_content = []; }

        for (const table of tables) {
            try {
                // Get table schema (simplified - strictly we'd query information_schema, 
                // but simpler to just dump data for restore if schema exists, 
                // or user can use prisma db push for schema)
                sqlDump += `\n-- Data for table: ${table}\n`;

                const rows = tableData[table];

                if (rows && rows.length > 0) {
                    const columns = Object.keys(rows[0]);
                    sqlDump += `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES\n`;

                    const values = rows.map((row: any) => {
                        return `(${columns.map(col => escape(row[col])).join(', ')})`;
                    }).join(',\n');

                    sqlDump += values + ';\n';
                }
            } catch (e) {
                console.error(`Error banking up table ${table}:`, e);
                sqlDump += `\n-- Error banking up table ${table}\n`;
            }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `merit-full-backup-${timestamp}.sql`;
        const size = (Buffer.byteLength(sqlDump) / 1024).toFixed(2) + ' KB';

        let cloudUrl = null;
        if (uploadToCloud) {
            // Upload to Cloudinary as raw file
            const base64Data = Buffer.from(sqlDump).toString('base64');
            const dataUri = `data:text/plain;base64,${base64Data}`;

            const result = await cloudinary.uploader.upload(dataUri, {
                folder: 'merit-entrance/backups',
                resource_type: 'raw',
                public_id: filename.replace('.sql', ''),
                format: 'sql'
            });
            cloudUrl = result.secure_url;
        }

        return NextResponse.json({
            success: true,
            filename,
            stats: {
                size,
                timestamp: new Date().toISOString(),
                tableCount: tables.length
            },
            cloudUrl,
            data: uploadToCloud ? undefined : sqlDump, // Return SQL string if not uploading
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
