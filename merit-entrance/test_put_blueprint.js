require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaNeonHttp } = require('@prisma/adapter-neon');
const { neon } = require('@neondatabase/serverless');

async function runTest() {
    const connectionString = process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL;
    const neonClient = neon(connectionString);
    const adapter = new PrismaNeonHttp(neonClient);
    const prisma = new PrismaClient({ adapter });

    try {
        console.log("Looking for blueprint...");
        const bp = await prisma.examBlueprint.findFirst({ include: { sections: { include: { rules: { include: { topicTags: true } } } } } });
        if(!bp) { console.log("No blueprint found"); return; }
        
        console.log("Found:", bp.id);
        
        console.log("Running nested connect...");
        try {
            await prisma.examBlueprint.update({
                where: { id: bp.id },
                data: {
                    sections: {
                        create: {
                            name: { en: "Test" },
                            order: 10,
                            rules: {
                                create: {
                                    questionType: "mcq_single",
                                    numberOfQuestions: 1,
                                    marksPerQuestion: 1,
                                    topicTags: { connect: [{ id: bp.sections[0]?.rules[0]?.topicTags[0]?.id || '123' }] }
                                }
                            }
                        }
                    }
                }
            });
            console.log("Update nested worked!");
        } catch(e) {
            console.log("Error on nested connect:", e.message);
        }

        console.log("Running deleteMany sections...");
        try {
            await prisma.blueprintSection.deleteMany({ where: { blueprintId: bp.id } });
            console.log("deleteMany worked!");
        } catch(e) {
            console.log("Error on deleteMany:", e.message);
        }
        
    } catch(e) {
        console.error("General error:", e);
    }
}
runTest();
