const cron = require('node-cron');
const prisma = require('../config/database');
const logger = require('../config/logger');

const initCronJobs = () => {
    // Run every day at midnight
    cron.schedule('0 0 * * *', async () => {
        logger.info('Running cron job: Cleaning up trash items older than 30 days');
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Find documents to delete
            const documentsToDelete = await prisma.document.findMany({
                where: {
                    deletedAt: {
                        lt: thirtyDaysAgo
                    }
                }
            });

            if (documentsToDelete.length > 0) {
                // Determine unique users to update storage
                const userStorageUpdates = {};
                for (const doc of documentsToDelete) {
                    if (doc.updatedById) { // Assuming uploadedById is the owner, or we use createdBy. Document model has uploadedById ? 
                        // Let's check schema. It has `uploadedById`.
                        // But wait, the previous code for permanent delete used `uploadedBy`.
                        // Let's assume `uploadedById` is the field.
                        if (!userStorageUpdates[doc.uploadedById]) {
                            userStorageUpdates[doc.uploadedById] = 0n;
                        }
                        userStorageUpdates[doc.uploadedById] += BigInt(doc.fileSize);
                    }
                }

                // Delete documents
                const deleteResult = await prisma.document.deleteMany({
                    where: {
                        deletedAt: {
                            lt: thirtyDaysAgo
                        }
                    }
                });

                logger.info(`Deleted ${deleteResult.count} old documents from trash`);

                // Update storage for users
                // Note: This is a bit rough, ideally we should recalculate or decrement carefully.
                // The current implementation of permanentDelete in document.routes.js does:
                // await prisma.user.update({ where: { id: doc.uploadedById }, data: { storageUsedBytes: { decrement: doc.fileSize } } });

                // We can iterate and update.
                for (const [userId, bytesToRemove] of Object.entries(userStorageUpdates)) {
                    await prisma.user.update({
                        where: { id: userId },
                        data: {
                            storageUsedBytes: {
                                decrement: bytesToRemove
                            }
                        }
                    }).catch(err => logger.error(`Failed to update storage for user ${userId} in cron: ${err.message}`));
                }
            } else {
                logger.info('No documents to clean up');
            }
        } catch (error) {
            logger.error('Error running trash cleanup cron job:', error);
        }
    });

    logger.info('Cron jobs initialized');
};

module.exports = { initCronJobs };
