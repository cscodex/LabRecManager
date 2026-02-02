import { Resend } from 'resend';

// Fallback to dummy key during build/dev if missing, prevents crash on import
// Runtime requests will fail if key is invalid, which is expected.
const apiKey = process.env.RESEND_API_KEY || 're_123456789';

export const resend = new Resend(apiKey);
