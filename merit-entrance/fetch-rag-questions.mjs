import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    // Get the most recent AI-generated questions (source = 'ai_generated')
    const qs = await prisma.question.findMany({
        where: { source: 'ai_generated' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { tags: true },
    });

    if (qs.length === 0) {
        // Fallback: just get the 10 most recent questions regardless
        const recent = await prisma.question.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        console.log('No ai_generated questions found. Most recent 10 questions:');
        for (const q of recent) {
            console.log('\n---');
            console.log('ID:', q.id);
            console.log('Type:', q.type);
            console.log('Source:', q.source);
            console.log('Text:', q.text?.substring(0, 200));
            console.log('Options:', JSON.stringify(q.options));
            console.log('Answer:', q.correctAnswer);
            console.log('Created:', q.createdAt);
        }
    } else {
        console.log(`Found ${qs.length} AI-generated questions:\n`);
        for (const q of qs) {
            console.log('---');
            console.log('ID:', q.id);
            console.log('Type:', q.type);
            console.log('Difficulty:', q.difficulty);
            console.log('Question:', q.text);
            console.log('Options:', JSON.stringify(q.options));
            console.log('Correct Answer:', q.correctAnswer);
            console.log('Tags:', q.tags?.map(t => t.tagId).join(', '));
            console.log('Created:', q.createdAt);
            console.log('');
        }
    }

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
