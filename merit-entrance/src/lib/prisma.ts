// This file is kept for potential future use with Prisma ORM.
// Currently, the project uses direct neon() SQL queries instead.
// See api routes for examples of using neon().

import { neon } from '@neondatabase/serverless';

// Helper to get connection string
export function getConnectionString(): string {
    const connectionString = process.env.MERIT_DATABASE_URL
        || process.env.MERIT_DIRECT_URL
        || process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error('Database connection string not found');
    }

    return connectionString;
}

// Create a neon SQL client
export function createSqlClient() {
    return neon(getConnectionString());
}

// Export a shared sql client
export const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

export default sql;
