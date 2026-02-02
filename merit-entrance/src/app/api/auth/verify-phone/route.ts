
import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdmin } from '@/lib/firebase-admin';
import { neon } from '@neondatabase/serverless';
import { getSession } from '@/lib/auth';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !session.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { idToken } = await request.json();

        if (!idToken) {
            return NextResponse.json({ error: 'ID Token required' }, { status: 400 });
        }

        // Verify the token with Firebase Admin
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
        const phoneNumber = decodedToken.phone_number;
        const uid = decodedToken.uid;

        if (!phoneNumber) {
            return NextResponse.json({ error: 'No phone number in token' }, { status: 400 });
        }

        console.log(`Verifying phone for student ${session.id}: ${phoneNumber}`);

        // Update student record
        // Trust the phone number from Firebase and update it in our DB
        await sql`
            UPDATE students 
            SET phone = ${phoneNumber}, 
                phone_verified = true, 
                firebase_uid = ${uid}
            WHERE id = ${session.id}
        `;

        return NextResponse.json({
            success: true,
            message: 'Phone verified successfully',
            phone: phoneNumber
        });
    } catch (error) {
        console.error('Error verifying phone token:', error);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}
