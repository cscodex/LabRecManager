import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

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

        // Get current attempt
        const attempts = await sql`
            SELECT id, session_token, status FROM exam_attempts
            WHERE exam_id = ${examId} AND student_id = ${studentId} AND status = 'in_progress'
            ORDER BY started_at DESC
            LIMIT 1
        `;

        if (attempts.length === 0) {
            return NextResponse.json({ error: 'No active attempt found' }, { status: 400 });
        }

        const attempt = attempts[0];

        // If no session token exists, this is first login - generate one
        if (!attempt.session_token) {
            const newToken = uuidv4();
            await sql`
                UPDATE exam_attempts
                SET session_token = ${newToken}
                WHERE id = ${attempt.id}
            `;
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
        const newToken = uuidv4();
        await sql`
            UPDATE exam_attempts
            SET session_token = ${newToken}
            WHERE id = ${attempt.id}
        `;

        return NextResponse.json({
            success: true,
            sessionToken: newToken,
            isNewSession: true,
            tookOverSession: true
        });

    } catch (error) {
        console.error('Error in session validation:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
