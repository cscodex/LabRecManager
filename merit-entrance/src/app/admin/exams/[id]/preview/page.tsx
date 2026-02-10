'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import {
    ChevronLeft, ChevronRight, Clock, Flag, CheckCircle,
    Circle, AlertCircle, Menu, X, Eye, BookOpen
} from 'lucide-react';
import Image from 'next/image';

interface Option {
    id: string;
    text: Record<string, string>;
    image_url?: string;
}

interface Question {
    id: string;
    type: string;
    text: Record<string, string>;
    options: Option[] | null;
    correct_answer: string[];
    explanation: Record<string, string> | null;
    marks: number;
    negative_marks: number | null;
    order: number;
    image_url?: string;
    paragraph_text?: Record<string, string> | null;
    parent_id?: string | null;
    tags?: { id: string; name: string }[];
}

interface Section {
    id: string;
    name: Record<string, string>;
    order: number;
    duration: number | null;
    questions: Question[];
}

interface Exam {
    id: string;
    title: Record<string, string>;
    description: Record<string, string> | null;
    instructions: Record<string, string> | null;
    duration: number;
    total_marks: number;
    negative_marking: number | null;
    sections: Section[];
}

type QuestionStatus = 'not_visited' | 'not_answered' | 'answered' | 'marked' | 'marked_answered';

export default function ExamPreviewPage() {
    const params = useParams();
    const router = useRouter();
    const examId = params.id as string;
    const { language, setLanguage } = useAuthStore();

    const [exam, setExam] = useState<Exam | null>(null);
    const [loading, setLoading] = useState(true);
    const [showInstructions, setShowInstructions] = useState(true);
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string[]>>({});
    const [questionStatus, setQuestionStatus] = useState<Record<string, QuestionStatus>>({});
    const [showPalette, setShowPalette] = useState(true);
    const [examStarted, setExamStarted] = useState(false);

    // Sidebar collapse state
    const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());


    const loadExam = useCallback(async () => {
        try {
            // Get exam details
            const examRes = await fetch(`/api/admin/exams/${examId}`);
            const examData = await examRes.json();

            if (!examData.success) {
                throw new Error('Failed to load exam');
            }

            // Load questions for each section
            const sectionsWithQuestions = await Promise.all(
                examData.exam.sections.map(async (section: any) => {
                    const qRes = await fetch(`/api/admin/exams/${examId}/sections/${section.id}/questions`);
                    const qData = await qRes.json();
                    return {
                        ...section,
                        questions: qData.success ? qData.questions : [],
                    };
                })
            );

            const fullExam = {
                ...examData.exam,
                sections: sectionsWithQuestions,
            };

            setExam(fullExam);
            setTimeRemaining(fullExam.duration * 60);

            // Initialize question status
            const initialStatus: Record<string, QuestionStatus> = {};
            sectionsWithQuestions.forEach((section: Section) => {
                section.questions.forEach((q: Question) => {
                    initialStatus[q.id] = 'not_visited';
                });
            });
            setQuestionStatus(initialStatus);
        } catch (error) {
            console.error('Error loading exam:', error);
        } finally {
            setLoading(false);
        }
    }, [examId]);

    useEffect(() => {
        loadExam();
    }, [loadExam]);

    // Timer
    useEffect(() => {
        if (!examStarted || timeRemaining <= 0) return;

        const timer = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [examStarted, timeRemaining]);



    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startExam = () => {
        setShowInstructions(false);
        setExamStarted(true);
        // Mark first question as visited
        if (exam && exam.sections.length > 0 && exam.sections[0].questions.length > 0) {
            const firstQ = exam.sections[0].questions[0];
            setQuestionStatus(prev => ({ ...prev, [firstQ.id]: 'not_answered' }));
        }
    };

    const currentSection = exam?.sections[currentSectionIndex];
    const currentQuestion = currentSection?.questions[currentQuestionIndex];
    const allQuestions = exam?.sections.flatMap(s => s.questions) || [];

    const navigateToQuestion = (sectionIdx: number, questionIdx: number) => {
        if (!exam) return;

        // Update status of current question before leaving
        if (currentQuestion) {
            const status = questionStatus[currentQuestion.id];
            if (status === 'not_visited') {
                setQuestionStatus(prev => ({ ...prev, [currentQuestion.id]: 'not_answered' }));
            }
        }

        setCurrentSectionIndex(sectionIdx);
        setCurrentQuestionIndex(questionIdx);

        // Mark new question as visited if not visited
        const newSection = exam.sections[sectionIdx];
        const newQuestion = newSection?.questions[questionIdx];
        if (newQuestion && questionStatus[newQuestion.id] === 'not_visited') {
            setQuestionStatus(prev => ({ ...prev, [newQuestion.id]: 'not_answered' }));
        }
    };

    const toggleSectionCollapse = (sectionIdx: number) => {
        setCollapsedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionIdx)) {
                newSet.delete(sectionIdx);
            } else {
                newSet.add(sectionIdx);
            }
            return newSet;
        });
    };

    const handleOptionSelect = (optionId: string) => {
        if (!currentQuestion) return;

        const qType = currentQuestion.type;
        const currentAnswers = answers[currentQuestion.id] || [];

        let newAnswers: string[];
        if (qType === 'mcq_single') {
            newAnswers = [optionId];
        } else {
            if (currentAnswers.includes(optionId)) {
                newAnswers = currentAnswers.filter(a => a !== optionId);
            } else {
                newAnswers = [...currentAnswers, optionId];
            }
        }

        setAnswers(prev => ({ ...prev, [currentQuestion.id]: newAnswers }));

        // Update status
        if (newAnswers.length > 0) {
            const isMarked = questionStatus[currentQuestion.id]?.includes('marked');
            setQuestionStatus(prev => ({
                ...prev,
                [currentQuestion.id]: isMarked ? 'marked_answered' : 'answered',
            }));
        } else {
            const isMarked = questionStatus[currentQuestion.id]?.includes('marked');
            setQuestionStatus(prev => ({
                ...prev,
                [currentQuestion.id]: isMarked ? 'marked' : 'not_answered',
            }));
        }
    };

    const handleFillBlankAnswer = (value: string) => {
        if (!currentQuestion) return;
        setAnswers(prev => ({ ...prev, [currentQuestion.id]: [value] }));
        if (value.trim()) {
            const isMarked = questionStatus[currentQuestion.id]?.includes('marked');
            setQuestionStatus(prev => ({
                ...prev,
                [currentQuestion.id]: isMarked ? 'marked_answered' : 'answered',
            }));
        }
    };

    const markForReview = () => {
        if (!currentQuestion) return;
        const current = questionStatus[currentQuestion.id];
        const hasAnswer = (answers[currentQuestion.id]?.length || 0) > 0;

        if (current === 'marked' || current === 'marked_answered') {
            setQuestionStatus(prev => ({
                ...prev,
                [currentQuestion.id]: hasAnswer ? 'answered' : 'not_answered',
            }));
        } else {
            setQuestionStatus(prev => ({
                ...prev,
                [currentQuestion.id]: hasAnswer ? 'marked_answered' : 'marked',
            }));
        }
    };

    const clearResponse = () => {
        if (!currentQuestion) return;
        setAnswers(prev => {
            const newAnswers = { ...prev };
            delete newAnswers[currentQuestion.id];
            return newAnswers;
        });
        const isMarked = questionStatus[currentQuestion.id]?.includes('marked');
        setQuestionStatus(prev => ({
            ...prev,
            [currentQuestion.id]: isMarked ? 'marked' : 'not_answered',
        }));
    };

    const goNext = () => {
        if (!exam) return;
        if (currentQuestionIndex < (currentSection?.questions.length || 0) - 1) {
            navigateToQuestion(currentSectionIndex, currentQuestionIndex + 1);
        } else if (currentSectionIndex < exam.sections.length - 1) {
            navigateToQuestion(currentSectionIndex + 1, 0);
        }
    };

    const goPrev = () => {
        if (currentQuestionIndex > 0) {
            navigateToQuestion(currentSectionIndex, currentQuestionIndex - 1);
        } else if (currentSectionIndex > 0 && exam) {
            const prevSection = exam.sections[currentSectionIndex - 1];
            navigateToQuestion(currentSectionIndex - 1, prevSection.questions.length - 1);
        }
    };

    const getStatusCounts = () => {
        const counts = { answered: 0, not_answered: 0, marked: 0, not_visited: 0 };
        Object.values(questionStatus).forEach(status => {
            if (status === 'answered' || status === 'marked_answered') counts.answered++;
            else if (status === 'not_answered') counts.not_answered++;
            else if (status === 'marked') counts.marked++;
            else counts.not_visited++;
        });
        return counts;
    };

    // Helper for sidebar status colors
    const getQuestionStatusColor = (status: string) => {
        switch (status) {
            case 'answered': return 'bg-green-500 text-white border-green-600';
            case 'marked': return 'bg-purple-500 text-white border-purple-600';
            case 'marked_answered': return 'bg-purple-500 text-white border-purple-600 ring-2 ring-green-400';
            case 'not_answered': return 'bg-red-500 text-white border-red-600';
            default: return 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <p className="text-gray-500">Exam not found</p>
            </div>
        );
    }

    // Instructions Screen
    if (showInstructions) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {getText(exam.title, language)}
                        </h1>
                        <p className="text-blue-200">
                            {exam.duration} minutes • {exam.total_marks} marks • {allQuestions.length} questions
                        </p>
                    </div>

                    {/* Instructions Card */}
                    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                        <div className="bg-blue-50 px-6 py-4 border-b">
                            <h2 className="text-xl font-semibold text-gray-900">
                                {language === 'en' ? 'Instructions' : 'ਹਦਾਇਤਾਂ'}
                            </h2>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            {exam.instructions && (exam.instructions.en || exam.instructions.pa) ? (
                                <div
                                    className="prose prose-blue max-w-none text-gray-700"
                                    dangerouslySetInnerHTML={{ __html: getText(exam.instructions, language) }}
                                />
                            ) : (
                                <div className="space-y-3 text-gray-700">
                                    <p>• {language === 'en' ? 'Read each question carefully before answering.' : 'ਜਵਾਬ ਦੇਣ ਤੋਂ ਪਹਿਲਾਂ ਹਰ ਸਵਾਲ ਧਿਆਨ ਨਾਲ ਪੜ੍ਹੋ।'}</p>
                                    <p>• {language === 'en' ? 'You can navigate between questions using the palette on the right.' : 'ਤੁਸੀਂ ਸੱਜੇ ਪਾਸੇ ਪੈਲੇਟ ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਸਵਾਲਾਂ ਵਿਚਕਾਰ ਨੈਵੀਗੇਟ ਕਰ ਸਕਦੇ ਹੋ।'}</p>
                                    <p>• {language === 'en' ? 'Mark questions for review if you want to revisit them.' : 'ਜੇ ਤੁਸੀਂ ਉਹਨਾਂ ਨੂੰ ਦੁਬਾਰਾ ਦੇਖਣਾ ਚਾਹੁੰਦੇ ਹੋ ਤਾਂ ਸਮੀਖਿਆ ਲਈ ਸਵਾਲਾਂ ਨੂੰ ਚਿੰਨ੍ਹਿਤ ਕਰੋ।'}</p>
                                    {exam.negative_marking && (
                                        <p className="text-red-600">• {language === 'en' ? `Negative marking: ${exam.negative_marking} marks will be deducted for wrong answers.` : `ਨਕਾਰਾਤਮਕ ਅੰਕ: ਗਲਤ ਜਵਾਬਾਂ ਲਈ ${exam.negative_marking} ਅੰਕ ਕੱਟੇ ਜਾਣਗੇ।`}</p>
                                    )}
                                    <p>• {language === 'en' ? 'The timer will start once you click "Start Exam".' : '"ਪ੍ਰੀਖਿਆ ਸ਼ੁਰੂ ਕਰੋ" \'ਤੇ ਕਲਿੱਕ ਕਰਨ \'ਤੇ ਟਾਈਮਰ ਸ਼ੁਰੂ ਹੋ ਜਾਵੇਗਾ।'}</p>
                                </div>
                            )}
                        </div>

                        {/* Language Toggle and Start Button */}
                        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
                            <button
                                onClick={() => setLanguage(language === 'en' ? 'pa' : 'en')}
                                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-white"
                            >
                                <span className="text-sm">{language === 'en' ? 'ਪੰਜਾਬੀ' : 'English'}</span>
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => router.back()}
                                    className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-white"
                                >
                                    {language === 'en' ? 'Back' : 'ਵਾਪਸ'}
                                </button>
                                <button
                                    onClick={startExam}
                                    className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                >
                                    {language === 'en' ? 'Start Exam' : 'ਪ੍ਰੀਖਿਆ ਸ਼ੁਰੂ ਕਰੋ'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-6 bg-white/10 rounded-xl p-4">
                        <p className="text-sm text-blue-100 text-center">
                            {language === 'en'
                                ? 'This is a preview mode. Your answers will not be saved.'
                                : 'ਇਹ ਪ੍ਰੀਵਿਊ ਮੋਡ ਹੈ। ਤੁਹਾਡੇ ਜਵਾਬ ਸੇਵ ਨਹੀਂ ਕੀਤੇ ਜਾਣਗੇ।'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Main Exam Interface
    const statusCounts = getStatusCounts();

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            {/* Top Header */}
            <header className="bg-white border-b sticky top-0 z-20">
                <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-gray-900 truncate max-w-xs">
                            {getText(exam.title, language)}
                        </h1>
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                            PREVIEW
                        </span>
                    </div>

                    {/* Timer */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg ${timeRemaining < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                        <Clock className="w-5 h-5" />
                        <span className="font-bold">{formatTime(timeRemaining)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setLanguage(language === 'en' ? 'pa' : 'en')}
                            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                        >
                            {language === 'en' ? 'ਪੰ' : 'EN'}
                        </button>
                        <button
                            onClick={() => setShowPalette(!showPalette)}
                            className="md:hidden p-2 border rounded-lg"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => router.back()}
                            className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                        >
                            Exit Preview
                        </button>
                    </div>
                </div>

                {/* Section Tabs */}
                <div className="flex overflow-x-auto border-t bg-gray-50">
                    {exam.sections.map((section, idx) => (
                        <button
                            key={section.id}
                            onClick={() => navigateToQuestion(idx, 0)}
                            className={`px-6 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${currentSectionIndex === idx
                                ? 'border-blue-600 text-blue-600 bg-white'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            {getText(section.name, language)}
                        </button>
                    ))}
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Question Area */}
                <main className={`flex-1 overflow-y-auto p-4 md:p-6 ${showPalette ? '' : ''}`}>
                    {currentQuestion && (
                        <div className="max-w-3xl mx-auto">
                            {/* Question Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <span className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold">
                                        {currentQuestion.type === 'paragraph' ? (
                                            <BookOpen className="w-5 h-5" />
                                        ) : (
                                            (() => {
                                                // Calculate display number by counting only non-paragraph questions before this one
                                                const displayNum = allQuestions
                                                    .filter((q, idx) => q.type !== 'paragraph' &&
                                                        allQuestions.findIndex(allQ => allQ.id === q.id) <= allQuestions.findIndex(allQ => allQ.id === currentQuestion.id)
                                                    ).length;
                                                return displayNum;
                                            })()
                                        )}
                                    </span>
                                    <div>
                                        <span className="text-sm text-gray-500">
                                            {getText(currentSection?.name || {}, language)}
                                        </span>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            {currentQuestion.type !== 'paragraph' && (
                                                <>
                                                    <span>Marks: {currentQuestion.marks}</span>
                                                    {currentQuestion.negative_marks && (
                                                        <span className="text-red-500">-{currentQuestion.negative_marks}</span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        {currentQuestion.tags && currentQuestion.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {currentQuestion.tags.map(tag => (
                                                    <span key={tag.id} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] border border-blue-100 font-medium">
                                                        {tag.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${currentQuestion.type === 'mcq_single' ? 'bg-blue-100 text-blue-700' :
                                    currentQuestion.type === 'mcq_multiple' ? 'bg-purple-100 text-purple-700' :
                                        currentQuestion.type === 'paragraph' ? 'bg-gray-100 text-gray-700' :
                                            'bg-orange-100 text-orange-700'
                                    }`}>
                                    {currentQuestion.type === 'mcq_single' ? 'Single Choice' :
                                        currentQuestion.type === 'mcq_multiple' ? 'Multiple Choice' :
                                            currentQuestion.type === 'paragraph' ? 'Passage' : 'Fill Blank'}
                                </span>
                            </div>

                            {/* Question Card */}
                            <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
                                {/* Show Parent Paragraph for sub-questions */}
                                {currentQuestion.parent_id && (() => {
                                    const parentPara = allQuestions.find(q => q.id === currentQuestion.parent_id);
                                    if (parentPara?.paragraph_text) {
                                        return (
                                            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 h-96 overflow-y-auto">
                                                <p className="text-sm font-medium text-blue-700 mb-2 sticky top-0 bg-blue-50 pb-1 z-10 flex items-center gap-2">
                                                    <BookOpen className="w-4 h-4" />
                                                    {getText(parentPara.text, language)}
                                                </p>
                                                <div
                                                    className="text-gray-800 text-base leading-relaxed prose prose-sm max-w-none whitespace-pre-wrap break-words"
                                                    dangerouslySetInnerHTML={{ __html: getText(parentPara.paragraph_text, language) }}
                                                />
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* For Paragraph Type - Show passage and linked questions info */}
                                {currentQuestion.type === 'paragraph' ? (
                                    <>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                            <BookOpen className="w-5 h-5 text-gray-500" />
                                            {getText(currentQuestion.text, language)}
                                        </h3>
                                        {currentQuestion.paragraph_text && (
                                            <div className="p-4 bg-gray-50 rounded-lg border mb-4 h-96 overflow-y-auto">
                                                <div
                                                    className="text-gray-900 leading-relaxed text-base prose prose-sm max-w-none whitespace-pre-wrap break-words font-serif"
                                                    dangerouslySetInnerHTML={{ __html: getText(currentQuestion.paragraph_text, language) }}
                                                />
                                            </div>
                                        )}
                                        {/* Show linked sub-questions */}
                                        {(() => {
                                            const linkedQuestions = allQuestions.filter(q => q.parent_id === currentQuestion.id);
                                            if (linkedQuestions.length > 0) {
                                                const linkedNums = linkedQuestions.map(lq => {
                                                    // Calculate display number relative to all answerable questions
                                                    const displayNum = allQuestions
                                                        .filter((q, idx) => q.type !== 'paragraph' &&
                                                            allQuestions.findIndex(allQ => allQ.id === q.id) <= allQuestions.findIndex(allQ => allQ.id === lq.id)
                                                        ).length;
                                                    return displayNum;
                                                }).join(', ');
                                                return (
                                                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                                        <p className="text-sm text-green-700">
                                                            📝 <strong>Linked Questions:</strong> {linkedNums}
                                                        </p>
                                                        <p className="text-xs text-green-600 mt-1">
                                                            Navigate to these questions to answer based on this passage.
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <p className="text-sm text-gray-500 italic">
                                                    No sub-questions linked to this paragraph yet.
                                                </p>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <>
                                        <p className="text-gray-900 text-lg mb-4 whitespace-pre-wrap font-medium">
                                            {getText(currentQuestion.text, language)}
                                        </p>

                                        {currentQuestion.image_url && (
                                            <div className="relative h-64 w-full mb-4">
                                                <Image
                                                    src={currentQuestion.image_url}
                                                    alt="Question"
                                                    fill
                                                    className="object-contain rounded-lg border"
                                                />
                                            </div>
                                        )}

                                        {/* Options or Fill Blank */}
                                        {currentQuestion.type === 'fill_blank' ? (
                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    {language === 'en' ? 'Your Answer:' : 'ਤੁਹਾਡਾ ਜਵਾਬ:'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={answers[currentQuestion.id]?.[0] || ''}
                                                    onChange={(e) => handleFillBlankAnswer(e.target.value)}
                                                    className="w-full px-4 py-3 border-2 rounded-lg focus:border-blue-500 focus:ring-0"
                                                    placeholder={language === 'en' ? 'Type your answer here...' : 'ਆਪਣਾ ਜਵਾਬ ਇੱਥੇ ਟਾਈਪ ਕਰੋ...'}
                                                />
                                            </div>
                                        ) : currentQuestion.options && (
                                            <div className="space-y-3">
                                                {currentQuestion.options.map((opt) => {
                                                    const isSelected = answers[currentQuestion.id]?.includes(opt.id);
                                                    return (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => handleOptionSelect(opt.id)}
                                                            className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${isSelected
                                                                ? 'border-blue-500 bg-blue-50'
                                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                                                                }`}>
                                                                {opt.id.toUpperCase()}
                                                            </span>
                                                            <div className="flex-1 text-left">
                                                                {opt.image_url && (
                                                                    <div className="relative h-20 w-auto mb-2">
                                                                        <Image
                                                                            src={opt.image_url}
                                                                            alt=""
                                                                            width={200}
                                                                            height={80}
                                                                            className="max-h-20 w-auto rounded object-contain"
                                                                        />
                                                                    </div>
                                                                )}
                                                                <span className="text-gray-800">{getText(opt.text, language)}</span>
                                                            </div>
                                                            {isSelected && <CheckCircle className="w-5 h-5 text-blue-500" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-3 mb-4">
                                <button
                                    onClick={markForReview}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg ${questionStatus[currentQuestion.id]?.includes('marked')
                                        ? 'bg-purple-100 text-purple-700 border border-purple-300'
                                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <Flag className="w-4 h-4" />
                                    {language === 'en' ? 'Mark for Review' : 'ਸਮੀਖਿਆ ਲਈ ਚਿੰਨ੍ਹਿਤ ਕਰੋ'}
                                </button>
                                <button
                                    onClick={clearResponse}
                                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                >
                                    {language === 'en' ? 'Clear Response' : 'ਜਵਾਬ ਸਾਫ਼ ਕਰੋ'}
                                </button>
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-between">
                                <button
                                    onClick={goPrev}
                                    disabled={currentSectionIndex === 0 && currentQuestionIndex === 0}
                                    className="flex items-center gap-2 px-6 py-3 bg-white border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                    {language === 'en' ? 'Previous' : 'ਪਿਛਲਾ'}
                                </button>
                                <button
                                    onClick={goNext}
                                    disabled={
                                        currentSectionIndex === exam.sections.length - 1 &&
                                        currentQuestionIndex === (currentSection?.questions.length || 0) - 1
                                    }
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                                >
                                    {language === 'en' ? 'Save & Next' : 'ਸੇਵ ਅਤੇ ਅਗਲਾ'}
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </main>

                {/* Question Palette Sidebar */}
                <aside className={`w-80 bg-white border-l flex-shrink-0 overflow-y-auto transition-transform ${showPalette ? 'translate-x-0' : 'translate-x-full absolute right-0 top-0 bottom-0 md:translate-x-0 md:relative'
                    }`}>
                    {/* Mobile close */}
                    <div className="md:hidden p-2 border-b flex justify-end">
                        <button onClick={() => setShowPalette(false)} className="p-2">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Status Legend */}
                    <div className="p-4 border-b">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-green-500"></span>
                                <span>Answered ({statusCounts.answered})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-red-500"></span>
                                <span>Not Answered ({statusCounts.not_answered})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-purple-500"></span>
                                <span>Marked ({statusCounts.marked})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-gray-300"></span>
                                <span>Not Visited ({statusCounts.not_visited})</span>
                            </div>
                        </div>
                    </div>

                    {/* Question Grid by Section */}
                    <div className="p-4 space-y-4">
                        {exam.sections.map((section, sIdx) => {
                            const isCollapsed = collapsedSections.has(sIdx);
                            const sectionQs = section.questions;
                            const sectionAnswered = sectionQs.filter(q => {
                                const st = questionStatus[q.id];
                                return st === 'answered' || st === 'marked_answered';
                            }).length;

                            return (
                                <div key={section.id} className="bg-white border rounded-lg overflow-hidden shadow-sm">
                                    <button
                                        onClick={() => toggleSectionCollapse(sIdx)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition border-b"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <span className="font-bold">{getText(section.name, language)}</span>
                                            <span className="text-gray-400 font-normal">({sectionAnswered}/{sectionQs.length})</span>
                                        </span>
                                        {isCollapsed ? <ChevronLeft className="w-3 h-3 rotate-180" /> : <ChevronLeft className="w-3 h-3 -rotate-90" />}
                                    </button>

                                    {!isCollapsed && (
                                        <div className="grid grid-cols-5 gap-1.5 p-2">
                                            {sectionQs.map((q, qIdx) => {
                                                const status = questionStatus[q.id];
                                                const isActive = sIdx === currentSectionIndex && qIdx === currentQuestionIndex;

                                                // Calculate display number
                                                const displayNum = allQuestions
                                                    .filter((aq, idx) => aq.type !== 'paragraph' &&
                                                        allQuestions.findIndex(allQ => allQ.id === aq.id) <= allQuestions.findIndex(allQ => allQ.id === q.id)
                                                    ).length;

                                                return (
                                                    <button
                                                        key={q.id}
                                                        onClick={() => navigateToQuestion(sIdx, qIdx)}
                                                        className={`w-8 h-8 rounded text-xs font-bold transition flex items-center justify-center border ${isActive ? 'ring-2 ring-blue-600 ring-offset-1 z-10' : ''
                                                            } ${getQuestionStatusColor(status || 'not_visited')}`}
                                                        title={isActive ? 'Current Question' : ''}
                                                    >
                                                        {q.type === 'paragraph' ? <BookOpen className="w-4 h-4" /> : displayNum}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </aside>
            </div>
        </div>
    );
}
