'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { ChevronLeft, User, BookOpen, Clock, Award, Target, Brain, CheckCircle2, XCircle, MinusCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getDifficultyBadge, getPerformanceColor } from '@/lib/performance';

// Helper for multilingual text
const getText = (text: any, lang: 'en' | 'pa') => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[lang] || text['en'] || '';
};

interface Question {
    id: string;
    text: Record<string, string>;
    type: string;
    options: Record<string, string>[];
    correctOption: number;
    marks: number;
    negativeMarks: number;
    difficulty: number;
    order: number;
    selectedOption: number | null;
    isCorrect: boolean | null;
    marksAwarded: number;
    isAttempted: boolean;
    performanceFactor: number;
}

interface Section {
    id: string;
    name: Record<string, string>;
    order: number;
    totalMarks: number;
    marksObtained: number;
    avgDifficulty: number;
    questionsCount: number;
    attemptedCount: number;
    correctCount: number;
    sectionPerformanceFactor: number;
    questions: Question[];
}

interface AttemptDetails {
    id: string;
    examId: string;
    examTitle: Record<string, string>;
    attemptNumber: number;
    startedAt: string;
    submittedAt: string | null;
    status: string;
    totalScore: number;
    totalMarks: number;
    percentage: number;
    passed: boolean | null;
    overallPerformanceFactor: number;
    student: {
        id: string;
        name: string;
        email: string;
        rollNumber: string;
        class: string;
    };
}

export default function AttemptDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const attemptId = params.attemptId as string;
    const { user, isAuthenticated, language, _hasHydrated } = useAuthStore();

    const [loading, setLoading] = useState(true);
    const [attempt, setAttempt] = useState<AttemptDetails | null>(null);
    const [sections, setSections] = useState<Section[]>([]);
    const [activeSection, setActiveSection] = useState<string | null>(null);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadAttemptDetails();
    }, [_hasHydrated, isAuthenticated, user, router, attemptId]);

    const loadAttemptDetails = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/reports/attempts/${attemptId}`);
            const data = await response.json();
            if (data.success) {
                setAttempt(data.attempt);
                setSections(data.sections);
                if (data.sections.length > 0) {
                    setActiveSection(data.sections[0].id);
                }
            } else {
                toast.error('Failed to load attempt details');
            }
        } catch (error) {
            toast.error('Failed to load attempt details');
        } finally {
            setLoading(false);
        }
    };

    const currentSection = sections.find(s => s.id === activeSection);

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!attempt) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900">Attempt Not Found</h2>
                    <Link href="/admin/reports/attempts" className="text-blue-600 hover:underline mt-2 inline-block">
                        ← Back to Attempts
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <Link href="/admin/reports/attempts" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-2">
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back to Attempts
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <BookOpen className="w-6 h-6 text-blue-600" />
                                {getText(attempt.examTitle, language)}
                            </h1>
                            <p className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                    <User className="w-4 h-4" />
                                    {attempt.student.name} ({attempt.student.rollNumber})
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {new Date(attempt.startedAt).toLocaleString()}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    Attempt #{attempt.attemptNumber}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                            <Award className="w-4 h-4" /> Score
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{attempt.totalScore}/{attempt.totalMarks}</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                            <Target className="w-4 h-4" /> Percentage
                        </p>
                        <p className={`text-2xl font-bold mt-1 ${attempt.percentage >= 70 ? 'text-green-600' : attempt.percentage >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {attempt.percentage}%
                        </p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" /> Performance Factor
                        </p>
                        <p className={`text-2xl font-bold mt-1 ${getPerformanceColor(attempt.overallPerformanceFactor)}`}>
                            {attempt.overallPerformanceFactor.toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Status
                        </p>
                        <p className={`text-2xl font-bold mt-1 ${attempt.passed ? 'text-green-600' : 'text-red-500'}`}>
                            {attempt.passed ? 'Passed' : 'Failed'}
                        </p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                            <Brain className="w-4 h-4" /> Sections
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{sections.length}</p>
                    </div>
                </div>

                {/* Section Performance Summary */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h3 className="font-bold text-gray-900">Section Performance Summary</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Section</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Questions</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Attempted</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Correct</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Score</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Difficulty</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Performance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {sections.map(section => {
                                    const diffBadge = getDifficultyBadge(section.avgDifficulty);
                                    return (
                                        <tr key={section.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium text-gray-900">{getText(section.name, language)}</td>
                                            <td className="px-4 py-3 text-center">{section.questionsCount}</td>
                                            <td className="px-4 py-3 text-center">{section.attemptedCount}</td>
                                            <td className="px-4 py-3 text-center text-green-600 font-medium">{section.correctCount}</td>
                                            <td className="px-4 py-3 text-center font-medium">{section.marksObtained}/{section.totalMarks}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${diffBadge.color}`}>
                                                    {diffBadge.label}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3 text-center font-bold ${getPerformanceColor(section.sectionPerformanceFactor)}`}>
                                                {section.sectionPerformanceFactor.toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Section Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex border-b overflow-x-auto">
                        {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition ${activeSection === section.id
                                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {getText(section.name, language)}
                            </button>
                        ))}
                    </div>

                    {/* Questions List */}
                    {currentSection && (
                        <div className="p-4 space-y-4">
                            <div className="flex items-center justify-between text-sm text-gray-500 pb-2">
                                <span>Showing {currentSection.questionsCount} questions</span>
                                <span>{currentSection.correctCount}/{currentSection.questionsCount} correct</span>
                            </div>
                            {currentSection.questions.map((q, idx) => {
                                const diffBadge = getDifficultyBadge(q.difficulty);
                                return (
                                    <div
                                        key={q.id}
                                        className={`p-4 rounded-lg border ${q.isCorrect === true ? 'bg-green-50 border-green-200' :
                                            q.isCorrect === false ? 'bg-red-50 border-red-200' :
                                                'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                            <div className="flex items-start gap-3">
                                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white border flex items-center justify-center font-bold text-gray-700">
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <p className="text-gray-900 font-medium" dangerouslySetInnerHTML={{ __html: getText(q.text, language) }} />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${diffBadge.color}`}>
                                                    {diffBadge.label}
                                                </span>
                                                <span className="text-sm text-gray-500">{q.marks} marks</span>
                                            </div>
                                        </div>

                                        {/* Options */}
                                        <div className="ml-11 space-y-2 mb-3">
                                            {q.options.map((opt, optIdx) => {
                                                const isSelected = q.selectedOption === optIdx;
                                                const isCorrectOption = q.correctOption === optIdx;
                                                let optionStyle = 'bg-white border-gray-200';
                                                if (isCorrectOption) {
                                                    optionStyle = 'bg-green-100 border-green-300';
                                                } else if (isSelected && !q.isCorrect) {
                                                    optionStyle = 'bg-red-100 border-red-300';
                                                }
                                                return (
                                                    <div
                                                        key={optIdx}
                                                        className={`flex items-center gap-2 p-2 rounded border ${optionStyle}`}
                                                    >
                                                        <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium">
                                                            {String.fromCharCode(65 + optIdx)}
                                                        </span>
                                                        <span className="flex-1 text-sm" dangerouslySetInnerHTML={{ __html: getText(opt, language) }} />
                                                        {isSelected && (
                                                            <span className={`flex-shrink-0 ${q.isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                                                                {q.isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                                            </span>
                                                        )}
                                                        {isCorrectOption && !isSelected && (
                                                            <span className="flex-shrink-0 text-green-600">
                                                                <CheckCircle2 className="w-5 h-5" />
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Question Metrics */}
                                        <div className="ml-11 flex items-center gap-6 text-sm">
                                            <span className={`font-medium ${q.marksAwarded > 0 ? 'text-green-600' : q.marksAwarded < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                                {q.marksAwarded > 0 ? '+' : ''}{q.marksAwarded} marks
                                            </span>
                                            <span className="text-gray-400">|</span>
                                            <span className={`font-medium ${getPerformanceColor(q.performanceFactor)}`}>
                                                Performance: {q.performanceFactor.toFixed(2)}
                                            </span>
                                            {!q.isAttempted && (
                                                <>
                                                    <span className="text-gray-400">|</span>
                                                    <span className="text-gray-400 flex items-center gap-1">
                                                        <MinusCircle className="w-4 h-4" /> Not Attempted
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
