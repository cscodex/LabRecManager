import { prisma } from './src/lib/prisma';
import fs from 'fs';
import path from 'path';

async function run() {
    try {
        const query = fs.readFileSync(path.join(__dirname, 'prisma', 'update_exam_blueprints.sql'), 'utf-8');
        console.log('Running SQL...');
        const statements = query.split(';').filter(str => str.trim().length > 0);
        for (let stmt of statements) {
            console.log('Executing:', stmt.slice(0, 50));
            await prisma.$executeRawUnsafe(stmt);
        }
        console.log('SQL executed successfully');
    } catch (e) {
        console.error('Error executing SQL', e);
    } finally {
        process.exit(0);
    }
}

run();
