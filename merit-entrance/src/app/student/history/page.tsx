'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { formatDateTimeIST, getText } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Clock, Calendar, FileText, BarChart2, CheckCircle, XCircle, AlertCircle, Gauge } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDifficultyBadge } from '@/lib/performance';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

interface ExamAttempt {
    id: string;
    examId: string;
    title: Record<string, string>;
    startedAt: string;
    submittedAt: string | null;
    status: 'in_progress' | 'submitted';
    score: number | null;
    totalMarks: number;
    attemptNumber: number;
    examDifficulty: number;
    attemptedQuestions: number;
    totalQuestions: number;
    percentage: number | null;
}

export default function ExamHistoryPage() {
    const router = useRouter();
    const { user, language, isAuthenticated, _hasHydrated } = useAuthStore();
    const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || user?.role !== 'student') {
            router.push('/');
            return;
        }
        loadHistory();
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadHistory = async (page = 1) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/student/history?page=${page}&limit=20`);
            const data = await response.json();
            if (data.success) {
                setAttempts(data.attempts);
                if (data.pagination) {
                    setPagination(data.pagination);
                }
            }
        } catch (error) {
            toast.error('Failed to load history');
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            loadHistory(newPage);
        }
    };

    const getStatusBadge = (status: string, score: number | null, totalMarks: number) => {
        if (status === 'in_progress') {
            return (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    In Progress
                </span>
            );
        }

        // Calculate percentage for color coding
        const percentage = score !== null ? (score / totalMarks) * 100 : 0;
        let colorClass = 'bg-gray-100 text-gray-700'; // Default

        if (percentage >= 80) colorClass = 'bg-green-100 text-green-700 border border-green-200';
        else if (percentage >= 50) colorClass = 'bg-blue-100 text-blue-700 border border-blue-200';
        else colorClass = 'bg-red-50 text-red-700 border border-red-200';

        return (
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
                <CheckCircle className="w-4 h-4" />
                Completed
            </span>
        );
    };

    // Prepare data for the chart - reverse to show chronological order left-to-right
    const chartData = [...attempts]
        .filter(a => a.status === 'submitted' && a.score !== null)
        .reverse()
        .map((a, index) => ({
            name: `${getText(a.title, language).substring(0, 15)}... (${index + 1})`,
            fullName: getText(a.title, language),
            score: a.score,
            total: a.totalMarks,
            percentage: a.score ? Math.round((a.score / a.totalMarks) * 100) : 0,
            date: new Date(a.submittedAt!).toLocaleDateString(),
            uniqueKey: `${a.id}-${index}`
        }));

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Clock className="w-6 h-6 text-blue-600" />
                            Exam History
                        </h1>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Performance Chart Section */}
                {chartData.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
                        <div className="flex items-center gap-2 mb-6">
                            <BarChart2 className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-bold text-gray-900">Performance Overview</h2>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="uniqueKey"
                                        tickFormatter={(value, index) => {
                                            // Custom formatter to show name from payload matching uniqueKey
                                            // Since we can't easily access payload here without index matching
                                            // We will rely on index matching chartData
                                            return chartData[index]?.name || '';
                                        }}
                                        tick={{ fontSize: 12, fill: '#6B7280' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: '#6B7280' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        labelFormatter={(value, payload) => {
                                            if (payload && payload.length > 0) {
                                                const data = payload[0].payload;
                                                return `${data.fullName} - ${data.date}`;
                                            }
                                            return '';
                                        }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#F3F4F6' }}
                                    />
                                    <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.percentage >= 80 ? '#22C55E' : entry.percentage >= 50 ? '#3B82F6' : '#EF4444'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Detailed Attempts List */}
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-500" />
                    Past Attempts
                </h2>

                {attempts.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center border border-dashed border-gray-300">
                        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">No Attempts Yet</h3>
                        <p className="text-gray-500 mt-1">You haven&apos;t taken any exams yet.</p>
                        <button
                            onClick={() => router.push('/student/dashboard')}
                            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {attempts.map((attempt) => (
                            <div
                                key={attempt.id}
                                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 transition hover:shadow-md"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between sm:justify-start gap-3">
                                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                                                {attempt.attemptNumber}
                                            </span>
                                            <h3 className="text-lg font-bold text-gray-900 hover:text-blue-600 transition">
                                                {getText(attempt.title, language)}
                                            </h3>
                                            {attempt.examDifficulty && (() => {
                                                const diffBadge = getDifficultyBadge(attempt.examDifficulty);
                                                return (
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${diffBadge.color}`}>
                                                        {diffBadge.label}
                                                    </span>
                                                );
                                            })()}
                                        </div>

                                        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-sm text-gray-500">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                {formatDateTimeIST(attempt.startedAt)}
                                            </div>
                                            {attempt.status === 'submitted' && (
                                                <div className="flex items-center gap-1.5">
                                                    <CheckCircle className="w-4 h-4 text-gray-400" />
                                                    {attempt.attemptedQuestions} / {attempt.totalQuestions} Questions
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
                                        <div className="text-right">
                                            {getStatusBadge(attempt.status, attempt.score, attempt.totalMarks)}
                                            {attempt.status === 'submitted' && attempt.score !== null && (
                                                <div className="mt-1 flex flex-col items-end">
                                                    <div className="text-xs text-gray-500 font-medium">
                                                        Score: <span className="text-gray-900 font-bold text-base">{attempt.score}</span> / {attempt.totalMarks}
                                                    </div>

                                                    {/* Performance Trend */}
                                                    {(() => {
                                                        const currentIndex = attempts.findIndex(a => a.id === attempt.id);
                                                        // Find next chronologically previous attempt (which is at a higher index due to default sorting, OR we need to verify sorting)
                                                        // attempts are validly sorted DESC by startedAt. 
                                                        // So attempts[currentIndex + 1] is the PREVIOUS attempt.
                                                        const prevAttempt = attempts[currentIndex + 1];

                                                        if (prevAttempt && prevAttempt.status === 'submitted' && prevAttempt.score !== null && attempt.score !== null) {
                                                            const prevPercentage = (prevAttempt.score / prevAttempt.totalMarks) * 100;
                                                            const currentPercentage = (attempt.score / attempt.totalMarks) * 100;
                                                            const diff = currentPercentage - prevPercentage;
                                                            const diffAbs = Math.abs(diff).toFixed(1);

                                                            if (diff > 0) {
                                                                return (
                                                                    <span className="text-xs font-bold text-green-600 flex items-center gap-0.5 mt-0.5">
                                                                        ▲ {diffAbs}%
                                                                    </span>
                                                                );
                                                            } else if (diff < 0) {
                                                                return (
                                                                    <span className="text-xs font-bold text-red-600 flex items-center gap-0.5 mt-0.5">
                                                                        ▼ {diffAbs}%
                                                                    </span>
                                                                );
                                                            } else {
                                                                return (
                                                                    <span className="text-xs font-medium text-gray-400 flex items-center gap-0.5 mt-0.5">
                                                                        - 0%
                                                                    </span>
                                                                );
                                                            }
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {attempt.status === 'submitted' && (
                                            <button
                                                onClick={() => router.push(`/student/history/${attempt.id}`)}
                                                className="hidden sm:flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                            >
                                                View Analysis
                                            </button>
                                        )}
                                    </div>


                                    {/* Mobile View Analysis Button */}
                                    {attempt.status === 'submitted' && (
                                        <button
                                            onClick={() => router.push(`/student/history/${attempt.id}`)}
                                            className="sm:hidden w-full text-center py-2.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100 transition"
                                        >
                                            View Detailed Analysis
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="text-sm text-gray-500">
                            Page {pagination.page} of {pagination.totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-3 py-1 bg-blue-600 text-white rounded-lg font-medium">
                                {pagination.page}
                            </span>
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
