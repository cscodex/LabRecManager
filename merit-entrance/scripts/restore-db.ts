import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

async function restoreDatabase() {
    const backupDir = path.join(__dirname, '../backups');

    // Find most recent backup
    const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .sort()
        .reverse();

    if (files.length === 0) {
        console.error('No backup files found in', backupDir);
        process.exit(1);
    }

    const backupFile = process.argv[2] || path.join(backupDir, files[0]);
    console.log('Restoring from:', backupFile);

    try {
        const backup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));

        // Restore each table with individual queries
        console.log('\nRestoring tables...\n');

        // Admins
        if (backup.admins?.length) {
            for (const row of backup.admins) {
                try {
                    await sql`INSERT INTO admins (id, email, password_hash, name, role, created_at) 
                        VALUES (${row.id}, ${row.email}, ${row.password_hash}, ${row.name}, ${row.role}, ${row.created_at})
                        ON CONFLICT (id) DO NOTHING`;
                } catch (e) { /* skip duplicates */ }
            }
            console.log(`  ✓ admins: ${backup.admins.length} rows processed`);
        }

        // Students
        if (backup.students?.length) {
            for (const row of backup.students) {
                try {
                    await sql`INSERT INTO students (id, roll_number, name, name_regional, email, phone, password_hash, photo_url, class, school, is_active, created_at) 
                        VALUES (${row.id}, ${row.roll_number}, ${row.name}, ${row.name_regional}, ${row.email}, ${row.phone}, ${row.password_hash}, ${row.photo_url}, ${row.class}, ${row.school}, ${row.is_active}, ${row.created_at})
                        ON CONFLICT (id) DO NOTHING`;
                } catch (e) { /* skip duplicates */ }
            }
            console.log(`  ✓ students: ${backup.students.length} rows processed`);
        }

        // Exams
        if (backup.exams?.length) {
            for (const row of backup.exams) {
                try {
                    await sql`INSERT INTO exams (id, title, description, instructions, duration, total_marks, passing_marks, negative_marking, shuffle_questions, "showResults", status, created_by, created_at, updated_at) 
                        VALUES (${row.id}, ${JSON.stringify(row.title)}::jsonb, ${row.description ? JSON.stringify(row.description) : null}::jsonb, ${row.instructions ? JSON.stringify(row.instructions) : null}::jsonb, ${row.duration}, ${row.total_marks}, ${row.passing_marks}, ${row.negative_marking}, ${row.shuffle_questions}, ${row.showResults}, ${row.status}, ${row.created_by}, ${row.created_at}, ${row.updated_at})
                        ON CONFLICT (id) DO NOTHING`;
                } catch (e) { /* skip duplicates */ }
            }
            console.log(`  ✓ exams: ${backup.exams.length} rows processed`);
        }

        // Sections
        if (backup.sections?.length) {
            for (const row of backup.sections) {
                try {
                    await sql`INSERT INTO sections (id, exam_id, name, "order", duration) 
                        VALUES (${row.id}, ${row.exam_id}, ${JSON.stringify(row.name)}::jsonb, ${row.order}, ${row.duration})
                        ON CONFLICT (id) DO NOTHING`;
                } catch (e) { /* skip duplicates */ }
            }
            console.log(`  ✓ sections: ${backup.sections.length} rows processed`);
        }

        // Questions
        if (backup.questions?.length) {
            for (const row of backup.questions) {
                try {
                    await sql`INSERT INTO questions (id, section_id, type, text, options, correct_answer, explanation, marks, negative_marks, image_url, "order") 
                        VALUES (${row.id}, ${row.section_id}, ${row.type}, ${JSON.stringify(row.text)}::jsonb, ${row.options ? JSON.stringify(row.options) : null}::jsonb, ${JSON.stringify(row.correct_answer)}::jsonb, ${row.explanation ? JSON.stringify(row.explanation) : null}::jsonb, ${row.marks}, ${row.negative_marks}, ${row.image_url}, ${row.order})
                        ON CONFLICT (id) DO NOTHING`;
                } catch (e) { /* skip duplicates */ }
            }
            console.log(`  ✓ questions: ${backup.questions.length} rows processed`);
        }

        // Exam schedules
        if (backup.exam_schedules?.length) {
            for (const row of backup.exam_schedules) {
                try {
                    await sql`INSERT INTO exam_schedules (id, exam_id, start_time, end_time) 
                        VALUES (${row.id}, ${row.exam_id}, ${row.start_time}, ${row.end_time})
                        ON CONFLICT (id) DO NOTHING`;
                } catch (e) { /* skip duplicates */ }
            }
            console.log(`  ✓ exam_schedules: ${backup.exam_schedules.length} rows processed`);
        }

        // Exam assignments
        if (backup.exam_assignments?.length) {
            for (const row of backup.exam_assignments) {
                try {
                    await sql`INSERT INTO exam_assignments (id, exam_id, student_id, assigned_at) 
                        VALUES (${row.id}, ${row.exam_id}, ${row.student_id}, ${row.assigned_at})
                        ON CONFLICT (id) DO NOTHING`;
                } catch (e) { /* skip duplicates */ }
            }
            console.log(`  ✓ exam_assignments: ${backup.exam_assignments.length} rows processed`);
        }

        // Exam attempts
        if (backup.exam_attempts?.length) {
            for (const row of backup.exam_attempts) {
                try {
                    await sql`INSERT INTO exam_attempts (id, exam_id, student_id, started_at, submitted_at, auto_submit, total_score, status) 
                        VALUES (${row.id}, ${row.exam_id}, ${row.student_id}, ${row.started_at}, ${row.submitted_at}, ${row.auto_submit}, ${row.total_score}, ${row.status})
                        ON CONFLICT (id) DO NOTHING`;
                } catch (e) { /* skip duplicates */ }
            }
            console.log(`  ✓ exam_attempts: ${backup.exam_attempts.length} rows processed`);
        }

        // Question responses
        if (backup.question_responses?.length) {
            for (const row of backup.question_responses) {
                try {
                    await sql`INSERT INTO question_responses (id, attempt_id, question_id, answer, marked_for_review, time_spent, is_correct, marks_awarded) 
                        VALUES (${row.id}, ${row.attempt_id}, ${row.question_id}, ${row.answer ? JSON.stringify(row.answer) : null}::jsonb, ${row.marked_for_review}, ${row.time_spent}, ${row.is_correct}, ${row.marks_awarded})
                        ON CONFLICT (id) DO NOTHING`;
                } catch (e) { /* skip duplicates */ }
            }
            console.log(`  ✓ question_responses: ${backup.question_responses.length} rows processed`);
        }

        console.log('\n✓ Restore completed!');

    } catch (error) {
        console.error('Restore failed:', error);
        process.exit(1);
    }
}

restoreDatabase();
