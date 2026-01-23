import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export interface QueryLogEntry {
    route: string;
    method: string;
    query?: string;
    params?: string;
    success: boolean;
    error?: string;
    duration?: number;
    userId?: string;
}

/**
 * Log a query/API operation to the database
 */
export async function logQuery(entry: QueryLogEntry): Promise<void> {
    try {
        await sql`
            INSERT INTO query_logs (route, method, query, params, success, error, duration, user_id)
            VALUES (
                ${entry.route}, 
                ${entry.method}, 
                ${entry.query || null}, 
                ${entry.params || null}, 
                ${entry.success}, 
                ${entry.error || null}, 
                ${entry.duration || null},
                ${entry.userId || null}::uuid
            )
        `;
    } catch (e) {
        // Don't let logging failures break the app
        console.error('Failed to log query:', e);
    }
}

/**
 * Wrapper to execute and log a query
 */
export async function executeWithLogging<T>(
    route: string,
    method: string,
    operation: () => Promise<T>,
    userId?: string
): Promise<T> {
    const start = Date.now();
    try {
        const result = await operation();
        const duration = Date.now() - start;
        await logQuery({
            route,
            method,
            success: true,
            duration,
            userId,
        });
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logQuery({
            route,
            method,
            success: false,
            error: errorMessage,
            duration,
            userId,
        });
        throw error;
    }
}
