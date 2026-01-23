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
        // Get all tables
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `;

        console.log(`Found ${tables.length} tables to backup:\n`);

        for (const table of tables) {
            const tableName = table.table_name;
            try {
                const rows = await sql`SELECT * FROM ${sql.identifier([tableName])}`;
                backup[tableName] = rows;
                console.log(`  ✓ ${tableName}: ${rows.length} rows`);
            } catch (e) {
                console.log(`  ✗ ${tableName}: Error - ${e instanceof Error ? e.message : 'unknown'}`);
            }
        }

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
