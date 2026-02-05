import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export type ActivityType =
    | 'create_exam'
    | 'update_exam'
    | 'delete_exam'
    | 'publish_exam'
    | 'assign_exam'
    | 'unassign_exam'
    | 'system_settings'
    | 'backup_restore'
    | 'import_data'
    | 'student_registered'
    | 'login';

/**
 * Log an activity to the activity_logs table.
 * If no userId is provided, it will try to get the current session.
 * Activities without a valid admin_id will still be logged with null admin_id for system actions.
 */
export async function logActivity(
    action: ActivityType | string,
    description: string,
    metadata: Record<string, any> = {},
    userId?: string | null
) {
    try {
        let actorId = userId;

        // If no user provided, try to get from session
        if (actorId === undefined) {
            try {
                const session = await getSession();
                if (session) {
                    actorId = session.id;
                }
            } catch (sessionError) {
                // Session might not be available in all contexts (API routes without auth)
                console.log('Could not get session for activity log, proceeding with null admin_id');
            }
        }

        // Log activity even without admin_id (for system actions)
        await sql`
            INSERT INTO activity_logs (
                admin_id,
                action,
                message,
                metadata,
                created_at
            ) VALUES (
                ${actorId || null},
                ${action},
                ${description},
                ${JSON.stringify(metadata)}::jsonb,
                NOW()
            )
        `;

        console.log(`Activity logged: ${action} - ${description}`);
    } catch (error) {
        console.error('Failed to log activity:', error);
        // Don't throw, we don't want to break the main flow if logging fails
    }
}

/**
 * Log a system-level activity that doesn't require an admin context
 */
export async function logSystemActivity(
    action: string,
    description: string,
    metadata: Record<string, any> = {}
) {
    return logActivity(action, description, metadata, null);
}
