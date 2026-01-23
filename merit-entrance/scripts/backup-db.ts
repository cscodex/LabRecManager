import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

async function backupDatabase() {
    console.log('Starting database backup...\n');
    const backupDir = path.join(__dirname, '../backups');

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);

    const backup: Record<string, unknown[]> = {};

    try {
        // Backup each table with individual queries
        console.log('Backing up tables:\n');

        // Admins
        try { backup.admins = await sql`SELECT * FROM admins`; console.log(`  ✓ admins: ${backup.admins.length} rows`); }
        catch (e) { backup.admins = []; console.log(`  ○ admins: skipped`); }

        // Students
        try { backup.students = await sql`SELECT * FROM students`; console.log(`  ✓ students: ${backup.students.length} rows`); }
        catch (e) { backup.students = []; console.log(`  ○ students: skipped`); }

        // Exams
        try { backup.exams = await sql`SELECT * FROM exams`; console.log(`  ✓ exams: ${backup.exams.length} rows`); }
        catch (e) { backup.exams = []; console.log(`  ○ exams: skipped`); }

        // Sections
        try { backup.sections = await sql`SELECT * FROM sections`; console.log(`  ✓ sections: ${backup.sections.length} rows`); }
        catch (e) { backup.sections = []; console.log(`  ○ sections: skipped`); }

        // Questions
        try { backup.questions = await sql`SELECT * FROM questions`; console.log(`  ✓ questions: ${backup.questions.length} rows`); }
        catch (e) { backup.questions = []; console.log(`  ○ questions: skipped`); }

        // Exam Schedules
        try { backup.exam_schedules = await sql`SELECT * FROM exam_schedules`; console.log(`  ✓ exam_schedules: ${backup.exam_schedules.length} rows`); }
        catch (e) { backup.exam_schedules = []; console.log(`  ○ exam_schedules: skipped`); }

        // Exam Assignments
        try { backup.exam_assignments = await sql`SELECT * FROM exam_assignments`; console.log(`  ✓ exam_assignments: ${backup.exam_assignments.length} rows`); }
        catch (e) { backup.exam_assignments = []; console.log(`  ○ exam_assignments: skipped`); }

        // Exam Attempts
        try { backup.exam_attempts = await sql`SELECT * FROM exam_attempts`; console.log(`  ✓ exam_attempts: ${backup.exam_attempts.length} rows`); }
        catch (e) { backup.exam_attempts = []; console.log(`  ○ exam_attempts: skipped`); }

        // Question Responses
        try { backup.question_responses = await sql`SELECT * FROM question_responses`; console.log(`  ✓ question_responses: ${backup.question_responses.length} rows`); }
        catch (e) { backup.question_responses = []; console.log(`  ○ question_responses: skipped`); }

        // Demo Content
        try { backup.demo_content = await sql`SELECT * FROM demo_content`; console.log(`  ✓ demo_content: ${backup.demo_content.length} rows`); }
        catch (e) { backup.demo_content = []; console.log(`  ○ demo_content: skipped`); }

        // Query Logs
        try { backup.query_logs = await sql`SELECT * FROM query_logs`; console.log(`  ✓ query_logs: ${backup.query_logs.length} rows`); }
        catch (e) { backup.query_logs = []; console.log(`  ○ query_logs: skipped`); }

        // Save backup
        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
        console.log(`\n✓ Backup saved to: ${backupFile}`);
        console.log(`  Size: ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB`);

    } catch (error) {
        console.error('Backup failed:', error);
        process.exit(1);
    }
}

backupDatabase();
