const { Pool, neonConfig } = require('@neondatabase/serverless');
const { PrismaNeon } = require('@prisma/adapter-neon');
const { PrismaClient } = require('@prisma/client');
const ws = require('ws');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

neonConfig.webSocketConstructor = ws;

async function main() {
    const connectionString = process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL or MERIT_DATABASE_URL not set in .env");
    } else {
        console.log('Using connection string starting with:', connectionString.substring(0, 15) + '...');
    }

    const pool = new Pool({ connectionString });
    const adapter = new PrismaNeon(pool);
    const prisma = new PrismaClient({ adapter });

    const args = process.argv.slice(2);
    const sqlFile = args[0] || 'update_exam_types.sql';
    const sqlPath = path.join(__dirname, '../', sqlFile.startsWith('database/') ? sqlFile : `database/${sqlFile}`);
    console.log(`Reading SQL from ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    const statements = sql
        .split(/;\s*$/m)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    console.log(`Found ${statements.length} statements.`);

    for (const statement of statements) {
        try {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            await prisma.$executeRawUnsafe(statement);
            console.log('Success.');
        } catch (e) {
            console.error('Error executing statement:', e.message);
        }
    }

    await prisma.$disconnect();
}

main().catch(console.error);
