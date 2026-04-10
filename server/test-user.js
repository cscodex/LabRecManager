const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    try {
        const user = await prisma.user.create({
            data: {
                email: 'testinstructor10@school.com',
                passwordHash: 'dummy',
                firstName: 'Test',
                lastName: 'Instructor',
                role: 'instructor',
                schoolId: '1fb93f41-0f73-4f24-8b6b-31d77a06f376', // need a valid schoolId
                phone: undefined,
                admissionNumber: undefined,
                studentId: undefined, // test undefined
                employeeId: undefined,
                preferredLanguage: 'en'
            }
        });
        console.log("Success:", user);
    } catch (err) {
        console.error("Prisma Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}
run();
