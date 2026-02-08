import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// Validate or claim exam session for single device login
export async function POST(
    request: NextRequest,
    { params }: { params: { examId: string } }
) {
    try {
        const session = await getSession();
        if (!session || session.role !== 'student') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { examId } = params;
        const studentId = session.id;
        const body = await request.json();
        const { clientToken, forceLogin } = body;

        // Get current attempt - try with session_token column first
        let attempts;
        try {
            attempts = await sql`
                SELECT id, session_token, status FROM exam_attempts
                WHERE exam_id = ${examId} AND student_id = ${studentId} AND status = 'in_progress'
                ORDER BY started_at DESC
                LIMIT 1
            `;
        } catch (err) {
            // session_token column might not exist - try without it
            console.warn('session_token column may not exist, falling back:', err);
            attempts = await sql`
                SELECT id, status FROM exam_attempts
                WHERE exam_id = ${examId} AND student_id = ${studentId} AND status = 'in_progress'
                ORDER BY started_at DESC
                LIMIT 1
            `;
        }

        if (attempts.length === 0) {
            // No active attempt - this is OK, let loadExamData handle starting the exam
            return NextResponse.json({
                success: true,
                sessionToken: crypto.randomUUID(),
                isNewSession: true,
                noActiveAttempt: true
            });
        }

        const attempt = attempts[0];

        // If session_token column doesn't exist in result, treat as new session
        if (!('session_token' in attempt)) {
            return NextResponse.json({
                success: true,
                sessionToken: crypto.randomUUID(),
                isNewSession: true
            });
        }

        // If no session token exists, this is first login - generate one
        if (!attempt.session_token) {
            const newToken = crypto.randomUUID();
            try {
                await sql`
                    UPDATE exam_attempts
                    SET session_token = ${newToken}
                    WHERE id = ${attempt.id}
                `;
            } catch (updateErr) {
                console.warn('Could not update session_token:', updateErr);
            }
            return NextResponse.json({
                success: true,
                sessionToken: newToken,
                isNewSession: true
            });
        }

        // If client has same token, session is valid
        if (clientToken === attempt.session_token) {
            return NextResponse.json({
                success: true,
                sessionToken: attempt.session_token,
                isNewSession: false
            });
        }

        // Different token - another device is active
        if (!forceLogin) {
            // Ask for confirmation
            return NextResponse.json({
                success: false,
                activeOnOtherDevice: true,
                message: 'This exam is active on another device. Do you want to continue here and logout from the other device?'
            });
        }

        // Force login - generate new token, invalidating old session
        const newToken = crypto.randomUUID();
        try {
            await sql`
                UPDATE exam_attempts
                SET session_token = ${newToken}
                WHERE id = ${attempt.id}
            `;
        } catch (updateErr) {
            console.warn('Could not update session_token:', updateErr);
        }

        return NextResponse.json({
            success: true,
            sessionToken: newToken,
            isNewSession: true,
            tookOverSession: true
        });

    } catch (error) {
        console.error('Error in session validation:', error);
        // Return success with new token on error - don't block exam
        return NextResponse.json({
            success: true,
            sessionToken: crypto.randomUUID(),
            isNewSession: true,
            fallback: true
        });
    }
}
