import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    name: string;
    email?: string;
    rollNumber?: string;
    role: 'admin' | 'superadmin' | 'student';
    photoUrl?: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    language: 'en' | 'pa';
    setUser: (user: User | null) => void;
    setLanguage: (lang: 'en' | 'pa') => void;
    logout: () => void;
    _hasHydrated: boolean;
    setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            language: 'en',
            _hasHydrated: false,
            setUser: (user) => set({ user, isAuthenticated: !!user }),
            setLanguage: (language) => set({ language }),
            logout: () => set({ user: null, isAuthenticated: false }),
            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'merit-auth-storage',
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);

// Exam attempt state
interface ExamState {
    currentQuestionIndex: number;
    responses: Record<string, { answer: any; markedForReview: boolean }>;
    timeRemaining: number;
    setCurrentQuestion: (index: number) => void;
    setResponse: (questionId: string, answer: any, markedForReview?: boolean) => void;
    setTimeRemaining: (time: number) => void;
    clearExamState: () => void;
}

export const useExamStore = create<ExamState>((set) => ({
    currentQuestionIndex: 0,
    responses: {},
    timeRemaining: 0,
    setCurrentQuestion: (index) => set({ currentQuestionIndex: index }),
    setResponse: (questionId, answer, markedForReview = false) =>
        set((state) => ({
            responses: {
                ...state.responses,
                [questionId]: { answer, markedForReview },
            },
        })),
    setTimeRemaining: (time) => set({ timeRemaining: time }),
    clearExamState: () =>
        set({
            currentQuestionIndex: 0,
            responses: {},
            timeRemaining: 0,
        }),
}));
