/**
 * Notification Service
 * Helper functions to create notifications for users
 */
const prisma = require('../config/database');

/**
 * Create a notification for a single user
 */
async function createNotification({ userId, title, message, type, referenceType, referenceId, actionUrl }) {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type: type || 'info',
                reference_type: referenceType || null,
                reference_id: referenceId || null,
                action_url: actionUrl || null,
                is_read: false
            }
        });
        return notification;
    } catch (error) {
        console.error('Failed to create notification:', error.message);
        return null;
    }
}

/**
 * Create notifications for all students in a class
 */
async function notifyClass({ classId, title, message, type, referenceType, referenceId, actionUrl }) {
    try {
        // Get all students enrolled in the class
        const enrollments = await prisma.classEnrollment.findMany({
            where: {
                classId,
                status: 'active'
            },
            select: {
                studentId: true
            }
        });

        if (enrollments.length === 0) {
            console.log('No students enrolled in class:', classId);
            return [];
        }

        // Create notifications for all students
        const notifications = await prisma.notification.createMany({
            data: enrollments.map(e => ({
                userId: e.studentId,
                title,
                message,
                type: type || 'info',
                reference_type: referenceType || null,
                reference_id: referenceId || null,
                action_url: actionUrl || null,
                is_read: false
            }))
        });

        console.log(`Created ${notifications.count} notifications for class ${classId}`);
        return notifications;
    } catch (error) {
        console.error('Failed to notify class:', error.message);
        return null;
    }
}

/**
 * Create notifications for all members of a group
 */
async function notifyGroup({ groupId, title, message, type, referenceType, referenceId, actionUrl }) {
    try {
        // Get all members in the group
        const members = await prisma.groupMember.findMany({
            where: { groupId },
            select: { studentId: true }
        });

        if (members.length === 0) {
            console.log('No members in group:', groupId);
            return [];
        }

        // Create notifications for all group members
        const notifications = await prisma.notification.createMany({
            data: members.map(m => ({
                userId: m.studentId,
                title,
                message,
                type: type || 'info',
                reference_type: referenceType || null,
                reference_id: referenceId || null,
                action_url: actionUrl || null,
                is_read: false
            }))
        });

        console.log(`Created ${notifications.count} notifications for group ${groupId}`);
        return notifications;
    } catch (error) {
        console.error('Failed to notify group:', error.message);
        return null;
    }
}

/**
 * Notify the owner/instructor of an assignment
 */
async function notifyAssignmentOwner({ assignmentId, title, message, type, referenceType, referenceId, actionUrl }) {
    try {
        // Get assignment with creator
        const assignment = await prisma.assignment.findUnique({
            where: { id: assignmentId },
            select: { createdById: true }
        });

        if (!assignment) {
            console.log('Assignment not found:', assignmentId);
            return null;
        }

        return await createNotification({
            userId: assignment.createdById,
            title,
            message,
            type,
            referenceType,
            referenceId,
            actionUrl
        });
    } catch (error) {
        console.error('Failed to notify assignment owner:', error.message);
        return null;
    }
}

/**
 * Notify multiple users (admins, instructors, etc.)
 */
async function notifyUsers({ userIds, title, message, type, referenceType, referenceId, actionUrl }) {
    try {
        if (!userIds || userIds.length === 0) {
            return [];
        }

        const notifications = await prisma.notification.createMany({
            data: userIds.map(userId => ({
                userId,
                title,
                message,
                type: type || 'info',
                reference_type: referenceType || null,
                reference_id: referenceId || null,
                action_url: actionUrl || null,
                is_read: false
            }))
        });

        console.log(`Created ${notifications.count} notifications for ${userIds.length} users`);
        return notifications;
    } catch (error) {
        console.error('Failed to notify users:', error.message);
        return null;
    }
}

/**
 * Notify all admins, principals, and lab assistants
 */
async function notifyAdmins({ title, message, type, referenceType, referenceId, actionUrl }) {
    try {
        // Get all admin, principal, and lab_assistant users
        const admins = await prisma.user.findMany({
            where: {
                role: { in: ['admin', 'principal', 'lab_assistant'] },
                isActive: true
            },
            select: { id: true }
        });

        if (admins.length === 0) {
            console.log('No admin users found');
            return [];
        }

        const notifications = await prisma.notification.createMany({
            data: admins.map(admin => ({
                userId: admin.id,
                title,
                message,
                type: type || 'info',
                reference_type: referenceType || null,
                reference_id: referenceId || null,
                action_url: actionUrl || null,
                is_read: false
            }))
        });

        console.log(`Created ${notifications.count} notifications for admins`);
        return notifications;
    } catch (error) {
        console.error('Failed to notify admins:', error.message);
        return null;
    }
}

module.exports = {
    createNotification,
    notifyClass,
    notifyGroup,
    notifyAssignmentOwner,
    notifyUsers,
    notifyAdmins
};
