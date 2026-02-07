'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useExamStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import QuestionNav from './QuestionNav';
import QuestionDisplay from './QuestionDisplay';
import SectionTabs from './SectionTabs';
import ActionButtons from './ActionButtons';
import Timer from './Timer';
import { User, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

interface Section {
    id: string;
    name: Record<string, string>;
    order: number;
    questions: Question[];
}

interface Question {
    id: string;
    type: string;
    text: Record<string, string>;
    options: { id: string; text: Record<string, string> }[] | null;
    imageUrl?: string;
    order: number;
    sectionId: string;
    paragraphText?: Record<string, string> | null;
    parentId?: string | null;
}

interface ExamData {
    id: string;
    title: Record<string, string>;
    duration: number;
    sections: Section[];
}

interface ExamInterfaceProps {
    exam: ExamData;
    attemptId: string;
    initialTimeRemaining: number;
}

export default function ExamInterface({ exam, attemptId, initialTimeRemaining }: ExamInterfaceProps) {
    const router = useRouter();
    const { user, language, setLanguage } = useAuthStore();
    const { currentQuestionIndex, setCurrentQuestion, responses, clearExamState } = useExamStore();

    const [currentSectionId, setCurrentSectionId] = useState(exam.sections[0]?.id || '');
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Flatten all questions for navigation
    const allQuestions = exam.sections.flatMap((s) => s.questions);
    const currentQuestion = allQuestions[currentQuestionIndex];
    const currentSection = exam.sections.find((s) => s.id === currentSectionId);

    // Immediate save on response change (debounced)
    useEffect(() => {
        const saveResponses = async () => {
            if (Object.keys(responses).length > 0) {
                try {
                    const { responseTimes, currentQuestionId } = useExamStore.getState();
                    await fetch(`/api/attempts/${attemptId}/save`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            responses,
                            currentQuestionId,
                            responseTimes
                        }),
                    });
                } catch (error) {
                    console.error('Auto-save failed:', error);
                }
            }
        };

        // Debounce: save 2 seconds after last change
        const timeoutId = setTimeout(saveResponses, 2000);
        return () => clearTimeout(timeoutId);
    }, [responses, attemptId]);

    // Update current section when question changes
    useEffect(() => {
        if (currentQuestion) {
            setCurrentSectionId(currentQuestion.sectionId);
        }
    }, [currentQuestionIndex, currentQuestion]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleTimeUp = useCallback(() => {
        toast.error('Time is up! Submitting your exam...');
        handleSubmit(true);
    }, []);

    const handleQuestionClick = (index: number) => {
        const question = allQuestions[index];
        setCurrentQuestion(index, question?.id);
    };

    const handleNext = () => {
        if (currentQuestionIndex < allQuestions.length - 1) {
            const nextIndex = currentQuestionIndex + 1;
            setCurrentQuestion(nextIndex, allQuestions[nextIndex]?.id);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            const prevIndex = currentQuestionIndex - 1;
            setCurrentQuestion(prevIndex, allQuestions[prevIndex]?.id);
        }
    };

    const handleSectionChange = (sectionId: string) => {
        setCurrentSectionId(sectionId);
        const section = exam.sections.find((s) => s.id === sectionId);
        if (section && section.questions.length > 0) {
            const firstQuestionIndex = allQuestions.findIndex(
                (q) => q.id === section.questions[0].id
            );
            if (firstQuestionIndex !== -1) {
                setCurrentQuestion(firstQuestionIndex);
            }
        }
    };

    const handleSubmit = async (isAutoSubmit = false) => {
        setIsSubmitting(true);
        try {
            const response = await fetch(`/api/attempts/${attemptId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    responses,
                    autoSubmit: isAutoSubmit
                }),
            });

            if (response.ok) {
                clearExamState();
                toast.success('Exam submitted successfully!');
                router.push(`/student/results/${attemptId}`);
            } else {
                throw new Error('Failed to submit');
            }
        } catch (error) {
            toast.error('Failed to submit exam. Please try again.');
            setIsSubmitting(false);
        }
    };

    const getAnsweredCount = () => {
        return Object.values(responses).filter((r) => {
            if (r.answer === null || r.answer === undefined) return false;
            if (Array.isArray(r.answer) && r.answer.length === 0) return false;
            if (typeof r.answer === 'string' && r.answer.trim() === '') return false;
            return true;
        }).length;
    };

    const getMarkedCount = () => {
        return Object.values(responses).filter((r) => r.markedForReview).length;
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            {/* Header */}
            <header className="bg-blue-600 text-white shadow-md">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* Title */}
                        <h1 className="text-lg font-bold truncate">
                            {getText(exam.title, language)}
                        </h1>

                        {/* Timer and User Info */}
                        <div className="flex items-center gap-4">
                            <Timer
                                initialSeconds={initialTimeRemaining}
                                onTimeUp={handleTimeUp}
                            />

                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5" />
                                </div>
                                <span className="hidden sm:inline text-sm">{user?.name}</span>
                            </div>

                            {/* Language Toggle */}
                            <button
                                onClick={() => setLanguage(language === 'en' ? 'pa' : 'en')}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 rounded-lg hover:bg-blue-400 transition text-sm"
                            >
                                <Globe className="w-4 h-4" />
                                {language === 'en' ? 'ਪੰਜਾਬੀ' : 'English'}
                            </button>
                        </div>
                    </div>

                    {/* Section Tabs */}
                    <div className="mt-3">
                        <SectionTabs
                            sections={exam.sections}
                            currentSectionId={currentSectionId}
                            onSectionChange={handleSectionChange}
                        />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4">
                {/* Question Navigation (Left Sidebar on Desktop) */}
                <div className="lg:w-64 order-2 lg:order-1">
                    <QuestionNav
                        questions={allQuestions}
                        onQuestionClick={handleQuestionClick}
                    />
                </div>

                {/* Question Display (Main Area) */}
                <div className="flex-1 order-1 lg:order-2">
                    {currentQuestion && (
                        <QuestionDisplay
                            question={currentQuestion}
                            totalQuestions={allQuestions.length}
                            parentParagraphText={
                                currentQuestion.parentId
                                    ? allQuestions.find(q => q.id === currentQuestion.parentId)?.paragraphText
                                    : null
                            }
                            allQuestions={allQuestions.map(q => ({ id: q.id, parentId: q.parentId, order: q.order }))}
                        />
                    )}
                </div>
            </div>

            {/* Action Buttons (Footer) */}
            <div className="p-4 border-t bg-white">
                {currentQuestion && (
                    <ActionButtons
                        currentQuestionId={currentQuestion.id}
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        onSubmit={() => setShowSubmitConfirm(true)}
                        isFirst={currentQuestionIndex === 0}
                        isLast={currentQuestionIndex === allQuestions.length - 1}
                    />
                )}
            </div>

            {/* Submit Confirmation Modal */}
            {showSubmitConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">
                            Submit Exam?
                        </h3>
                        <div className="space-y-2 mb-6 text-gray-600">
                            <p>Total Questions: {allQuestions.length}</p>
                            <p className="text-green-600">Answered: {getAnsweredCount()}</p>
                            <p className="text-red-600">
                                Unanswered: {allQuestions.length - getAnsweredCount()}
                            </p>
                            <p className="text-purple-600">Marked for Review: {getMarkedCount()}</p>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">
                            Are you sure you want to submit? You cannot change answers after submission.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSubmitConfirm(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSubmit(false)}
                                disabled={isSubmitting}
                                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Submitting...' : 'Confirm Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
