/**
 * Student Profile Helper
 * Creates default profile components when a student is created
 */

const prisma = require('../config/database');

/**
 * Generate avatar URL based on user's name
 */
function generateAvatarUrl(firstName, lastName) {
    const name = encodeURIComponent(`${firstName} ${lastName}`);
    return `https://ui-avatars.com/api/?name=${name}&background=random&color=fff&size=128`;
}

/**
 * Generate a 6-digit PIN for password reset
 */
function generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create profile extras for a new student
 * - Sets default avatar
 * - Creates device test record
 * - Notifies admin
 */
async function createStudentProfileExtras(userId, firstName, lastName, schoolId, creatorId) {
    try {
        // 1. Set default avatar if not already set
        const avatarUrl = generateAvatarUrl(firstName, lastName);
        await prisma.user.update({
            where: { id: userId },
            data: { profileImageUrl: avatarUrl }
        });

        // 2. Create device test record with default values
        await prisma.deviceTest.upsert({
            where: { userId },
            update: {},
            create: {
                userId,
                cameraStatus: null,
                micStatus: null,
                speakerStatus: null
            }
        });

        // 3. Notify admin about new user
        // Find admins in the same school
        const admins = await prisma.user.findMany({
            where: {
                schoolId,
                role: { in: ['admin', 'principal'] },
                isActive: true
            },
            select: { id: true }
        });

        // Create notifications for each admin
        for (const admin of admins) {
            await prisma.notification.create({
                data: {
                    userId: admin.id,
                    channel: 'push',
                    recipient: admin.id,
                    subject: 'New Student Created',
                    body: `New student account created: ${firstName} ${lastName}`,
                    status: 'pending'
                }
            });
        }

        return { avatarUrl, deviceTestCreated: true, notificationsSent: admins.length };
    } catch (error) {
        console.error('Error creating profile extras:', error.message);
        return { error: error.message };
    }
}

/**
 * Create profile extras for multiple students (bulk import)
 */
async function createBulkProfileExtras(users, schoolId, creatorId) {
    const results = { processed: 0, failed: 0 };

    for (const user of users) {
        try {
            await createStudentProfileExtras(user.id, user.firstName, user.lastName, schoolId, creatorId);
            results.processed++;
        } catch (error) {
            results.failed++;
        }
    }

    // Send single summary notification to admins
    const admins = await prisma.user.findMany({
        where: {
            schoolId,
            role: { in: ['admin', 'principal'] },
            isActive: true
        },
        select: { id: true }
    });

    for (const admin of admins) {
        await prisma.notification.create({
            data: {
                userId: admin.id,
                channel: 'push',
                recipient: admin.id,
                subject: 'Bulk Student Import Complete',
                body: `${users.length} student accounts created successfully`,
                status: 'pending'
            }
        });
    }

    return results;
}

module.exports = {
    generateAvatarUrl,
    generatePin,
    createStudentProfileExtras,
    createBulkProfileExtras
};
