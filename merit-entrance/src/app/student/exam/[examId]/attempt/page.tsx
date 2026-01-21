'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore, useExamStore } from '@/lib/store';
import { getText, formatTimer, getQuestionStatusColor } from '@/lib/utils';
import {
    Clock, User, Globe, ChevronLeft, ChevronRight,
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
}

interface ExamData {
    title: Record<string, string>;
    instructions: Record<string, string> | null;
    duration: number;
    totalMarks: number;
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

    // Fullscreen and visibility tracking
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showTabWarning, setShowTabWarning] = useState(false);
    const [tabSwitchCountdown, setTabSwitchCountdown] = useState(10);
    const [violationCount, setViolationCount] = useState(0);

    const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const tabWarningRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // Get questions for current section
    const currentSection = sections[currentSectionIndex];
    const sectionQuestions = questions.filter(q => q.sectionId === currentSection?.id);
    const currentQuestion = sectionQuestions[currentQuestionIndex];

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || user?.role !== 'student') {
            router.push('/');
            return;
        }
        loadExamData();

        return () => {
            if (autoSaveRef.current) clearInterval(autoSaveRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            if (tabWarningRef.current) clearTimeout(tabWarningRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
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
    }, [submitting, showSubmitConfirm]);

    const loadExamData = async () => {
        try {
            const response = await fetch(`/api/student/exam/${examId}`);
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
            const nextSectionQuestions = questions.filter(q => q.sectionId === sections[currentSectionIndex + 1].id);
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
            const prevSectionQuestions = questions.filter(q => q.sectionId === sections[prevSectionIdx].id);
            if (prevSectionQuestions.length > 0) {
                setCurrentQuestionIndex(prevSectionQuestions.length - 1);
                markAsVisited(prevSectionQuestions[prevSectionQuestions.length - 1].id);
            }
        }
    };

    const markAsVisited = (questionId: string) => {
        setVisitedQuestions(prev => new Set(Array.from(prev).concat([questionId])));
    };

    const goToQuestion = (sectionIdx: number, questionIdx: number) => {
        setCurrentSectionIndex(sectionIdx);
        setCurrentQuestionIndex(questionIdx);
        const sectionQs = questions.filter(q => q.sectionId === sections[sectionIdx].id);
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
        <div className="min-h-screen bg-gray-100 flex flex-col">
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
                            const sectionQs = questions.filter(q => q.sectionId === section.id);
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
            <div className="flex-1 flex">
                {/* Question Area */}
                <div className="flex-1 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-sm p-6 max-w-4xl mx-auto">
                        {hasEmptySection ? (
                            /* Empty Section Message */
                            <div className="text-center py-12">
                                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-700 mb-2">No Questions in This Section</h3>
                                <p className="text-gray-500 mb-6">This section does not have any questions yet. Please select another section to continue.</p>
                                <div className="flex justify-center gap-3">
                                    {sections.filter((_, i) => i !== currentSectionIndex && questions.filter(q => q.sectionId === sections[i]?.id).length > 0).length > 0 && (
                                        <button
                                            onClick={() => {
                                                // Find next section with questions
                                                for (let i = currentSectionIndex + 1; i < sections.length; i++) {
                                                    if (questions.filter(q => q.sectionId === sections[i].id).length > 0) {
                                                        setCurrentSectionIndex(i);
                                                        setCurrentQuestionIndex(0);
                                                        return;
                                                    }
                                                }
                                                // Or go to previous section with questions
                                                for (let i = currentSectionIndex - 1; i >= 0; i--) {
                                                    if (questions.filter(q => q.sectionId === sections[i].id).length > 0) {
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
                                        <img
                                            src={currentQuestion.imageUrl}
                                            alt="Question"
                                            className="mt-4 max-w-md rounded-lg"
                                        />
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
                                        className="flex items-center gap-2 px-4 py-2.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                                    >
                                        <Flag className="w-4 h-4" />
                                        Mark for Review & Next
                                    </button>
                                    <button
                                        onClick={handleClearResponse}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Clear Response
                                    </button>
                                    <div className="flex-1"></div>
                                    <button
                                        onClick={moveToPrev}
                                        disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
                                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Previous
                                    </button>
                                    <button
                                        onClick={handleSaveAndNext}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                    >
                                        <Save className="w-4 h-4" />
                                        Save & Next
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>

                {/* Right Panel - Timer & Navigation */}
                <div className="w-72 bg-white border-l flex flex-col">
                    {/* Timer */}
                    <div className={`p-4 text-center border-b ${timeRemaining < 300 ? 'bg-red-50' : 'bg-blue-50'}`}>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Clock className={`w-5 h-5 ${timeRemaining < 300 ? 'text-red-600' : 'text-blue-600'}`} />
                            <span className="text-sm text-gray-600">Time Remaining</span>
                        </div>
                        <p className={`text-3xl font-mono font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-blue-600'}`}>
                            {formatTimer(timeRemaining)}
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 p-3 text-xs border-b">
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded bg-green-500"></span>
                            <span>Answered: {answeredCount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded bg-red-500"></span>
                            <span>Not Ans: {notAnsweredCount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded bg-purple-500"></span>
                            <span>Marked: {markedCount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded bg-gray-300"></span>
                            <span>Not Visited: {questions.length - visitedQuestions.size}</span>
                        </div>
                    </div>

                    {/* Question Navigation */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {sections.map((section, sIdx) => {
                            const sectionQs = questions.filter(q => q.sectionId === section.id);
                            return (
                                <div key={section.id} className="mb-4">
                                    <p className="text-xs font-medium text-gray-500 mb-2">
                                        {getText(section.name, language)}
                                    </p>
                                    <div className="grid grid-cols-5 gap-1">
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
                                </div>
                            );
                        })}
                    </div>

                    {/* Submit Button */}
                    <div className="p-3 border-t">
                        <button
                            onClick={() => setShowSubmitConfirm(true)}
                            disabled={submitting}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                            Submit Exam
                        </button>
                    </div>
                </div>
            </div>

            {/* Submit Confirmation Modal */}
            {showSubmitConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">Submit Exam?</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Are you sure you want to submit? This action cannot be undone.
                                </p>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm">
                            <div className="flex justify-between mb-2">
                                <span>Answered</span>
                                <span className="font-medium text-green-600">{answeredCount}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span>Not Answered</span>
                                <span className="font-medium text-red-600">{visitedQuestions.size - answeredCount}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Not Visited</span>
                                <span className="font-medium text-gray-600">{questions.length - visitedQuestions.size}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSubmitConfirm(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Continue Exam
                            </button>
                            <button
                                onClick={() => handleSubmit(false)}
                                disabled={submitting}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {submitting ? 'Submitting...' : 'Submit'}
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
