'use client';

import { SessionProvider } from 'next-auth/react';
import { AuthSync } from './AuthSync';

export default function SessionWrapper({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <AuthSync />
            {children}
        </SessionProvider>
    );
}
