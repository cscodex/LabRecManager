'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { getText, formatDateTimeIST } from '@/lib/utils';
import {
    ChevronLeft, BarChart3, Users, Trophy, TrendingUp,
    Clock, CheckCircle, XCircle, ChevronDown, ChevronUp,
    Download, Search, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ExamResult {
    id: string;
    title: Record<string, string>;
    totalAttempts: number;
    completedAttempts: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    passRate: number;
    totalMarks: number;
}

interface StudentAttempt {
    id: string;
    studentId: string;
    studentName: string;
    rollNumber: string;
    examId: string;
    examTitle: Record<string, string>;
    score: number;
    totalMarks: number;
    percentage: number;
    passed: boolean | null;
    submittedAt: string;
    timeTaken: number; // in minutes
}

export default function AdminResultsPage() {
    const router = useRouter();
    const { user, language, isAuthenticated, _hasHydrated } = useAuthStore();

    const [examResults, setExamResults] = useState<ExamResult[]>([]);
    const [recentAttempts, setRecentAttempts] = useState<StudentAttempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedExam, setSelectedExam] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'date' | 'score' | 'name'>('date');
    const [expandedExam, setExpandedExam] = useState<string | null>(null);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadResults();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadResults = async () => {
        try {
            const response = await fetch('/api/admin/results');
            const data = await response.json();
            if (data.success) {
                setExamResults(data.examResults);
                setRecentAttempts(data.recentAttempts);
            }
        } catch (error) {
            toast.error('Failed to load results');
        } finally {
            setLoading(false);
        }
    };

    const filteredAttempts = recentAttempts
        .filter(a => selectedExam === 'all' || a.examId === selectedExam)
        .filter(a =>
            searchQuery === '' ||
            a.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'date') return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
            if (sortBy === 'score') return b.percentage - a.percentage;
            if (sortBy === 'name') return a.studentName.localeCompare(b.studentName);
            return 0;
        });

    const overallStats = {
        totalAttempts: recentAttempts.length,
        averageScore: recentAttempts.length > 0
            ? Math.round(recentAttempts.reduce((sum, a) => sum + a.percentage, 0) / recentAttempts.length)
            : 0,
        passCount: recentAttempts.filter(a => a.passed === true).length,
        passRate: recentAttempts.length > 0
            ? Math.round((recentAttempts.filter(a => a.passed === true).length / recentAttempts.length) * 100)
            : 0
    };

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Results & Analytics</h1>
                            <p className="text-sm text-gray-500">View exam results and performance analytics</p>
                        </div>
                    </div>
                    <button
                        onClick={() => toast.success('Export feature coming soon!')}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                {/* Overall Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <Users className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{overallStats.totalAttempts}</p>
                                <p className="text-sm text-gray-500">Total Attempts</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <TrendingUp className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{overallStats.averageScore}%</p>
                                <p className="text-sm text-gray-500">Average Score</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-100 rounded-lg">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{overallStats.passCount}</p>
                                <p className="text-sm text-gray-500">Students Passed</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-orange-100 rounded-lg">
                                <Trophy className="w-6 h-6 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{overallStats.passRate}%</p>
                                <p className="text-sm text-gray-500">Pass Rate</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exam-wise Results */}
                <div className="bg-white rounded-xl shadow-sm">
                    <div className="p-4 border-b">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                            Exam Performance
                        </h2>
                    </div>

                    {examResults.length === 0 ? (
                        <div className="p-12 text-center">
                            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">No exam results yet</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {examResults.map((exam) => (
                                <div key={exam.id}>
                                    <button
                                        onClick={() => setExpandedExam(expandedExam === exam.id ? null : exam.id)}
                                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
                                    >
                                        <div className="flex-1 text-left">
                                            <h3 className="font-medium text-gray-900">
                                                {getText(exam.title, language)}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {exam.completedAttempts} completed out of {exam.totalAttempts} attempts
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="font-semibold text-blue-600">{Math.round(exam.averageScore)}%</p>
                                                <p className="text-xs text-gray-500">Avg Score</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-green-600">{exam.passRate}%</p>
                                                <p className="text-xs text-gray-500">Pass Rate</p>
                                            </div>
                                            {expandedExam === exam.id ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    </button>

                                    {expandedExam === exam.id && (
                                        <div className="px-4 pb-4 bg-gray-50">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="bg-white rounded-lg p-3">
                                                    <p className="text-sm text-gray-500">Total Marks</p>
                                                    <p className="text-lg font-semibold">{exam.totalMarks}</p>
                                                </div>
                                                <div className="bg-white rounded-lg p-3">
                                                    <p className="text-sm text-gray-500">Highest Score</p>
                                                    <p className="text-lg font-semibold text-green-600">{exam.highestScore}</p>
                                                </div>
                                                <div className="bg-white rounded-lg p-3">
                                                    <p className="text-sm text-gray-500">Lowest Score</p>
                                                    <p className="text-lg font-semibold text-red-600">{exam.lowestScore}</p>
                                                </div>
                                                <div className="bg-white rounded-lg p-3">
                                                    <p className="text-sm text-gray-500">Average Score</p>
                                                    <p className="text-lg font-semibold text-blue-600">{Math.round(exam.averageScore)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Attempts */}
                <div className="bg-white rounded-xl shadow-sm">
                    <div className="p-4 border-b">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <h2 className="text-lg font-semibold text-gray-900">Recent Attempts</h2>

                            <div className="flex items-center gap-3">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search student..."
                                        className="pl-9 pr-4 py-2 border rounded-lg text-sm w-48"
                                    />
                                </div>

                                {/* Exam Filter */}
                                <select
                                    value={selectedExam}
                                    onChange={(e) => setSelectedExam(e.target.value)}
                                    className="px-3 py-2 border rounded-lg text-sm"
                                >
                                    <option value="all">All Exams</option>
                                    {examResults.map(exam => (
                                        <option key={exam.id} value={exam.id}>
                                            {getText(exam.title, language)}
                                        </option>
                                    ))}
                                </select>

                                {/* Sort */}
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as 'date' | 'score' | 'name')}
                                    className="px-3 py-2 border rounded-lg text-sm"
                                >
                                    <option value="date">Sort by Date</option>
                                    <option value="score">Sort by Score</option>
                                    <option value="name">Sort by Name</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {filteredAttempts.length === 0 ? (
                        <div className="p-12 text-center">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">No attempts found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredAttempts.map((attempt) => (
                                        <tr key={attempt.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-gray-900">{attempt.studentName}</p>
                                                <p className="text-sm text-gray-500">{attempt.rollNumber}</p>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {getText(attempt.examTitle, language)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`font-semibold ${attempt.percentage >= 60 ? 'text-green-600' :
                                                        attempt.percentage >= 40 ? 'text-yellow-600' : 'text-red-600'
                                                    }`}>
                                                    {attempt.score}/{attempt.totalMarks} ({attempt.percentage}%)
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {attempt.passed === true ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Passed
                                                    </span>
                                                ) : attempt.passed === false ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                                        <XCircle className="w-3 h-3" />
                                                        Failed
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                                        N/A
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {attempt.timeTaken} min
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {formatDateTimeIST(attempt.submittedAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
