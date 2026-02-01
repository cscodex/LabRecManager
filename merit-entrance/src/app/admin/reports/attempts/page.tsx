'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { ChevronLeft, ChevronRight, Filter, Search, FileText, Clock, User, BookOpen, BarChart2, Eye } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getDifficultyBadge } from '@/lib/performance';

// Helper for multilingual text
const getText = (text: any, lang: 'en' | 'pa') => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[lang] || text['en'] || '';
};

interface Attempt {
    id: string;
    examId: string;
    studentId: string;
    studentName: string;
    rollNumber: string;
    class: string;
    examTitle: Record<string, string>;
    attemptNumber: number;
    startedAt: string;
    submittedAt: string | null;
    status: string;
    score: number | null;
    totalMarks: number;
    percentage: number | null;
    passed: boolean | null;
    examDifficulty: number;
}

export default function AttemptsHistoryPage() {
    const router = useRouter();
    const { user, isAuthenticated, language, _hasHydrated } = useAuthStore();
    const [attempts, setAttempts] = useState<Attempt[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [filters, setFilters] = useState({ status: 'all', examId: '', attemptNumber: 'all', search: '' });
    const [exams, setExams] = useState<any[]>([]);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadExams();
    }, [_hasHydrated, isAuthenticated, user, router]);

    useEffect(() => {
        if (_hasHydrated && isAuthenticated) {
            loadAttempts();
        }
    }, [pagination.page, filters.status, filters.examId, filters.attemptNumber]);

    const loadExams = async () => {
        try {
            const response = await fetch('/api/admin/exams');
            const data = await response.json();
            if (data.success) {
                setExams(data.exams);
            }
        } catch (error) {
            console.error('Failed to load exams');
        }
    };

    const loadAttempts = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
            });
            if (filters.status !== 'all') params.append('status', filters.status);
            if (filters.examId) params.append('examId', filters.examId);
            if (filters.attemptNumber !== 'all') params.append('attemptNumber', filters.attemptNumber);

            const response = await fetch(`/api/admin/reports/attempts?${params}`);
            const data = await response.json();
            if (data.success) {
                setAttempts(data.attempts);
                setPagination(prev => ({ ...prev, ...data.pagination }));
            }
        } catch (error) {
            toast.error('Failed to load attempts');
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            setPagination(prev => ({ ...prev, page: newPage }));
        }
    };

    if (!_hasHydrated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <Link href="/admin/reports" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-2">
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back to Reports
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <FileText className="w-6 h-6 text-blue-600" />
                                All Exam Attempts
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Complete history of all student exam attempts
                            </p>
                        </div>
                        <div className="text-sm text-gray-500">
                            Total: <span className="font-bold text-gray-900">{pagination.total}</span> attempts
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
                {/* Filters */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Filters:</span>
                    </div>
                    <select
                        value={filters.status}
                        onChange={(e) => {
                            setFilters(prev => ({ ...prev, status: e.target.value }));
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="all">All Status</option>
                        <option value="submitted">Submitted</option>
                        <option value="in_progress">In Progress</option>
                    </select>
                    <select
                        value={filters.examId}
                        onChange={(e) => {
                            setFilters(prev => ({ ...prev, examId: e.target.value }));
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="">All Exams</option>
                        {exams.map(exam => (
                            <option key={exam.id} value={exam.id}>
                                {getText(exam.title, language)}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.attemptNumber}
                        onChange={(e) => {
                            setFilters(prev => ({ ...prev, attemptNumber: e.target.value }));
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="all">All Attempts</option>
                        <option value="1">1st Attempt</option>
                        <option value="2">2nd Attempt</option>
                        <option value="3+">3rd+ Attempt</option>
                    </select>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : attempts.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            No attempts found matching the criteria.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Student</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Exam</th>
                                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Attempt #</th>
                                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Score</th>
                                        <th className="px-4 py-3 text-center font-semibold text-gray-700">%</th>
                                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Difficulty</th>
                                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {attempts.map((attempt) => {
                                        const diffBadge = getDifficultyBadge(attempt.examDifficulty);
                                        return (
                                            <tr key={attempt.id} className="hover:bg-gray-50/50 transition">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-gray-400" />
                                                        <div>
                                                            <div className="font-medium text-gray-900">{attempt.studentName}</div>
                                                            <div className="text-xs text-gray-500">{attempt.rollNumber} • {attempt.class || 'N/A'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <BookOpen className="w-4 h-4 text-gray-400" />
                                                        <span className="font-medium text-gray-800 max-w-[200px] truncate">
                                                            {getText(attempt.examTitle, language)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                                                        {attempt.attemptNumber}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center font-medium">
                                                    {attempt.score !== null ? (
                                                        <span className="text-gray-900">{attempt.score}/{attempt.totalMarks}</span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {attempt.percentage !== null ? (
                                                        <span className={`font-bold ${attempt.percentage >= 70 ? 'text-green-600' :
                                                            attempt.percentage >= 40 ? 'text-yellow-600' : 'text-red-600'
                                                            }`}>
                                                            {attempt.percentage}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${diffBadge.color}`}>
                                                        {diffBadge.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${attempt.status === 'submitted'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {attempt.status === 'submitted' ? 'Submitted' : 'In Progress'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {new Date(attempt.startedAt).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Link
                                                        href={`/admin/reports/attempts/${attempt.id}`}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        View
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                            <div className="text-sm text-gray-500">
                                Page {pagination.page} of {pagination.totalPages}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {/* Page Numbers */}
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (pagination.totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (pagination.page <= 3) {
                                            pageNum = i + 1;
                                        } else if (pagination.page >= pagination.totalPages - 2) {
                                            pageNum = pagination.totalPages - 4 + i;
                                        } else {
                                            pageNum = pagination.page - 2 + i;
                                        }
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => handlePageChange(pageNum)}
                                                className={`w-8 h-8 rounded-lg text-sm font-medium transition ${pagination.page === pageNum
                                                    ? 'bg-blue-600 text-white'
                                                    : 'border border-gray-200 hover:bg-white text-gray-700'
                                                    }`}
                                            >
                                                {pageNum}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
