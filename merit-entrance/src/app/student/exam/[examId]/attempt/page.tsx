'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useAuthStore, useExamStore } from '@/lib/store';
import { getText, formatTimer, getQuestionStatusColor } from '@/lib/utils';
import {
    Clock, User, Globe, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
    Flag, RotateCcw, Save, Send, AlertCircle, Maximize, AlertTriangle, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MathJaxProvider } from '@/components/providers/MathJaxProvider';
import { MathText } from '@/components/MathText';

interface Section {
    id: string;
    name: Record<string, string>;
    order: number;
}

interface Option {
    id: string;
    text: Record<string, string>;
    image_url?: string;
    imageUrl?: string;
}

interface Question {
    id: string;
    sectionId: string;
    type: string;
    text: Record<string, string>;
    options: Option[] | null;
    marks: number;
    negativeMarks: number | null;
    imageUrl: string | null;
    order: number;
    parentId?: string | null;
    paragraphText?: Record<string, string> | null;
    paragraphTitle?: Record<string, string> | null;
}

interface ExamData {
    title: Record<string, string>;
    instructions: Record<string, string> | null;
    duration: number;
    totalMarks: number;
    securityMode?: boolean;
}

export default function ExamAttemptPage() {
    const router = useRouter();
    const params = useParams();
    const examId = params.examId as string;
    const { user, language, setLanguage, isAuthenticated, _hasHydrated } = useAuthStore();

    const [examData, setExamData] = useState<ExamData | null>(null);
    const [sections, setSections] = useState<Section[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [responses, setResponses] = useState<Record<string, { answer: string[]; markedForReview: boolean }>>({});
    const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(new Set());
    const [showInstructions, setShowInstructions] = useState(false);

    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(0);

    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [showMobileNav, setShowMobileNav] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    // Fullscreen and visibility tracking
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showTabWarning, setShowTabWarning] = useState(false);
    const [tabSwitchCountdown, setTabSwitchCountdown] = useState(10);
    const [violationCount, setViolationCount] = useState(0);
    const [imageLoading, setImageLoading] = useState(true);

    // Single device login
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const [showDeviceConflict, setShowDeviceConflict] = useState(false);

    const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const tabWarningRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const remainingTimeRef = useRef(0);

    // Get questions for current section - FILTER OUT paragraph type (they are just containers)
    const currentSection = sections[currentSectionIndex];
    const sectionQuestions = questions.filter(q => q.sectionId === currentSection?.id && q.type !== 'paragraph');
    const currentQuestion = sectionQuestions[currentQuestionIndex];

    // All answerable questions (excluding paragraphs) for counts
    const answerableQuestions = questions.filter(q => q.type !== 'paragraph');

    // Helper to get paragraph text for a question — checks parent link AND own paragraph
    const getParentParagraphText = (question: Question | undefined) => {
        if (!question) return null;

        // Case 1: Question has its own paragraphText (linked directly via paragraph_id)
        if (question.paragraphText) {
            return {
                text: question.paragraphText,
                title: question.paragraphTitle || null
            };
        }

        // Case 2: Question has parentId → look up parent's paragraphText
        if (question.parentId) {
            const parent = questions.find(q => q.id === question.parentId);
            if (parent?.paragraphText) {
                return {
                    text: parent.paragraphText,
                    title: parent.paragraphTitle || null
                };
            }
        }

        return null;
    };

    useEffect(() => {
        console.log('[DEBUG useEffect] _hasHydrated:', _hasHydrated, 'isAuthenticated:', isAuthenticated, 'user:', user?.role, user?.id);
        if (!_hasHydrated) {
            console.log('[DEBUG useEffect] Not hydrated yet, returning early');
            return;
        }
        if (!isAuthenticated || user?.role !== 'student') {
            console.log('[DEBUG useEffect] Not authenticated or not student, redirecting');
            router.push('/');
            return;
        }
        console.log('[DEBUG useEffect] Calling loadExamData()');
        loadExamData();

        // Copy refs to local variables for cleanup
        const autoSaveInterval = autoSaveRef.current;
        const timerInterval = timerRef.current;
        const tabWarningTimeout = tabWarningRef.current;
        const countdownInterval = countdownRef.current;

        return () => {
            if (autoSaveInterval) clearInterval(autoSaveInterval);
            if (timerInterval) clearInterval(timerInterval);
            if (tabWarningTimeout) clearTimeout(tabWarningTimeout);
            if (countdownInterval) clearInterval(countdownInterval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_hasHydrated, isAuthenticated, user, router]);

    // Fullscreen and visibility detection
    useEffect(() => {
        // Request fullscreen when exam loads
        const requestFullscreen = () => {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                elem.requestFullscreen().then(() => {
                    setIsFullscreen(true);
                }).catch(err => {
                    console.log('Fullscreen denied:', err);
                });
            }
        };

        // Handle visibility change (tab switch)
        const handleVisibilityChange = () => {
            // Only enforce if security is enabled
            if (!examData?.securityMode) return;

            if (document.hidden && !submitting && !showSubmitConfirm) {
                // Student switched away - start warning countdown
                setViolationCount(prev => prev + 1);
                setShowTabWarning(true);
                setTabSwitchCountdown(10);

                // Start countdown
                countdownRef.current = setInterval(() => {
                    setTabSwitchCountdown(prev => {
                        if (prev <= 1) {
                            // Auto-submit
                            if (countdownRef.current) clearInterval(countdownRef.current);
                            handleSubmit(true);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else if (!document.hidden) {
                // Student returned - cancel countdown
                if (countdownRef.current) {
                    clearInterval(countdownRef.current);
                    countdownRef.current = null;
                }
                setShowTabWarning(false);
                setTabSwitchCountdown(10);
            }
        };

        // Handle fullscreen change
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        // Set up listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        // Request fullscreen after a short delay (user must have interacted with page)
        const timer = setTimeout(requestFullscreen, 1000);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            clearTimeout(timer);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submitting, showSubmitConfirm, examData?.securityMode]);

    // Security: Block context menu, keyboard shortcuts, and detect window blur
    useEffect(() => {
        // Block right-click context menu
        const handleContextMenu = (e: MouseEvent) => {
            if (!examData?.securityMode) return;
            e.preventDefault();
            toast.error('Right-click is disabled during exam');
        };

        // Block keyboard shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!examData?.securityMode) return;
            // Block: Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+S, Ctrl+P, F12, Ctrl+Shift+I/J/C
            const blockedCombos = [
                e.ctrlKey && e.key === 'c', // Copy
                e.ctrlKey && e.key === 'v', // Paste
                e.ctrlKey && e.key === 'x', // Cut
                e.ctrlKey && e.key === 'a', // Select all
                e.ctrlKey && e.key === 's', // Save
                e.ctrlKey && e.key === 'p', // Print
                e.ctrlKey && e.key === 'u', // View source
                e.key === 'F12', // Dev tools
                e.ctrlKey && e.shiftKey && e.key === 'I', // Dev tools
                e.ctrlKey && e.shiftKey && e.key === 'J', // Console
                e.ctrlKey && e.shiftKey && e.key === 'C', // Inspect
            ];

            if (blockedCombos.some(Boolean)) {
                e.preventDefault();
                toast.error('This keyboard shortcut is disabled during exam');
            }
        };

        // Detect window blur (switching windows/apps)
        const handleWindowBlur = () => {
            if (submitting || showSubmitConfirm) return;

            // Strict Mode (Controlled Environment)
            if (examData?.securityMode) {
                setViolationCount(prev => prev + 1);
                setShowTabWarning(true);
                setTabSwitchCountdown(10);

                // Start auto-submit countdown for security violation
                if (!countdownRef.current) {
                    countdownRef.current = setInterval(() => {
                        setTabSwitchCountdown(prev => {
                            if (prev <= 1) {
                                if (countdownRef.current) clearInterval(countdownRef.current);
                                countdownRef.current = null;
                                handleSubmit(true);
                                return 0;
                            }
                            return prev - 1;
                        });
                    }, 1000);
                }
                return;
            }

            // Normal Mode: No pause - just let time run
        };

        const handleWindowFocus = () => {
            // Strict Mode
            if (examData?.securityMode) {
                // Cancel countdown when window gains focus
                if (countdownRef.current) {
                    clearInterval(countdownRef.current);
                    countdownRef.current = null;
                }
                setShowTabWarning(false);
                setTabSwitchCountdown(10);
                return;
            }

            // Normal Mode: Nothing to do (no pause/resume)
        };

        // Add event listeners
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('focus', handleWindowFocus);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [submitting, showSubmitConfirm, examData?.securityMode]);

    const loadExamData = async (forceLogin = false) => {
        console.log('[DEBUG loadExamData] Started, examId:', examId);
        try {
            // First, validate/claim session (optional - don't block exam if this fails)
            console.log('[DEBUG loadExamData] About to validate session');
            try {
                const storedToken = sessionStorage.getItem(`exam-session-${examId}`);
                const sessionRes = await fetch(`/api/student/exam/${examId}/session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientToken: storedToken, forceLogin }),
                });
                console.log('[DEBUG loadExamData] Session response status:', sessionRes.status);
                const sessionData = await sessionRes.json();
                console.log('[DEBUG loadExamData] Session data:', sessionData);

                if (sessionData.activeOnOtherDevice && !forceLogin) {
                    console.log('[DEBUG loadExamData] Device conflict detected, showing modal');
                    // Show device conflict modal
                    setShowDeviceConflict(true);
                    setLoading(false);
                    return;
                }

                if (sessionData.sessionToken) {
                    sessionStorage.setItem(`exam-session-${examId}`, sessionData.sessionToken);
                    setSessionToken(sessionData.sessionToken);
                }
            } catch (sessionErr) {
                console.warn('Session validation failed, continuing without:', sessionErr);
                // Continue loading exam anyway - session is for single device, not blocking
            }

            // Now load exam data
            console.log('[DEBUG] Fetching exam data for examId:', examId);
            const response = await fetch(`/api/student/exam/${examId}`, { cache: 'no-store' });
            console.log('[DEBUG] Response status:', response.status, response.statusText);
            const data = await response.json();
            console.log('[DEBUG] API response:', JSON.stringify(data).substring(0, 500));

            if (!data.success) {
                const errMsg = data.error || 'Failed to load exam';
                console.error('[DEBUG] API returned error:', errMsg, data.details);
                toast.error(errMsg);
                setErrorMessage(errMsg + (data.details ? `: ${data.details}` : ''));
                setLoading(false);
                return;
            }

            setExamData(data.exam);
            setSections(data.sections);
            setQuestions(data.questions);

            // Server responses are the source of truth
            setResponses(data.responses);

            // Build visited questions from existing responses
            const visitedIds = new Set<string>(Object.keys(data.responses));
            if (data.questions.length > 0) {
                visitedIds.add(data.questions[0].id);
            }
            setVisitedQuestions(visitedIds);

            // Restore last visited question position
            if (data.currentQuestionId) {
                const allQuestions = data.questions.filter((q: Question) => q.type !== 'paragraph');
                const targetQuestion = allQuestions.find((q: Question) => q.id === data.currentQuestionId);
                if (targetQuestion) {
                    const sectionIdx = data.sections.findIndex((s: Section) => s.id === targetQuestion.sectionId);
                    if (sectionIdx >= 0) {
                        setCurrentSectionIndex(sectionIdx);
                        const sectionQs = allQuestions.filter((q: Question) => q.sectionId === data.sections[sectionIdx].id);
                        const qIdxInSection = sectionQs.findIndex((q: Question) => q.id === data.currentQuestionId);
                        if (qIdxInSection >= 0) {
                            setCurrentQuestionIndex(qIdxInSection);
                        }
                    }
                }
            }

            setTimeRemaining(data.remainingSeconds);
            remainingTimeRef.current = data.remainingSeconds;

            // Start timer
            startTimer();

            // Start auto-save every 30 seconds
            autoSaveRef.current = setInterval(saveAllResponses, 30000);

        } catch (error) {
            console.error('Error loading exam:', error);
            toast.error('Failed to load exam - network error');
            setErrorMessage('Failed to load exam - please check your connection');
        } finally {
            setLoading(false);
        }
    };

    const startTimer = () => {
        // Clear any existing timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        timerRef.current = setInterval(() => {
            remainingTimeRef.current = remainingTimeRef.current - 1;
            setTimeRemaining(remainingTimeRef.current);

            if (remainingTimeRef.current <= 0) {
                clearInterval(timerRef.current!);
                handleSubmit(true); // Auto-submit
            }
        }, 1000);
    };

    const saveAllResponses = async () => {
        try {
            const responseArray = Object.entries(responses).map(([questionId, value]) => ({
                questionId,
                answer: value.answer,
                markedForReview: value.markedForReview,
            }));

            await fetch(`/api/student/exam/${examId}/save`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ responses: responseArray }),
            });
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    };

    const saveCurrentResponse = async (answer: string[], markedForReview: boolean) => {
        if (!currentQuestion) return;

        setResponses(prev => ({
            ...prev,
            [currentQuestion.id]: { answer, markedForReview },
        }));

        try {
            const res = await fetch(`/api/student/exam/${examId}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: currentQuestion.id,
                    answer,
                    markedForReview,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                console.error('Save failed:', data);
                toast.error('Failed to save response. Please try again.');
            }
        } catch (error) {
            console.error('Save failed:', error);
            toast.error('Failed to save response. Check your connection.');
        }
    };

    const handleOptionSelect = (optionId: string) => {
        if (!currentQuestion) return;

        const currentResponse = responses[currentQuestion.id];
        let newAnswer: string[];

        if (currentQuestion.type === 'mcq_single') {
            newAnswer = [optionId];
        } else {
            // Multiple correct
            const current = currentResponse?.answer || [];
            if (current.includes(optionId)) {
                newAnswer = current.filter(id => id !== optionId);
            } else {
                newAnswer = [...current, optionId];
            }
        }

        saveCurrentResponse(newAnswer, currentResponse?.markedForReview || false);
    };

    const handleClearResponse = () => {
        if (!currentQuestion) return;
        saveCurrentResponse([], responses[currentQuestion.id]?.markedForReview || false);
    };

    const handleMarkForReview = () => {
        if (!currentQuestion) return;
        const currentResponse = responses[currentQuestion.id];
        // Toggle mark status WITHOUT navigating
        saveCurrentResponse(currentResponse?.answer || [], !currentResponse?.markedForReview);
    };

    const handleMarkAndNext = () => {
        if (!currentQuestion) return;
        const currentResponse = responses[currentQuestion.id];
        saveCurrentResponse(currentResponse?.answer || [], true);
        moveToNext();
    };

    const handleSaveAndNext = () => {
        moveToNext();
    };

    const moveToNext = () => {
        if (currentQuestionIndex < sectionQuestions.length - 1) {
            const nextIdx = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextIdx);
            markAsVisited(sectionQuestions[nextIdx].id);
        } else if (currentSectionIndex < sections.length - 1) {
            setCurrentSectionIndex(currentSectionIndex + 1);
            setCurrentQuestionIndex(0);
            const nextSectionQuestions = questions.filter(q => q.sectionId === sections[currentSectionIndex + 1].id && q.type !== 'paragraph');
            if (nextSectionQuestions.length > 0) {
                markAsVisited(nextSectionQuestions[0].id);
            }
        }
    };

    const moveToPrev = () => {
        if (currentQuestionIndex > 0) {
            const prevIdx = currentQuestionIndex - 1;
            setCurrentQuestionIndex(prevIdx);
            markAsVisited(sectionQuestions[prevIdx].id);
        } else if (currentSectionIndex > 0) {
            const prevSectionIdx = currentSectionIndex - 1;
            setCurrentSectionIndex(prevSectionIdx);
            const prevSectionQuestions = questions.filter(q => q.sectionId === sections[prevSectionIdx].id && q.type !== 'paragraph');
            if (prevSectionQuestions.length > 0) {
                setCurrentQuestionIndex(prevSectionQuestions.length - 1);
                markAsVisited(prevSectionQuestions[prevSectionQuestions.length - 1].id);
            }
        }
    };

    const markAsVisited = (questionId: string) => {
        setVisitedQuestions(prev => new Set(Array.from(prev).concat([questionId])));
    };

    const toggleSectionCollapse = (sectionId: string) => {
        setCollapsedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId);
            } else {
                newSet.add(sectionId);
            }
            return newSet;
        });
    };

    const goToQuestion = (sectionIdx: number, questionIdx: number) => {
        setCurrentSectionIndex(sectionIdx);
        setCurrentQuestionIndex(questionIdx);
        const sectionQs = questions.filter(q => q.sectionId === sections[sectionIdx].id && q.type !== 'paragraph');
        if (sectionQs[questionIdx]) {
            markAsVisited(sectionQs[questionIdx].id);
        }
    };

    const handleSubmit = async (autoSubmit = false) => {
        if (submitting) return;

        setSubmitting(true);
        setShowSubmitConfirm(false);

        // Stop timer and auto-save immediately
        if (timerRef.current) clearInterval(timerRef.current);
        if (autoSaveRef.current) clearInterval(autoSaveRef.current);

        // Save all responses first
        await saveAllResponses();

        try {
            const response = await fetch(`/api/student/exam/${examId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoSubmit }),
            });

            const data = await response.json();
            if (data.success) {
                if (timerRef.current) clearInterval(timerRef.current);
                if (autoSaveRef.current) clearInterval(autoSaveRef.current);
                toast.success(autoSubmit ? 'Time up! Exam submitted.' : 'Exam submitted successfully!');
                router.push(`/student/results/${examId}`);
            } else if (data.error === 'Already submitted') {
                // Handle already submitted gracefully
                if (timerRef.current) clearInterval(timerRef.current);
                if (autoSaveRef.current) clearInterval(autoSaveRef.current);
                toast.success('Exam was already submitted.');
                router.push(`/student/results/${examId}`);
            } else {
                toast.error(data.error || 'Failed to submit');
                setSubmitting(false);
            }
        } catch (error) {
            toast.error('Failed to submit exam');
            setSubmitting(false);
        }
    };

    const getQuestionStatus = (questionId: string) => {
        const response = responses[questionId];
        const visited = visitedQuestions.has(questionId);

        if (!visited) return 'not_visited';
        if (response?.markedForReview) return 'marked';
        if (response?.answer && response.answer.length > 0) return 'answered';
        return 'not_answered';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading exam...</p>
                </div>
            </div>
        );
    }

    if (!examData) {
        // If device conflict, show modal instead of error
        if (showDeviceConflict) {
            return (
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                    <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-yellow-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Active on Another Device</h2>
                        <p className="text-gray-600 mb-6">
                            This exam is currently active on another device or browser.
                            Would you like to continue here? This will log you out from the other device.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push('/student/dashboard')}
                                className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition"
                            >
                                Go Back
                            </button>
                            <button
                                onClick={() => {
                                    setShowDeviceConflict(false);
                                    setLoading(true);
                                    loadExamData(true); // Force login
                                }}
                                className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                            >
                                Continue Here
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{errorMessage || 'Unable to load exam'}</p>
                    <button
                        onClick={() => router.push('/student/dashboard')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Check if current section has no questions (empty section)
    const hasEmptySection = sectionQuestions.length === 0;

    // Stats - properly check for empty answers
    const answeredCount = Object.values(responses).filter(r => {
        if (!r.answer) return false;
        if (Array.isArray(r.answer) && r.answer.length === 0) return false;
        return true;
    }).length;
    const markedCount = Object.values(responses).filter(r => r.markedForReview).length;
    const unansweredCount = answerableQuestions.length - answeredCount;

    return (
        <MathJaxProvider>
            <div className="min-h-screen bg-gray-100 flex flex-col relative h-screen overflow-hidden">
                {/* Device Conflict Modal */}
                {showDeviceConflict && (
                    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
                            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-8 h-8 text-yellow-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Active on Another Device</h2>
                            <p className="text-gray-600 mb-6">
                                This exam is currently active on another device or browser.
                                Would you like to continue here? This will log you out from the other device.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => router.push('/student/dashboard')}
                                    className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition"
                                >
                                    Go Back
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDeviceConflict(false);
                                        setLoading(true);
                                        loadExamData(true); // Force login
                                    }}
                                    className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                                >
                                    Continue Here
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Header */}
                <header className="bg-blue-900 text-white px-4 py-2 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-lg">{getText(examData.title, language)}</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setLanguage(language === 'en' ? 'pa' : 'en')}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-800 rounded text-sm hover:bg-blue-700"
                        >
                            <Globe className="w-4 h-4" />
                            {language === 'en' ? 'English' : 'ਪੰਜਾਬੀ'}
                        </button>
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span className="text-sm">{user?.name}</span>
                        </div>
                    </div>
                </header>

                {/* Section Tabs */}
                <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto shrink-0">
                    {sections.map((section, idx) => (
                        <button
                            key={section.id}
                            onClick={() => {
                                setCurrentSectionIndex(idx);
                                setCurrentQuestionIndex(0);
                                const sectionQs = questions.filter(q => q.sectionId === section.id && q.type !== 'paragraph');
                                if (sectionQs[0]) markAsVisited(sectionQs[0].id);
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${currentSectionIndex === idx
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {getText(section.name, language)}
                        </button>
                    ))}
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col lg:flex-row">
                    {/* Question Area */}
                    <div className="flex-1 p-2 sm:p-4 overflow-y-auto pb-20 lg:pb-4">
                        <div className="bg-white rounded-xl shadow-sm p-6 max-w-4xl mx-auto">
                            {hasEmptySection ? (
                                /* Empty Section Message */
                                <div className="text-center py-12">
                                    <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-700 mb-2">No Questions in This Section</h3>
                                    <p className="text-gray-500 mb-6">This section does not have any questions yet. Please select another section to continue.</p>
                                    <div className="flex justify-center gap-3">
                                        {sections.filter((_, i) => i !== currentSectionIndex && questions.filter(q => q.sectionId === sections[i]?.id && q.type !== 'paragraph').length > 0).length > 0 && (
                                            <button
                                                onClick={() => {
                                                    // Find next section with questions
                                                    for (let i = currentSectionIndex + 1; i < sections.length; i++) {
                                                        if (questions.filter(q => q.sectionId === sections[i].id && q.type !== 'paragraph').length > 0) {
                                                            setCurrentSectionIndex(i);
                                                            setCurrentQuestionIndex(0);
                                                            return;
                                                        }
                                                    }
                                                    // Or go to previous section with questions
                                                    for (let i = currentSectionIndex - 1; i >= 0; i--) {
                                                        if (questions.filter(q => q.sectionId === sections[i].id && q.type !== 'paragraph').length > 0) {
                                                            setCurrentSectionIndex(i);
                                                            setCurrentQuestionIndex(0);
                                                            return;
                                                        }
                                                    }
                                                }}
                                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                            >
                                                Go to Next Section
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : currentQuestion ? (
                                <>
                                    {/* Parent Paragraph Text (for sub-questions) */}
                                    {getParentParagraphText(currentQuestion) && getParentParagraphText(currentQuestion)?.text && (
                                        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 max-h-60 sm:max-h-96 overflow-y-auto">
                                            <p className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-wider sticky top-0 bg-blue-50 pb-1">
                                                {getParentParagraphText(currentQuestion)?.title ? getText(getParentParagraphText(currentQuestion)!.title!, language) : '📖 Reading Passage'}
                                            </p>
                                            <div
                                                className="text-gray-700 text-base leading-relaxed prose prose-sm max-w-none whitespace-pre-wrap break-words"
                                                dangerouslySetInnerHTML={{ __html: getText(getParentParagraphText(currentQuestion)!.text!, language) }}
                                            />
                                        </div>
                                    )}

                                    {/* Question Header */}
                                    <div className="flex items-center justify-between mb-4 pb-4 border-b">
                                        <span className="text-sm text-gray-500">
                                            Question {currentQuestionIndex + 1} of {sectionQuestions.length}
                                        </span>
                                        <span className="text-sm font-medium text-blue-600">
                                            +{currentQuestion.marks} marks
                                            {currentQuestion.negativeMarks && (
                                                <span className="text-red-500 ml-2">-{currentQuestion.negativeMarks}</span>
                                            )}
                                        </span>
                                    </div>

                                    {/* Question Text */}
                                    <div className="mb-6">
                                        <div className="text-lg text-gray-900 leading-relaxed">
                                            <MathText text={getText(currentQuestion.text, language)} />
                                        </div>
                                        {currentQuestion.imageUrl && (
                                            <div className="relative h-64 w-full mt-4 max-w-md">
                                                {imageLoading && (
                                                    <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
                                                        <div className="text-center">
                                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                                            <p className="text-sm text-gray-500">Loading image...</p>
                                                        </div>
                                                    </div>
                                                )}
                                                <Image
                                                    src={currentQuestion.imageUrl}
                                                    alt="Question"
                                                    fill
                                                    className={`object-contain rounded-lg transition-opacity ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                                                    onLoad={() => setImageLoading(false)}
                                                    onLoadStart={() => setImageLoading(true)}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Options */}
                                    {currentQuestion.options && (
                                        <div className="space-y-3">
                                            {currentQuestion.options.map((option) => {
                                                const isSelected = responses[currentQuestion.id]?.answer?.includes(option.id);
                                                return (
                                                    <button
                                                        key={option.id}
                                                        onClick={() => handleOptionSelect(option.id)}
                                                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition ${isSelected
                                                            ? 'border-blue-600 bg-blue-50'
                                                            : 'border-gray-200 hover:border-gray-300'
                                                            }`}
                                                    >
                                                        <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${isSelected
                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                            : 'border-gray-400 text-gray-600'
                                                            }`}>
                                                            {option.id.toUpperCase()}
                                                        </span>
                                                        <span className="flex-1 text-gray-800">
                                                            <MathText text={getText(option.text, language)} />
                                                            {(option.image_url || option.imageUrl) && (
                                                                <img src={option.image_url || option.imageUrl} alt="" className="mt-2 max-w-[180px] max-h-[100px] object-contain rounded border" />
                                                            )}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap gap-2 mt-8 pt-4 border-t">
                                        <button
                                            onClick={handleMarkForReview}
                                            title={responses[currentQuestion.id]?.markedForReview ? 'Unmark' : 'Mark for Review'}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition ${responses[currentQuestion.id]?.markedForReview
                                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                                }`}
                                        >
                                            <Flag className="w-4 h-4" />
                                            <span className="hidden sm:inline">{responses[currentQuestion.id]?.markedForReview ? 'Unmark' : 'Mark'}</span>
                                        </button>
                                        {responses[currentQuestion.id]?.answer?.length > 0 && (
                                            <button
                                                onClick={handleClearResponse}
                                                title="Clear Response"
                                                className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                <span className="hidden sm:inline">Clear</span>
                                            </button>
                                        )}
                                        <div className="flex-1"></div>
                                        <button
                                            onClick={moveToPrev}
                                            disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
                                            title="Previous"
                                            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            <span className="hidden sm:inline">Prev</span>
                                        </button>

                                        {/* Smart Logic for Next/Save Button */}
                                        {(() => {
                                            const hasResponse = responses[currentQuestion.id]?.answer?.length > 0;
                                            const isLastQuestion =
                                                currentSectionIndex === sections.length - 1 &&
                                                currentQuestionIndex === sectionQuestions.length - 1;

                                            if (isLastQuestion && hasResponse) {
                                                return (
                                                    <button
                                                        onClick={handleSaveAndNext}
                                                        title="Save"
                                                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                        <span className="hidden sm:inline">Save</span>
                                                    </button>
                                                );
                                            }

                                            if (hasResponse) {
                                                return (
                                                    <button
                                                        onClick={handleSaveAndNext}
                                                        title="Save & Next"
                                                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                        <span className="hidden sm:inline">Save</span>
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                );
                                            }

                                            // Skip / Next (if no response)
                                            return (
                                                <button
                                                    onClick={moveToNext}
                                                    title="Next"
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                                >
                                                    <span className="hidden sm:inline">Next</span>
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>

                    {/* Right Panel - Timer & Navigation (Hidden on mobile, shown on desktop) */}
                    <div className="hidden lg:flex w-72 bg-white border-l flex-col h-full max-h-screen overflow-hidden">
                        {/* Timer */}
                        <div className={`p-4 text-center border-b shrink-0 ${timeRemaining < 300 ? 'bg-red-50' : 'bg-blue-50'}`}>
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <Clock className={`w-5 h-5 ${timeRemaining < 300 ? 'text-red-600' : 'text-blue-600'}`} />
                                <span className="text-sm text-gray-600">Time Remaining</span>
                            </div>
                            <p className={`text-3xl font-mono font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-blue-600'}`}>
                                {formatTimer(timeRemaining)}
                            </p>
                        </div>

                        {/* Submit Button - Moved to top */}
                        <div className="p-3 border-b shrink-0">
                            <button
                                onClick={() => setShowSubmitConfirm(true)}
                                disabled={submitting}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                <Send className="w-4 h-4" />
                                Submit Exam
                            </button>
                        </div>

                        {/* Stats - Compact */}
                        <div className="grid grid-cols-4 gap-1 p-2 text-xs border-b shrink-0 bg-gray-50">
                            <div className="flex flex-col items-center">
                                <span className="w-4 h-4 rounded bg-green-500"></span>
                                <span className="text-gray-500">{answeredCount}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="w-4 h-4 rounded bg-red-500"></span>
                                <span className="text-gray-500">{unansweredCount}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="w-4 h-4 rounded bg-purple-500"></span>
                                <span className="text-gray-500">{markedCount}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="w-4 h-4 rounded bg-gray-300"></span>
                                <span className="text-gray-500">{answerableQuestions.length - visitedQuestions.size}</span>
                            </div>
                        </div>

                        {/* Question Navigation - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-3 min-h-0">
                            {sections.map((section, sIdx) => {
                                const sectionQs = questions.filter(q => q.sectionId === section.id && q.type !== 'paragraph');
                                const isCollapsed = collapsedSections.has(section.id);
                                const sectionAnswered = sectionQs.filter(q => responses[q.id]?.answer?.length > 0).length;
                                return (
                                    <div key={section.id} className="mb-3">
                                        <button
                                            onClick={() => toggleSectionCollapse(section.id)}
                                            className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100 transition"
                                        >
                                            <span className="flex items-center gap-1">
                                                {getText(section.name, language)}
                                                <span className="text-gray-400">({sectionAnswered}/{sectionQs.length})</span>
                                            </span>
                                            {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                                        </button>
                                        {!isCollapsed && (
                                            <div className="grid grid-cols-5 gap-1 mt-2">
                                                {sectionQs.map((q, qIdx) => {
                                                    const status = getQuestionStatus(q.id);
                                                    const isActive = currentSectionIndex === sIdx && currentQuestionIndex === qIdx;
                                                    return (
                                                        <button
                                                            key={q.id}
                                                            onClick={() => goToQuestion(sIdx, qIdx)}
                                                            className={`w-9 h-9 rounded text-sm font-medium transition ${isActive ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                                                                } ${getQuestionStatusColor(status)}`}
                                                        >
                                                            {qIdx + 1}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Mobile Bottom Bar - Only visible on mobile */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
                    <div className="flex items-center justify-between px-4 py-2">
                        {/* Timer */}
                        <div className={`flex items-center gap-2 ${timeRemaining < 300 ? 'text-red-600' : 'text-blue-600'}`}>
                            <Clock className="w-5 h-5" />
                            <span className="font-mono font-bold text-lg">{formatTimer(timeRemaining)}</span>
                        </div>

                        {/* Question Palette Toggle */}
                        <button
                            onClick={() => setShowMobileNav(!showMobileNav)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
                        >
                            <span className="text-green-600 font-medium">{answeredCount}</span>/
                            <span>{answerableQuestions.length}</span>
                            <ChevronUp className={`w-4 h-4 transition ${showMobileNav ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Submit Button */}
                        <button
                            onClick={() => setShowSubmitConfirm(true)}
                            disabled={submitting}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg"
                        >
                            Submit
                        </button>
                    </div>
                </div>

                {/* Mobile Question Navigation Drawer */}
                {showMobileNav && (
                    <div className="lg:hidden fixed inset-0 z-50" onClick={() => setShowMobileNav(false)}>
                        <div className="absolute inset-0 bg-black/50" />
                        <div
                            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
                                <h3 className="font-semibold">Question Navigation</h3>
                                <button onClick={() => setShowMobileNav(false)} className="p-1">
                                    <ChevronDown className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-4 gap-2 p-3 text-xs border-b">
                                <div className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded bg-green-500"></span>
                                    <span>{answeredCount}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded bg-red-500"></span>
                                    <span>{unansweredCount}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded bg-purple-500"></span>
                                    <span>{markedCount}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded bg-gray-300"></span>
                                    <span>{answerableQuestions.length - visitedQuestions.size}</span>
                                </div>
                            </div>

                            {/* Question Grid */}
                            <div className="p-4">
                                {sections.map((section, sIdx) => {
                                    const sectionQs = questions.filter(q => q.sectionId === section.id && q.type !== 'paragraph');
                                    return (
                                        <div key={section.id} className="mb-4">
                                            <p className="text-xs font-medium text-gray-500 mb-2">
                                                {getText(section.name, language)}
                                            </p>
                                            <div className="grid grid-cols-8 gap-1">
                                                {sectionQs.map((q, qIdx) => {
                                                    const status = getQuestionStatus(q.id);
                                                    const isActive = currentSectionIndex === sIdx && currentQuestionIndex === qIdx;
                                                    return (
                                                        <button
                                                            key={q.id}
                                                            onClick={() => {
                                                                goToQuestion(sIdx, qIdx);
                                                                setShowMobileNav(false);
                                                            }}
                                                            className={`w-8 h-8 rounded text-xs font-medium ${isActive ? 'ring-2 ring-blue-600' : ''} ${getQuestionStatusColor(status)}`}
                                                        >
                                                            {qIdx + 1}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Submit Confirmation Modal */}
                {showSubmitConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl max-w-md w-full p-6">
                            <div className="flex items-start gap-3 mb-4">
                                <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-gray-900">Submit Exam?</h3>
                                    {[
                                        { label: 'Time Remaining', value: formatTimer(timeRemaining), color: timeRemaining < 300 ? 'text-red-600 font-bold' : 'text-blue-600 font-mono' }
                                    ].map((item, i) => (
                                        <p key={i} className={`text-sm mt-1 ${item.color}`}>
                                            {item.label}: {item.value}
                                        </p>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                        Answered
                                    </span>
                                    <span className="font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">{answeredCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                        Marked for Review
                                    </span>
                                    <span className="font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">{markedCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                        Not Answered
                                    </span>
                                    <span className="font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">{unansweredCount}</span>
                                </div>
                                <div className="flex justify-between items-center border-t pt-2 mt-2">
                                    <span className="text-gray-500">Total Questions</span>
                                    <span className="font-medium">{answerableQuestions.length}</span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowSubmitConfirm(false)}
                                    className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                                >
                                    Continue Exam
                                </button>
                                <button
                                    onClick={() => handleSubmit(false)}
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {submitting ? 'Submitting...' : 'Submit Now'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab Switch Warning Modal */}
                {showTabWarning && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
                        <div className="bg-white rounded-xl max-w-md w-full p-6 text-center animate-pulse">
                            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Warning!</h3>
                            <p className="text-gray-600 mb-4">
                                You have navigated away from the exam. Return immediately or your exam will be auto-submitted.
                            </p>
                            <div className="text-5xl font-bold text-red-600 mb-4">
                                {tabSwitchCountdown}
                            </div>
                            <p className="text-sm text-gray-500">
                                Violations: {violationCount}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </MathJaxProvider>
    );
}
