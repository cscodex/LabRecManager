import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export async function logActivity(
    action: string,
    message: string,
    adminId: string | null = null,
    metadata: Record<string, any> | null = null
) {
    try {
        await sql`
            INSERT INTO activity_logs (action, message, admin_id, metadata, created_at)
            VALUES (${action}, ${message}, ${adminId}, ${JSON.stringify(metadata)}, NOW())
        `;
    } catch (error) {
        console.error('Failed to log activity:', error);
        // Fail silently to not block main operation
    }
}
