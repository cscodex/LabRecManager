const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const exams = await prisma.exam.findMany({
        where: {
            title: {
                path: ['en'],
                string_contains: 'GATE'
            }
        },
        select: {
            id: true,
            title: true
        }
    });
    console.log(JSON.stringify(exams, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
