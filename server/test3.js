const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    try {
        const school = await prisma.school.findFirst();
        if(!school) { console.log('No school'); return; }
        const user = await prisma.user.create({
            data: {
                email: 'instructor9000@school.com',
                passwordHash: 'dummy',
                firstName: 'Test',
                lastName: 'Instructor',
                role: 'instructor',
                schoolId: school.id,
                preferredLanguage: 'en'
            }
        });
        console.log('SUCCESS USER', user.id);
    } catch(err) {
        console.error('ERROR:', err);
    } finally {
        await prisma.$disconnect();
    }
}
run();
