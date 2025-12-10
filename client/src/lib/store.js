import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            _hasHydrated: false,

            setHasHydrated: (state) => set({ _hasHydrated: state }),

            setAuth: (user, accessToken, refreshToken) => set({
                user,
                accessToken,
                refreshToken,
                isAuthenticated: true,
            }),

            logout: () => set({
                user: null,
                accessToken: null,
                refreshToken: null,
                isAuthenticated: false,
            }),

            updateUser: (userData) => set((state) => ({
                user: { ...state.user, ...userData },
            })),

            getAccessToken: () => get().accessToken,
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated,
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);

export const useLanguageStore = create(
    persist(
        (set) => ({
            language: 'en',
            setLanguage: (language) => set({ language }),
        }),
        { name: 'language-storage' }
    )
);

export const useThemeStore = create(
    persist(
        (set, get) => ({
            theme: 'light', // 'light', 'dark', 'system'
            setTheme: (theme) => {
                set({ theme });
                // Apply theme to document
                if (typeof window !== 'undefined') {
                    const root = document.documentElement;
                    root.classList.remove('light', 'dark');

                    if (theme === 'system') {
                        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        root.classList.add(systemDark ? 'dark' : 'light');
                    } else {
                        root.classList.add(theme);
                    }
                }
            },
            initializeTheme: () => {
                const theme = get().theme;
                if (typeof window !== 'undefined') {
                    const root = document.documentElement;
                    root.classList.remove('light', 'dark');

                    if (theme === 'system') {
                        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        root.classList.add(systemDark ? 'dark' : 'light');
                    } else {
                        root.classList.add(theme);
                    }
                }
            },
        }),
        { name: 'theme-storage' }
    )
);
