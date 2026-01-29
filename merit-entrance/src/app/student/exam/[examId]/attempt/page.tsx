'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useAuthStore, useExamStore } from '@/lib/store';
import { getText, formatTimer, getQuestionStatusColor } from '@/lib/utils';
import {
    Clock, User, Globe, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
    Flag, RotateCcw, Save, Send, AlertCircle, Maximize, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Section {
    id: string;
    name: Record<string, string>;
    order: number;
}

interface Option {
    id: string;
    text: Record<string, string>;
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

    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(0);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [showMobileNav, setShowMobileNav] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    // Fullscreen and visibility tracking
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showTabWarning, setShowTabWarning] = useState(false);
    const [tabSwitchCountdown, setTabSwitchCountdown] = useState(10);
    const [violationCount, setViolationCount] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const tabWarningRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // Get questions for current section - FILTER OUT paragraph type (they are just containers)
    const currentSection = sections[currentSectionIndex];
    const sectionQuestions = questions.filter(q => q.sectionId === currentSection?.id && q.type !== 'paragraph');
    const currentQuestion = sectionQuestions[currentQuestionIndex];

    // All answerable questions (excluding paragraphs) for counts
    const answerableQuestions = questions.filter(q => q.type !== 'paragraph');

    // Helper to get parent paragraph text for a sub-question
    const getParentParagraphText = (question: Question | undefined) => {
        if (!question?.parentId) return null;
        const parent = questions.find(q => q.id === question.parentId);
        return {
            text: parent?.paragraphText || null,
            title: parent?.paragraphTitle || null
        };
    };

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || user?.role !== 'student') {
            router.push('/');
            return;
        }
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

            // Normal Mode: Pause the exam
            // We only pause if not already paused/submitting
            pauseExam();
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

            // Normal Mode: Resume exam
            resumeExam();
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

    const pauseExam = async () => {
        try {
            // Stop local timer
            if (timerRef.current) clearInterval(timerRef.current);
            setIsPaused(true);

            await fetch(`/api/student/exam/${examId}/pause`, {
                method: 'POST',
            });
        } catch (error) {
            console.error('Failed to pause:', error);
        }
    };

    const resumeExam = async () => {
        if (!isPaused) return;

        // Reload data to sync timer from server (which adjusts startedAt)
        await loadExamData();
        setIsPaused(false);
    };

    const loadExamData = async () => {
        try {
            const response = await fetch(`/api/student/exam/${examId}`, { cache: 'no-store' });
            const data = await response.json();

            if (!data.success) {
                toast.error(data.error || 'Failed to load exam');
                router.push('/student/dashboard');
                return;
            }

            setExamData(data.exam);
            setSections(data.sections);
            setQuestions(data.questions);
            setResponses(data.responses);
            setTimeRemaining(data.remainingSeconds);

            // Mark first question as visited
            if (data.questions.length > 0) {
                setVisitedQuestions(new Set([data.questions[0].id]));
            }

            // Start timer
            startTimer(data.remainingSeconds);

            // Start auto-save every 30 seconds
            autoSaveRef.current = setInterval(saveAllResponses, 30000);

        } catch (error) {
            toast.error('Failed to load exam');
            router.push('/student/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const startTimer = (seconds: number) => {
        let remaining = seconds;
        timerRef.current = setInterval(() => {
            remaining--;
            setTimeRemaining(remaining);

            if (remaining <= 0) {
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
            await fetch(`/api/student/exam/${examId}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: currentQuestion.id,
                    answer,
                    markedForReview,
                }),
            });
        } catch (error) {
            console.error('Save failed:', error);
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
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <p className="text-gray-500">Unable to load exam</p>
            </div>
        );
    }

    // Check if current section has no questions (empty section)
    const hasEmptySection = sectionQuestions.length === 0;

    // Stats
    const answeredCount = Object.values(responses).filter(r => r.answer && r.answer.length > 0).length;
    const markedCount = Object.values(responses).filter(r => r.markedForReview).length;
    const notAnsweredCount = visitedQuestions.size - answeredCount;

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col relative">
            {/* Paused Overlay */}
            {isPaused && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Clock className="w-8 h-8 text-blue-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Exam Paused</h2>
                        <p className="text-gray-600 mb-6">
                            You have left the exam window. The timer has been paused.
                            Click the button below to resume.
                        </p>
                        <button
                            onClick={resumeExam}
                            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
                        >
                            Resume Exam
                        </button>
                    </div>
                </div>
            )}

            {/* Top Header */}
            <header className="bg-blue-900 text-white px-4 py-2 flex items-center justify-between">
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
            <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto">
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
                                    <p className="text-lg text-gray-900 leading-relaxed">
                                        {getText(currentQuestion.text, language)}
                                    </p>
                                    {currentQuestion.imageUrl && (
                                        <div className="relative h-64 w-full mt-4 max-w-md">
                                            <Image
                                                src={currentQuestion.imageUrl}
                                                alt="Question"
                                                fill
                                                className="object-contain rounded-lg"
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
                                                        {getText(option.text, language)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-3 mt-8 pt-4 border-t">
                                    <button
                                        onClick={handleMarkForReview}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition ${responses[currentQuestion.id]?.markedForReview
                                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                            }`}
                                    >
                                        <Flag className="w-4 h-4" />
                                        {responses[currentQuestion.id]?.markedForReview ? 'Marked' : 'Mark for Review'}
                                    </button>
                                    {responses[currentQuestion.id]?.answer?.length > 0 && (
                                        <button
                                            onClick={handleClearResponse}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Clear Response
                                        </button>
                                    )}
                                    <div className="flex-1"></div>
                                    <button
                                        onClick={moveToPrev}
                                        disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
                                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Previous
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
                                                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    Save
                                                </button>
                                            );
                                        }

                                        if (hasResponse) {
                                            return (
                                                <button
                                                    onClick={handleSaveAndNext}
                                                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                                >
                                                    <Save className="w-4 h-4" />
                                                    Save & Next
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            );
                                        }

                                        // Skip / Next (if no response)
                                        return (
                                            <button
                                                onClick={moveToNext}
                                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                            >
                                                Next
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
                            <span className="text-gray-500">{notAnsweredCount}</span>
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
                                <span>{notAnsweredCount}</span>
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
                                <span className="font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">{notAnsweredCount}</span>
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
    );
}
