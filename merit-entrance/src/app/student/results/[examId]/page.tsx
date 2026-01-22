'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { getText, formatDateTimeIST } from '@/lib/utils';
import {
    Trophy, CheckCircle, XCircle, MinusCircle,
    Clock, ArrowLeft, ChevronDown, ChevronUp, Globe
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ExamResult {
    exam: {
        id: string;
        title: Record<string, string>;
        totalMarks: number;
        passingMarks: number | null;
    };
    attempt: {
        startedAt: string;
        submittedAt: string;
        totalScore: number;
        passed: boolean | null;
    };
    stats: {
        totalQuestions: number;
        attempted: number;
        correct: number;
        incorrect: number;
        unattempted: number;
    };
    sections: { id: string; name: Record<string, string>; order: number }[];
    questions: {
        id: string;
        sectionId: string;
        text: Record<string, string>;
        options: { id: string; text: Record<string, string> }[] | null;
        correctAnswer: string[];
        explanation: Record<string, string> | null;
        marks: number;
        studentAnswer: string[] | null;
        isCorrect: boolean | null;
        marksAwarded: number;
    }[];
}

export default function ResultsPage() {
    const router = useRouter();
    const params = useParams();
    const examId = params.examId as string;
    const { user, language, setLanguage, isAuthenticated, _hasHydrated } = useAuthStore();

    const [result, setResult] = useState<ExamResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || user?.role !== 'student') {
            router.push('/');
            return;
        }
        loadResults();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadResults = async () => {
        try {
            const response = await fetch(`/api/student/results/${examId}`);
            const data = await response.json();

            if (!data.success) {
                toast.error(data.error || 'Failed to load results');
                router.push('/student/dashboard');
                return;
            }

            setResult(data.result);
        } catch (error) {
            toast.error('Failed to load results');
        } finally {
            setLoading(false);
        }
    };

    const toggleQuestion = (questionId: string) => {
        setExpandedQuestions(prev => {
            const next = new Set(prev);
            if (next.has(questionId)) {
                next.delete(questionId);
            } else {
                next.add(questionId);
            }
            return next;
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!result) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500">Results not available</p>
            </div>
        );
    }

    const { exam, attempt, stats, sections, questions } = result;
    const percentage = Math.round((attempt.totalScore / exam.totalMarks) * 100);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/student/dashboard" className="text-gray-500 hover:text-gray-700">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Exam Results</h1>
                            <p className="text-sm text-gray-500">{getText(exam.title, language)}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setLanguage(language === 'en' ? 'pa' : 'en')}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                    >
                        <Globe className="w-4 h-4" />
                        {language === 'en' ? 'English' : 'ਪੰਜਾਬੀ'}
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Score Card */}
                <div className={`rounded-2xl p-6 text-white ${attempt.passed === true ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                    attempt.passed === false ? 'bg-gradient-to-r from-red-500 to-rose-600' :
                        'bg-gradient-to-r from-blue-500 to-indigo-600'
                    }`}>
                    <div className="flex items-center gap-4 mb-4">
                        <Trophy className="w-12 h-12" />
                        <div>
                            <p className="text-lg opacity-90">Your Score</p>
                            <p className="text-4xl font-bold">
                                {attempt.totalScore} / {exam.totalMarks}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-8 text-sm">
                        <div>
                            <p className="opacity-75">Percentage</p>
                            <p className="text-xl font-semibold">{percentage}%</p>
                        </div>
                        {exam.passingMarks && (
                            <div>
                                <p className="opacity-75">Status</p>
                                <p className="text-xl font-semibold">
                                    {attempt.passed ? '✓ Passed' : '✗ Failed'}
                                </p>
                            </div>
                        )}
                        <div>
                            <p className="opacity-75">Submitted</p>
                            <p className="text-sm">{formatDateTimeIST(attempt.submittedAt)}</p>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                        <p className="text-3xl font-bold text-blue-600">{stats.totalQuestions}</p>
                        <p className="text-sm text-gray-500">Total Questions</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                        <p className="text-3xl font-bold text-green-600">{stats.correct}</p>
                        <p className="text-sm text-gray-500">Correct</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                        <p className="text-3xl font-bold text-red-600">{stats.incorrect}</p>
                        <p className="text-sm text-gray-500">Incorrect</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                        <p className="text-3xl font-bold text-gray-400">{stats.unattempted}</p>
                        <p className="text-sm text-gray-500">Unattempted</p>
                    </div>
                </div>

                {/* Questions Review */}
                <div className="bg-white rounded-xl shadow-sm">
                    <div className="p-4 border-b">
                        <h2 className="font-semibold text-gray-900">Detailed Review</h2>
                    </div>

                    {sections.map(section => {
                        const sectionQuestions = questions.filter(q => q.sectionId === section.id);
                        return (
                            <div key={section.id} className="border-b last:border-b-0">
                                <div className="px-4 py-3 bg-gray-50">
                                    <h3 className="font-medium text-gray-700">{getText(section.name, language)}</h3>
                                </div>

                                {sectionQuestions.map((q, idx) => {
                                    const isExpanded = expandedQuestions.has(q.id);

                                    return (
                                        <div key={q.id} className="border-t">
                                            <button
                                                onClick={() => toggleQuestion(q.id)}
                                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
                                            >
                                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${q.isCorrect === true ? 'bg-green-100 text-green-700' :
                                                    q.isCorrect === false ? 'bg-red-100 text-red-700' :
                                                        'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="flex-1 text-left text-gray-800 line-clamp-1">
                                                    {getText(q.text, language)}
                                                </span>
                                                {q.isCorrect === true && <CheckCircle className="w-5 h-5 text-green-500" />}
                                                {q.isCorrect === false && <XCircle className="w-5 h-5 text-red-500" />}
                                                {q.isCorrect === null && <MinusCircle className="w-5 h-5 text-gray-400" />}
                                                <span className={`text-sm font-medium ${q.marksAwarded > 0 ? 'text-green-600' :
                                                    q.marksAwarded < 0 ? 'text-red-600' :
                                                        'text-gray-400'
                                                    }`}>
                                                    {q.marksAwarded > 0 ? '+' : ''}{q.marksAwarded}
                                                </span>
                                                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                            </button>

                                            {isExpanded && (
                                                <div className="px-4 pb-4 bg-gray-50">
                                                    <p className="text-gray-800 mb-3">{getText(q.text, language)}</p>

                                                    {q.options && (
                                                        <div className="space-y-2 mb-4">
                                                            {q.options.map(opt => {
                                                                const isCorrect = q.correctAnswer.includes(opt.id);
                                                                const wasSelected = q.studentAnswer?.includes(opt.id);

                                                                return (
                                                                    <div
                                                                        key={opt.id}
                                                                        className={`flex items-center gap-3 p-3 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-300' :
                                                                            wasSelected && !isCorrect ? 'bg-red-50 border-red-300' :
                                                                                'bg-white border-gray-200'
                                                                            }`}
                                                                    >
                                                                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium ${isCorrect ? 'bg-green-500 border-green-500 text-white' :
                                                                            wasSelected ? 'bg-red-500 border-red-500 text-white' :
                                                                                'border-gray-300 text-gray-500'
                                                                            }`}>
                                                                            {opt.id.toUpperCase()}
                                                                        </span>
                                                                        <span className="flex-1 text-gray-700">
                                                                            {getText(opt.text, language)}
                                                                        </span>
                                                                        {isCorrect && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                                        {wasSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-500" />}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {q.explanation && (
                                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                            <p className="text-sm font-medium text-blue-800 mb-1">Explanation:</p>
                                                            <p className="text-sm text-blue-700">{getText(q.explanation, language)}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* Back Button */}
                <div className="text-center pt-4">
                    <Link
                        href="/student/dashboard"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                </div>
            </main>
        </div>
    );
}
