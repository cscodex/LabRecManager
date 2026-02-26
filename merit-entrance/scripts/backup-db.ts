import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const connectionString = process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '';

async function backupDatabase() {
    console.log('Starting comprehensive database backup using pg client...\n');
    const backupDir = path.join(process.cwd(), 'backups');

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-full-${timestamp}.json`);

    const backup: Record<string, unknown[]> = {};
    const client = new Client({ connectionString });

    try {
        await client.connect();

        // Fetch all tables dynamically
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name NOT LIKE '\\_%'
        `);

        const tables = tablesResult.rows.map(t => t.table_name);
        console.log(`Found ${tables.length} tables. Backing up data:\n`);

        for (const tableName of tables) {
            try {
                const rowsRes = await client.query(`SELECT * FROM "${tableName}"`);
                backup[tableName] = rowsRes.rows;
                console.log(`  ✓ ${tableName}: ${rowsRes.rows.length} rows`);
            } catch (e: any) {
                backup[tableName] = [];
                console.log(`  ○ ${tableName}: skipped (${e.message})`);
            }
        }

        // Save backup
        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
        console.log(`\n✓ Backup saved to: ${backupFile}`);
        console.log(`  Size: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(3)} MB`);

    } catch (error) {
        console.error('Backup failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

backupDatabase();
