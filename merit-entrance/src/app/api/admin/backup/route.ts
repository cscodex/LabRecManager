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

        // SCHEMA DEFINITIONS
        sqlDump += `
// Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS "query_logs" CASCADE;
DROP TABLE IF EXISTS "demo_content" CASCADE;
DROP TABLE IF EXISTS "question_responses" CASCADE;
DROP TABLE IF EXISTS "exam_attempts" CASCADE;
DROP TABLE IF EXISTS "exam_assignments" CASCADE;
DROP TABLE IF EXISTS "exam_schedules" CASCADE;
DROP TABLE IF EXISTS "questions" CASCADE;
DROP TABLE IF EXISTS "paragraphs" CASCADE;
DROP TABLE IF EXISTS "sections" CASCADE;
DROP TABLE IF EXISTS "exams" CASCADE;
DROP TABLE IF EXISTS "students" CASCADE;
DROP TABLE IF EXISTS "admins" CASCADE;

-- Create functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Admins (Same as before)
CREATE TABLE "admins" ( ... ); 
-- (I should probably keep the existing text for unchanged tables to avoid huge replacement, but replace_file_content works on blocks)

-- Let's replace the Schema Definition Block
`;
        // ... (Re-construct the schema string carefully)
        // I will provide the FULL schema string replacement to be safe.

        sqlDump += `
-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS "query_logs" CASCADE;
DROP TABLE IF EXISTS "demo_content" CASCADE;
DROP TABLE IF EXISTS "question_responses" CASCADE;
DROP TABLE IF EXISTS "exam_attempts" CASCADE;
DROP TABLE IF EXISTS "exam_assignments" CASCADE;
DROP TABLE IF EXISTS "exam_schedules" CASCADE;
DROP TABLE IF EXISTS "questions" CASCADE;
DROP TABLE IF EXISTS "paragraphs" CASCADE;
DROP TABLE IF EXISTS "sections" CASCADE;
DROP TABLE IF EXISTS "exams" CASCADE;
DROP TABLE IF EXISTS "students" CASCADE;
DROP TABLE IF EXISTS "admins" CASCADE;

-- Create functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Admins
CREATE TABLE "admins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- 2. Students
CREATE TABLE "students" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roll_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_regional" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "photo_url" TEXT,
    "class" TEXT,
    "school" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "students_roll_number_key" ON "students"("roll_number");

-- 3. Exams
CREATE TABLE "exams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" JSONB NOT NULL,
    "description" JSONB,
    "duration" INTEGER NOT NULL,
    "total_marks" INTEGER NOT NULL,
    "passing_marks" INTEGER,
    "negative_marking" DECIMAL(3,2),
    "shuffle_questions" BOOLEAN NOT NULL DEFAULT false,
    "showResults" TEXT NOT NULL DEFAULT 'after_submit',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "instructions" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "exams" ADD CONSTRAINT "exams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Sections
CREATE TABLE "sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exam_id" UUID NOT NULL,
    "name" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "duration" INTEGER,
    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "sections" ADD CONSTRAINT "sections_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Paragraphs (New)
CREATE TABLE "paragraphs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "text" JSONB NOT NULL,
  "content" JSONB,
  "image_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "paragraphs_pkey" PRIMARY KEY ("id")
);

-- 6. Questions (Updated)
CREATE TABLE "questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "section_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "text" JSONB NOT NULL,
    "options" JSONB,
    "correct_answer" JSONB NOT NULL,
    "explanation" JSONB,
    "marks" INTEGER NOT NULL DEFAULT 1,
    "negative_marks" DECIMAL(3,2),
    "image_url" TEXT,
    "parent_id" UUID,
    "paragraph_id" UUID,
    "order" INTEGER NOT NULL,
    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "questions" ADD CONSTRAINT "questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "questions" ADD CONSTRAINT "questions_paragraph_id_fkey" FOREIGN KEY ("paragraph_id") REFERENCES "paragraphs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. Exam Schedules
CREATE TABLE "exam_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exam_id" UUID NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "exam_schedules_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Exam Assignments
CREATE TABLE "exam_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exam_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "schedule_id" UUID,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exam_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "exam_assignments_exam_id_student_id_schedule_id_key" ON "exam_assignments"("exam_id", "student_id", "schedule_id");
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "exam_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 9. Exam Attempts
CREATE TABLE "exam_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exam_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ,
    "auto_submit" BOOLEAN NOT NULL DEFAULT false,
    "total_score" DECIMAL(6,2),
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "exam_attempts_exam_id_status_idx" ON "exam_attempts"("exam_id", "status");
CREATE UNIQUE INDEX "exam_attempts_exam_id_student_id_key" ON "exam_attempts"("exam_id", "student_id"); 
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 10. Question Responses
CREATE TABLE "question_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer" JSONB,
    "marked_for_review" BOOLEAN NOT NULL DEFAULT false,
    "time_spent" INTEGER,
    "is_correct" BOOLEAN,
    "marks_awarded" DECIMAL(5,2),
    CONSTRAINT "question_responses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "question_responses_attempt_id_question_id_key" ON "question_responses"("attempt_id", "question_id");
ALTER TABLE "question_responses" ADD CONSTRAINT "question_responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "question_responses" ADD CONSTRAINT "question_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 11. Demo Content
CREATE TABLE "demo_content" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "content_type" VARCHAR(50) NOT NULL DEFAULT 'general',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "demo_content_pkey" PRIMARY KEY ("id")
);

-- 12. Query Logs
CREATE TABLE "query_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route" VARCHAR(255) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "query" TEXT,
    "params" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "duration" INTEGER,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "query_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "query_logs_success_created_at_idx" ON "query_logs"("success", "created_at");
CREATE INDEX "query_logs_route_idx" ON "query_logs"("route");

`;

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
            'admins', 'students', 'exams', 'sections', 'paragraphs', 'questions',
            'exam_schedules', 'exam_assignments', 'exam_attempts',
            'question_responses', 'demo_content', 'query_logs'
        ];

        // Fetch data for each table explicitly to satisfy tagged template requirement
        const tableData: Record<string, any[]> = {};
        try { tableData.admins = await sql`SELECT * FROM admins`; } catch { tableData.admins = []; }
        try { tableData.students = await sql`SELECT * FROM students`; } catch { tableData.students = []; }
        try { tableData.exams = await sql`SELECT * FROM exams`; } catch { tableData.exams = []; }
        try { tableData.sections = await sql`SELECT * FROM sections`; } catch { tableData.sections = []; }
        try { tableData.paragraphs = await sql`SELECT * FROM paragraphs`; } catch { tableData.paragraphs = []; }
        try { tableData.questions = await sql`SELECT * FROM questions`; } catch { tableData.questions = []; }
        try { tableData.exam_schedules = await sql`SELECT * FROM exam_schedules`; } catch { tableData.exam_schedules = []; }
        try { tableData.exam_assignments = await sql`SELECT * FROM exam_assignments`; } catch { tableData.exam_assignments = []; }
        try { tableData.exam_attempts = await sql`SELECT * FROM exam_attempts`; } catch { tableData.exam_attempts = []; }
        try { tableData.question_responses = await sql`SELECT * FROM question_responses`; } catch { tableData.question_responses = []; }
        try { tableData.demo_content = await sql`SELECT * FROM demo_content`; } catch { tableData.demo_content = []; }
        try { tableData.query_logs = await sql`SELECT * FROM query_logs`; } catch { tableData.query_logs = []; }

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

        // Restore paragraphs (New)
        if (backup.paragraphs?.length) {
            results.paragraphs = { inserted: 0, errors: 0 };
            for (const row of backup.paragraphs) {
                try {
                    await sql`INSERT INTO paragraphs (id, text, content, image_url, created_at, updated_at) 
                        VALUES (${row.id}, ${JSON.stringify(row.text)}::jsonb, ${row.content ? JSON.stringify(row.content) : null}::jsonb, ${row.image_url}, ${row.created_at}, ${row.updated_at})
                        ON CONFLICT (id) DO NOTHING`;
                    results.paragraphs.inserted++;
                } catch { results.paragraphs.errors++; }
            }
        }

        // Restore questions (Updated)
        if (backup.questions?.length) {
            results.questions = { inserted: 0, errors: 0 };
            for (const row of backup.questions) {
                try {
                    await sql`INSERT INTO questions (id, section_id, type, text, options, correct_answer, explanation, marks, negative_marks, image_url, order, parent_id, paragraph_id) 
                        VALUES (${row.id}, ${row.section_id}, ${row.type}, ${JSON.stringify(row.text)}::jsonb, ${row.options ? JSON.stringify(row.options) : null}::jsonb, ${JSON.stringify(row.correct_answer)}::jsonb, ${row.explanation ? JSON.stringify(row.explanation) : null}::jsonb, ${row.marks}, ${row.negative_marks}, ${row.image_url}, ${row.order}, ${row.parent_id}, ${row.paragraph_id})
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
