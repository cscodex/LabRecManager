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

        // Define restore order (handle foreign keys)
        const restoreOrder = [
            'admins',
            'students',
            'exams',
            'sections',
            'questions',
            'exam_schedules',
            'exam_assignments',
            'exam_attempts',
            'question_responses',
            'demo_content',
            'query_logs'
        ];

        // Restore in order
        for (const tableName of restoreOrder) {
            if (backup[tableName] && backup[tableName].length > 0) {
                console.log(`\nRestoring ${tableName}...`);

                const rows = backup[tableName];
                const columns = Object.keys(rows[0]);

                for (const row of rows) {
                    try {
                        const values = columns.map(c => row[c]);
                        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

                        // Use raw query for dynamic table/column names
                        await sql`
                            INSERT INTO ${sql.identifier([tableName])} (${sql.identifier(columns)})
                            VALUES (${sql.join(values, sql`, `)})
                            ON CONFLICT DO NOTHING
                        `;
                    } catch (e) {
                        // Skip duplicate key errors
                        console.log(`    Skipped row (may already exist)`);
                    }
                }

                console.log(`  ✓ ${tableName}: ${rows.length} rows processed`);
            }
        }

        console.log('\n✓ Restore completed!');

    } catch (error) {
        console.error('Restore failed:', error);
        process.exit(1);
    }
}

restoreDatabase();
