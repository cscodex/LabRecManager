'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export function AuthSync() {
    const { data: session, status } = useSession();
    const { isAuthenticated, setUser, user } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        const syncSession = async () => {
            // Only sync if we have a Google session but no App session (or mismatched)
            // status === "authenticated" means NextAuth has a session
            if (status === 'authenticated' && session?.user?.email) {

                // If we are already authenticated in App Store with same email, do nothing
                if (isAuthenticated && user?.email === session.user.email) {
                    return;
                }

                try {
                    const res = await fetch('/api/auth/sync', { method: 'POST' });
                    const data = await res.json();

                    if (res.ok && data.success) {
                        setUser(data.user);
                        toast.success('Signed in successfully');

                        // Check for callback URL or default to dashboard
                        const params = new URLSearchParams(window.location.search);
                        const callbackUrl = params.get('callbackUrl') || '/student/dashboard';
                        router.push(callbackUrl);
                    } else {
                        // Sync failed (e.g. account inactive or not found)
                        console.error('Auth Sync Failed:', data.error);
                        toast.error(data.error || 'Authentication failed');
                        // Force signout from Google to prevent infinite loop
                        signOut({ redirect: false });
                    }
                } catch (error) {
                    console.error('Auth Sync Error:', error);
                    signOut({ redirect: false });
                }
            }
        };

        syncSession();
    }, [session, status, isAuthenticated, user, setUser, router]);

    return null; // This component renders nothing
}
