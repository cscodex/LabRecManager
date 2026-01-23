import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

async function exportSchema() {
    console.log('Exporting database schema...\n');

    try {
        // Get all tables
        const tables = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `;

        console.log('-- MeritEntrance Database Schema Export');
        console.log('-- Generated:', new Date().toISOString());
        console.log('-- Tables:', tables.length);
        console.log('\n');

        for (const table of tables) {
            const tableName = table.table_name;

            // Get columns
            const columns = await sql`
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length
                FROM information_schema.columns 
                WHERE table_name = ${tableName}
                ORDER BY ordinal_position
            `;

            console.log(`-- Table: ${tableName}`);
            console.log(`CREATE TABLE IF NOT EXISTS ${tableName} (`);

            const colDefs: string[] = [];
            for (const col of columns) {
                let colDef = `    ${col.column_name} `;

                // Data type
                if (col.data_type === 'character varying' && col.character_maximum_length) {
                    colDef += `VARCHAR(${col.character_maximum_length})`;
                } else if (col.data_type === 'timestamp without time zone') {
                    colDef += 'TIMESTAMP';
                } else if (col.data_type === 'timestamp with time zone') {
                    colDef += 'TIMESTAMPTZ';
                } else {
                    colDef += col.data_type.toUpperCase();
                }

                // Not null
                if (col.is_nullable === 'NO') {
                    colDef += ' NOT NULL';
                }

                // Default
                if (col.column_default) {
                    colDef += ` DEFAULT ${col.column_default}`;
                }

                colDefs.push(colDef);
            }

            console.log(colDefs.join(',\n'));
            console.log(');\n');

            // Get indexes
            const indexes = await sql`
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = ${tableName}
                AND indexname NOT LIKE '%_pkey'
            `;

            for (const idx of indexes) {
                console.log(`${idx.indexdef};`);
            }

            console.log('\n');
        }

    } catch (error) {
        console.error('Schema export failed:', error);
        process.exit(1);
    }
}

exportSchema();
