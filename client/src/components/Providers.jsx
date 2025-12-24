'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import AppLayout from './AppLayout';
import { useThemeStore } from '@/lib/store';
import WhiteboardNotificationListener from './WhiteboardNotificationListener';

function ThemeInitializer() {
    const { theme, initializeTheme } = useThemeStore();

    useEffect(() => {
        // Initialize theme on mount
        initializeTheme();

        // Listen for system preference changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'system') {
                initializeTheme();
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme, initializeTheme]);

    return null;
}

export function Providers({ children }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
                refetchOnWindowFocus: false,
            },
        },
    }));

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeInitializer />
            <AppLayout>
                {children}
            </AppLayout>
            <WhiteboardNotificationListener />
        </QueryClientProvider>
    );
}
