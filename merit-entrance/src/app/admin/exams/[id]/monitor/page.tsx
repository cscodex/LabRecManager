'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import { ArrowLeft, RefreshCw, Users, Clock, CheckCircle } from 'lucide-react';

interface ActiveStudent {
    attemptId: string;
    studentName: string;
    rollNumber: string;
    startedAt: string;
    remainingSeconds: number;
    answeredCount: number;
    currentQuestionId: string | null;
    totalQuestions: number;
}

interface MonitorData {
    examTitle: Record<string, string>;
    duration: number;
    totalQuestions: number;
    activeCount: number;
    students: ActiveStudent[];
}

export default function ExamMonitorPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const router = useRouter();
    const { language } = useAuthStore();
    const [data, setData] = useState<MonitorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchData = async () => {
        try {
            const response = await fetch(`/api/admin/exams/${resolvedParams.id}/monitor`);
            if (!response.ok) throw new Error('Failed to fetch');
            const result = await response.json();
            setData(result);
            setError(null);
        } catch (err) {
            setError('Failed to load monitoring data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [resolvedParams.id]);

    // Auto-refresh every 5 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [autoRefresh, resolvedParams.id]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getProgressPercentage = (answered: number, total: number) => {
        return total > 0 ? Math.round((answered / total) * 100) : 0;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error || 'No data available'}</p>
                    <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    Live Monitor: {getText(data.examTitle, language)}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    Duration: {data.duration} min | {data.totalQuestions} questions
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={autoRefresh}
                                    onChange={(e) => setAutoRefresh(e.target.checked)}
                                    className="rounded"
                                />
                                Auto-refresh
                            </label>
                            <button
                                onClick={fetchData}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Refresh
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <Users className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{data.activeCount}</p>
                                <p className="text-sm text-gray-500">Active Students</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Clock className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{data.duration} min</p>
                                <p className="text-sm text-gray-500">Exam Duration</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{data.totalQuestions}</p>
                                <p className="text-sm text-gray-500">Total Questions</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Active Students Table */}
                {data.students.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center shadow-sm border">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Attempts</h3>
                        <p className="text-gray-500">
                            Students will appear here once they start the exam.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Student
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Started At
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Time Remaining
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                            Progress
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.students.map((student) => {
                                        const progress = getProgressPercentage(student.answeredCount, student.totalQuestions);
                                        const isLowTime = student.remainingSeconds < 300; // Less than 5 min

                                        return (
                                            <tr key={student.attemptId} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="font-medium text-gray-900">{student.studentName}</p>
                                                        <p className="text-sm text-gray-500">{student.rollNumber}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {new Date(student.startedAt).toLocaleTimeString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${isLowTime ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        <Clock className="w-3.5 h-3.5 mr-1" />
                                                        {formatTime(student.remainingSeconds)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-32 bg-gray-200 rounded-full h-2">
                                                            <div
                                                                className="bg-blue-600 h-2 rounded-full transition-all"
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm text-gray-600">
                                                            {student.answeredCount}/{student.totalQuestions}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
