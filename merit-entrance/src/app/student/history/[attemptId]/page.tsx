'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { getText, formatDateTimeIST } from '@/lib/utils';
import { ChevronLeft, CheckCircle, XCircle, MinusCircle, BookOpen, AlertCircle, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface DetailedQuestion {
    id: string;
    text: Record<string, string>;
    type: 'mcq' | 'true_false' | 'short_answer';
    marks: number;
    options: any[];
    correctAnswer: any;
    explanation: Record<string, string> | null;
    imageUrl?: string;
    studentResponse: any;
    isCorrect: boolean | null;
    marksAwarded: number;
    sectionTitle: Record<string, string>;
    passageContent?: Record<string, string>;
    passageTitle?: Record<string, string>;
    passageId?: string;
    tags?: { id: string; name: string }[];
}

interface ExamDetails {
    id: string;
    title: Record<string, string>;
    totalMarks: number;
    score: number;
    startedAt: string;
    submittedAt: string;
    duration: number;
}

export default function DetailedResultPage({ params }: { params: { attemptId: string } }) {
    const router = useRouter();
    const { user, language, isAuthenticated, _hasHydrated } = useAuthStore();
    const [exam, setExam] = useState<ExamDetails | null>(null);
    const [questions, setQuestions] = useState<DetailedQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSectionIndex, setActiveSectionIndex] = useState(0);

    useEffect(() => {
        const loadDetails = async () => {
            try {
                const response = await fetch(`/api/student/history/${params.attemptId}`);
                const data = await response.json();
                if (data.success) {
                    setExam(data.exam);
                    setQuestions(data.questions);
                } else {
                    toast.error(data.error || 'Failed to load results');
                    router.push('/student/history');
                }
            } catch (error) {
                toast.error('Failed to load results');
            } finally {
                setLoading(false);
            }
        };

        if (!_hasHydrated) return;
        if (!isAuthenticated || user?.role !== 'student') {
            router.push('/');
            return;
        }
        loadDetails();
    }, [_hasHydrated, isAuthenticated, user, router, params.attemptId]);

    // Group questions by section
    const sections = useMemo(() => {
        if (!questions.length) return [];
        const sectionMap = new Map<string, { title: Record<string, string>, questions: DetailedQuestion[] }>();

        questions.forEach(q => {
            const titleKey = JSON.stringify(q.sectionTitle); // Using title as key proxy, ideally use ID if available
            if (!sectionMap.has(titleKey)) {
                sectionMap.set(titleKey, { title: q.sectionTitle, questions: [] });
            }
            sectionMap.get(titleKey)!.questions.push(q);
        });

        return Array.from(sectionMap.values());
    }, [questions]);

    // Optimize passage grouping within active section
    const activeSectionContent = useMemo(() => {
        if (!sections[activeSectionIndex]) return [];

        const sectionQuestions = sections[activeSectionIndex].questions;
        const groupedContent: { type: 'passage' | 'question', data: any }[] = [];
        const processedPassages = new Set<string>();

        sectionQuestions.forEach(q => {
            // Check if question belongs to a passage
            if (q.passageId && !processedPassages.has(q.passageId)) {
                // Add passage block once
                processedPassages.add(q.passageId);
                groupedContent.push({
                    type: 'passage',
                    data: {
                        id: q.passageId,
                        title: q.passageTitle,
                        content: q.passageContent
                    }
                });
            }
            // Always add the question (it will naturally follow its passage if it's the first one, or just appear if subsequent)
            // Ideally questions sharing a passage are sequential. If not, this logic assumes sort order is correct.
            groupedContent.push({ type: 'question', data: q });
        });

        return groupedContent;
    }, [sections, activeSectionIndex]);


    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!exam) return null;

    const percentage = Math.round((exam.score / exam.totalMarks) * 100);
    const correctCount = questions.filter(q => q.isCorrect).length;
    const wrongCount = questions.filter(q => q.studentResponse && !q.isCorrect).length;
    const unattemptedCount = questions.length - (correctCount + wrongCount);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden">
            {/* Header */}
            <header className="bg-white shadow-sm flex-shrink-0 z-30">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.back()}
                                className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                                    {getText(exam.title, language)}
                                </h1>
                                <p className="text-xs text-gray-500">
                                    {formatDateTimeIST(exam.submittedAt)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-50 px-3 py-1 rounded-full text-blue-700 text-sm font-semibold">
                                Score: {exam.score} / {exam.totalMarks}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content Area - Scrollable Questions */}
                <main className="flex-1 flex flex-col min-w-0 bg-gray-50">
                    {/* Section Tabs */}
                    <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide">
                        {sections.map((section, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveSectionIndex(idx)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${activeSectionIndex === idx
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {getText(section.title, language)}
                            </button>
                        ))}
                    </div>

                    {/* Scrollable Container */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
                        <div className="max-w-4xl mx-auto space-y-6 pb-20">
                            {activeSectionContent.map((item: any, index) => {
                                if (item.type === 'passage') {
                                    return (
                                        <div key={`pass-${item.data.id}`} className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                                            <p className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-wider flex items-center gap-2">
                                                <BookOpen className="w-4 h-4" />
                                                {item.data.title ? getText(item.data.title, language) : 'Reading Passage'}
                                            </p>
                                            <div
                                                className="text-gray-800 text-sm leading-relaxed prose prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{ __html: getText(item.data.content, language) }}
                                            />
                                        </div>
                                    );
                                }

                                const q = item.data as DetailedQuestion;
                                const isCorrect = q.isCorrect;
                                const userSkipped = q.studentResponse === null || q.studentResponse === undefined;

                                let borderColor = 'border-gray-200';
                                let statusColor = 'text-gray-500';
                                let statusIcon = <MinusCircle className="w-4 h-4" />;
                                let statusText = 'Skipped';

                                if (isCorrect) {
                                    borderColor = 'border-green-200';
                                    statusColor = 'text-green-600';
                                    statusIcon = <CheckCircle className="w-4 h-4" />;
                                    statusText = 'Correct';
                                } else if (!userSkipped) {
                                    borderColor = 'border-red-200';
                                    statusColor = 'text-red-600';
                                    statusIcon = <XCircle className="w-4 h-4" />;
                                    statusText = 'Wrong';
                                }

                                return (
                                    <div key={q.id} className={`bg-white rounded-xl border ${borderColor} shadow-sm overflow-hidden`}>
                                        {/* Question Header */}
                                        <div className="bg-gray-50/50 px-4 py-2 border-b flex items-center justify-between text-xs sm:text-sm">
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold text-gray-700">Question</span>
                                                {q.tags && q.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {q.tags.map(tag => (
                                                            <span key={tag.id} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] border border-gray-200">
                                                                {tag.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-500 font-medium">{q.marks} Marks</span>
                                                <span className={`flex items-center gap-1 font-bold ${statusColor}`}>
                                                    {statusIcon} {statusText}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-4 sm:p-6">
                                            <div className="text-base text-gray-900 font-medium mb-4" dangerouslySetInnerHTML={{ __html: getText(q.text, language) }} />

                                            {/* Question Image */}
                                            {q.imageUrl && (
                                                <div className="mb-4">
                                                    <img
                                                        src={q.imageUrl}
                                                        alt="Question image"
                                                        className="max-w-full h-auto rounded-lg border border-gray-200"
                                                    />
                                                </div>
                                            )}

                                            {/* Options */}
                                            <div className="space-y-2">
                                                {q.options && q.options.length > 0 ? (
                                                    q.options.map((opt: any, i) => {
                                                        const isObject = typeof opt === 'object' && opt !== null;
                                                        const optId = isObject ? opt.id : opt;
                                                        const optText = isObject ? getText(opt.text, language) : opt;

                                                        // Student response is usually an array of IDs ["a", "b"] or a single ID "a"
                                                        // Check if response contains this option ID
                                                        let isSelected = false;
                                                        if (Array.isArray(q.studentResponse)) {
                                                            isSelected = q.studentResponse.includes(optId);
                                                        } else if (typeof q.studentResponse === 'string') {
                                                            isSelected = q.studentResponse === optId;
                                                        }

                                                        // Correct answer is stored as ["a"] or "a"
                                                        let isAnswer = false;
                                                        if (Array.isArray(q.correctAnswer)) {
                                                            isAnswer = q.correctAnswer.includes(optId);
                                                        } else if (typeof q.correctAnswer === 'string') {
                                                            isAnswer = q.correctAnswer === optId;
                                                        }

                                                        let optionClass = "p-3 rounded-lg border flex items-center gap-3 text-sm ";
                                                        if (isAnswer) optionClass += "bg-green-50 border-green-200 text-green-800 ring-1 ring-green-200";
                                                        else if (isSelected && !isCorrect) optionClass += "bg-red-50 border-red-200 text-red-800";
                                                        else optionClass += "bg-white border-gray-100 text-gray-600";

                                                        return (
                                                            <div key={i} className={optionClass}>
                                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${isAnswer ? 'border-green-600 bg-green-600 text-white' : isSelected ? 'border-red-500 bg-red-500 text-white' : 'border-gray-300'}`}>
                                                                    {(isAnswer || isSelected) && (
                                                                        isAnswer ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />
                                                                    )}
                                                                </div>
                                                                <span className="flex-1">
                                                                    {isObject && <span className="font-semibold mr-2">{optId.toUpperCase()}.</span>}
                                                                    {optText}
                                                                    {isObject && (opt.image_url || opt.imageUrl) && (
                                                                        <img src={opt.image_url || opt.imageUrl} alt="" className="mt-1 max-w-[150px] max-h-[80px] object-contain rounded border" />
                                                                    )}
                                                                </span>
                                                                {isAnswer && <span className="ml-auto text-[10px] font-bold text-green-600 uppercase tracking-wider">Correct</span>}
                                                                {isSelected && !isAnswer && <span className="ml-auto text-[10px] font-bold text-red-600 uppercase tracking-wider">You</span>}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                            <span className="block text-xs text-gray-500 mb-1">Your Answer:</span>
                                                            <p className={`font-medium ${!userSkipped ? 'text-gray-900' : 'text-gray-400 italic'}`}>{q.studentResponse || 'No Answer'}</p>
                                                        </div>
                                                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                                            <span className="block text-xs text-green-600 mb-1">Correct Answer:</span>
                                                            <p className="font-medium text-green-900">{q.correctAnswer}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Explanation */}
                                            {q.explanation && (
                                                <div className="mt-4 pt-4 border-t border-gray-100">
                                                    <div className="flex items-start gap-2 text-blue-800 bg-blue-50 p-3 rounded-lg text-sm">
                                                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <span className="font-bold block mb-1 text-xs uppercase tracking-wide">Explanation</span>
                                                            <div dangerouslySetInnerHTML={{ __html: getText(q.explanation, language) }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>

                {/* Right Sidebar - Stats (Desktop only) */}
                <aside className="hidden lg:block w-80 bg-white border-l p-6 overflow-y-auto">
                    <h3 className="font-bold text-gray-900 mb-4">Performance Summary</h3>

                    <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl mb-6">
                        <div className="relative w-32 h-32 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200" />
                                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={351} strokeDashoffset={351 - (351 * percentage) / 100} className={`text-blue-600 transition-all duration-1000 ease-out`} />
                            </svg>
                            <span className="absolute text-3xl font-bold text-gray-900">{percentage}%</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">Overall Score</p>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600"><CheckCircle className="w-4 h-4" /></div>
                                <span className="text-sm font-medium text-gray-700">Correct</span>
                            </div>
                            <span className="font-bold text-green-700">{correctCount}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600"><XCircle className="w-4 h-4" /></div>
                                <span className="text-sm font-medium text-gray-700">Wrong</span>
                            </div>
                            <span className="font-bold text-red-700">{wrongCount}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"><MinusCircle className="w-4 h-4" /></div>
                                <span className="text-sm font-medium text-gray-700">Skipped</span>
                            </div>
                            <span className="font-bold text-gray-600">{unattemptedCount}</span>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
