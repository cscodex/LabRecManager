import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { auth } from '@/lib/next-auth';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');

export interface JWTPayload {
    id: string;
    email?: string;
    rollNumber?: string;
    name: string;
    role: 'admin' | 'superadmin' | 'student';
}

export async function signToken(payload: JWTPayload): Promise<string> {
    return await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as unknown as JWTPayload;
    } catch {
        return null;
    }
}

export async function getSession(): Promise<JWTPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('merit_token')?.value;

    if (token) {
        const payload = await verifyToken(token);
        if (payload) return payload;
    }

    // Fallback to NextAuth Google session
    try {
        const nextAuthSession = await auth();
        if (nextAuthSession?.user) {
            return {
                id: nextAuthSession.user.id || '',
                email: nextAuthSession.user.email || undefined,
                rollNumber: (nextAuthSession.user as any).rollNumber || undefined,
                name: nextAuthSession.user.name || 'Student',
                role: 'student',
            };
        }
    } catch (e) {
        console.error('NextAuth session check error:', e);
    }

    return null;
}

export async function setSession(payload: JWTPayload): Promise<void> {
    const token = await signToken(payload);
    const cookieStore = await cookies();
    cookieStore.set('merit_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
    });
}

export async function clearSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete('merit_token');
}
