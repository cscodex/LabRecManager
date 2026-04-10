const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function run() {
    try {
        const schoolId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
        const adminId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
        
        // Mock payload that frontend sends
        const payload = {
            firstName: 'Testing',
            lastName: 'Instructor',
            email: 'new-instructor@school.com',
            role: 'instructor',
            password: 'password123',
            employeeId: 'EMP-999'
        };

        console.log('--- Testing Duplicate Email ---');
        // Check if email exists
        const existing = await prisma.user.findUnique({
            where: { email: payload.email }
        });
        if (existing) {
            console.log('ERROR: Email already exists');
        } else {
            console.log('Email is available');
        }

        console.log('--- Simulating User Creation ---');
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(payload.password, salt);

        const newUser = await prisma.user.create({
            data: {
                email: payload.email,
                passwordHash,
                firstName: payload.firstName,
                lastName: payload.lastName,
                role: payload.role,
                schoolId: schoolId,
                employeeId: payload.employeeId,
                preferredLanguage: 'en'
            }
        });
        console.log('SUCCESS: User created with ID:', newUser.id);

        // Cleanup
        await prisma.user.delete({ where: { id: newUser.id } });
        console.log('Cleanup: Deleted test user');

    } catch (err) {
        console.error('CRASH ERROR:', err.name, err.message, err.code);
    } finally {
        await prisma.$disconnect();
    }
}
run();
