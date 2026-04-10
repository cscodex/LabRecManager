import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    try {
        const user = await prisma.user.findFirst({ where: { role: 'admin' } });
        if (!user) throw new Error('No admin user found');
        
        console.log('Using real admin UUID:', user.id);
        
        const bpRes = await fetch('http://localhost:3000/api/admin/blueprints');
        const bpData = await bpRes.json();
        
        if (!bpData.success || !bpData.data || bpData.data.length === 0) {
            console.error("No blueprint exists to use as template!");
            return;
        }
        
        const blueprint = bpData.data[0];
        console.log(`Using Blueprint: ${blueprint.name}`);
        
        console.log('Sending generate request for Test-09...');
        const genRes = await fetch('http://localhost:3000/api/admin/exams/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                 blueprintId: blueprint.id,
                 title: 'Test-09',
                 description: 'RAG Generated AI Test for CBSE Computer Science',
                 duration: 60,
                 createdById: user.id,
                 allowAiGenerationForMissing: true
            })
        });
        
        const genData = await genRes.json();
        console.log('Generation Result:');
        console.log(JSON.stringify(genData, null, 2));
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
