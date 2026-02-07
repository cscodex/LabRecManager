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
    responseTimes: Record<string, number>;
    currentQuestionId: string | null;
    questionStartTime: number;
    setCurrentQuestion: (index: number, questionId?: string) => void;
    setResponse: (questionId: string, answer: any, markedForReview?: boolean) => void;
    updateTimeSpent: (questionId: string, seconds: number) => void;
    setTimeRemaining: (time: number) => void;
    clearExamState: () => void;
}

export const useExamStore = create<ExamState>()(
    persist(
        (set) => ({
            currentQuestionIndex: 0,
            responses: {},
            timeRemaining: 0,
            responseTimes: {},
            currentQuestionId: null,
            questionStartTime: Date.now(),

            setCurrentQuestion: (index, questionId) =>
                set((state) => {
                    const now = Date.now();
                    const elapsed = state.questionStartTime ? Math.floor((now - state.questionStartTime) / 1000) : 0;
                    const prevId = state.currentQuestionId;

                    // Update time for previous question if exists
                    const newResponseTimes = { ...state.responseTimes };
                    if (prevId) {
                        newResponseTimes[prevId] = (newResponseTimes[prevId] || 0) + elapsed;
                    }

                    return {
                        currentQuestionIndex: index,
                        currentQuestionId: questionId || null,
                        questionStartTime: now,
                        responseTimes: newResponseTimes
                    };
                }),

            setResponse: (questionId, answer, markedForReview = false) =>
                set((state) => ({
                    responses: {
                        ...state.responses,
                        [questionId]: { answer, markedForReview },
                    },
                })),

            updateTimeSpent: (questionId, seconds) =>
                set((state) => ({
                    responseTimes: {
                        ...state.responseTimes,
                        [questionId]: (state.responseTimes[questionId] || 0) + seconds
                    }
                })),

            setTimeRemaining: (time) => set({ timeRemaining: time }),
            clearExamState: () =>
                set({
                    currentQuestionIndex: 0,
                    responses: {},
                    timeRemaining: 0,
                    responseTimes: {},
                    currentQuestionId: null,
                    questionStartTime: Date.now(),
                }),
        }),
        {
            name: 'merit-exam-storage',
            partialize: (state) => ({
                currentQuestionIndex: state.currentQuestionIndex,
                responses: state.responses,
                responseTimes: state.responseTimes,
                currentQuestionId: state.currentQuestionId,
            }),
        }
    )
);
