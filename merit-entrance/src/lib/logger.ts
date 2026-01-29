import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export type ActivityType =
    | 'create_exam'
    | 'update_exam'
    | 'delete_exam'
    | 'publish_exam'
    | 'assign_exam'
    | 'system_settings'
    | 'backup_restore';

export async function logActivity(
    action: ActivityType,
    description: string,
    metadata: Record<string, any> = {},
    userId?: string
) {
    try {
        let actorId = userId;

        // If no user provided, try to get from session
        if (!actorId) {
            const session = await getSession();
            if (session) {
                actorId = session.id;
            }
        }

        if (!actorId) {
            console.warn('Attempted to log activity without user context:', { action, description });
            return;
        }

        await sql`
            INSERT INTO activity_logs (
                user_id,
                action_type,
                description,
                metadata,
                ip_address,
                created_at
            ) VALUES (
                ${actorId},
                ${action},
                ${description},
                ${JSON.stringify(metadata)}::jsonb,
                null,
                NOW()
            )
        `;
    } catch (error) {
        console.error('Failed to log activity:', error);
        // Don't throw, we don't want to break the main flow if logging fails
    }
}
