'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import {
    ChevronLeft, FileText, BarChart3, TrendingUp, AlertCircle,
    CheckCircle, XCircle, Search, HelpCircle, ArrowUp, ArrowDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Exam {
    id: string;
    title: Record<string, string>;
}

interface ExamReport {
    exam: {
        id: string;
        title: Record<string, string>;
        total_marks: number;
        passing_marks: number;
    };
    stats: {
        totalAttempts: number;
        minScore: number;
        maxScore: number;
        avgScore: number;
        medianScore: number;
        stdDev: number;
    };
    distribution: {
        range: string;
        count: number;
    }[];
    questions: {
        id: string;
        text: string;
        type: string;
        correctRate: number;
    }[];
    sections?: {
        id: string;
        name: any;
        avgScore: number;
        attempts: number;
    }[];
}

export default function ExamAnalyticsPage() {
    const router = useRouter();
    const { user, language, isAuthenticated, _hasHydrated } = useAuthStore();

    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [report, setReport] = useState<ExamReport | null>(null);
    const [loadingExams, setLoadingExams] = useState(true);
    const [loadingReport, setLoadingReport] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadExams();
    }, [_hasHydrated, isAuthenticated, user, router]);

    useEffect(() => {
        if (selectedExamId) {
            loadReport(selectedExamId);
        }
    }, [selectedExamId]);

    const loadExams = async () => {
        try {
            const response = await fetch('/api/admin/exams');
            const data = await response.json();
            if (data.success) {
                setExams(data.exams);
                if (data.exams.length > 0) {
                    // Automatically select first exam if not selected
                    // setSelectedExamId(data.exams[0].id); 
                    // Let user select manually to avoid loading heavy data initially
                }
            }
        } catch (error) {
            toast.error('Failed to load exams');
        } finally {
            setLoadingExams(false);
        }
    };

    const loadReport = async (examId: string) => {
        setLoadingReport(true);
        try {
            const response = await fetch(`/api/admin/reports/exam/${examId}`);
            const data = await response.json();
            if (data.success) {
                setReport(data.report);
            } else {
                toast.error(data.error || 'Failed to load report');
            }
        } catch (error) {
            toast.error('Error loading exam report');
        } finally {
            setLoadingReport(false);
        }
    };

    if (!_hasHydrated) return null;

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-center relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <Link href="/admin/reports" className="text-gray-500 hover:text-gray-700">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                    </div>
                    <div className="w-full max-w-md">
                        <select
                            value={selectedExamId}
                            onChange={(e) => setSelectedExamId(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 font-medium text-gray-900"
                        >
                            <option value="" disabled>Select an exam to analyze...</option>
                            {exams.map(exam => (
                                <option key={exam.id} value={exam.id}>
                                    {getText(exam.title, language)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
                {!selectedExamId ? (
                    <div className="text-center py-20">
                        <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-xl font-medium text-gray-900">Select an Exam</h2>
                        <p className="text-gray-500 mt-2">Choose an exam from the dropdown above to view detailed analytics.</p>
                    </div>
                ) : loadingReport ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : report ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* No Data State - when no submitted attempts */}
                        {!report.stats && (
                            <div className="bg-white rounded-xl p-12 text-center border border-dashed border-gray-300">
                                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <h3 className="text-lg font-medium text-gray-900">No Submissions Yet</h3>
                                <p className="text-gray-500 mt-1">This exam has no submitted attempts to analyze.</p>
                            </div>
                        )}

                        {/* Stats Overview - only show when stats exist */}
                        {report.stats && (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                    <p className="text-sm text-gray-500 font-medium">Avg Score</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">{report.stats.avgScore}</p>
                                    <p className="text-xs text-gray-400 mt-1">out of {report.exam.total_marks}</p>
                                </div>
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                    <p className="text-sm text-gray-500 font-medium">Std Deviation</p>
                                    <p className="text-2xl font-bold text-gray-900 mt-1">{report.stats.stdDev}</p>
                                    <p className="text-xs text-gray-400 mt-1">Consistency Metric</p>
                                </div>
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                    <p className="text-sm text-gray-500 font-medium">Highest / Lowest</p>
                                    <p className="text-2xl font-bold text-green-600 mt-1">
                                        {report.stats.maxScore} <span className="text-gray-300 text-lg">/</span> <span className="text-red-500">{report.stats.minScore}</span>
                                    </p>
                                </div>
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                                    <p className="text-sm text-gray-500 font-medium">Total Attempts</p>
                                    <p className="text-2xl font-bold text-blue-600 mt-1">{report.stats.totalAttempts}</p>
                                    <p className="text-xs text-gray-400 mt-1">Submitted exams</p>
                                </div>
                            </div>
                        )}

                        {/* Top: Score Distribution */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-6">Score Distribution</h3>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={report.distribution}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                            <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                                            <YAxis allowDecimals={false} />
                                            <RechartsTooltip
                                                cursor={{ fill: '#f9fafb' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                                {report.distribution.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={
                                                        index < 4 ? '#ef4444' : index < 7 ? '#eab308' : '#22c55e'
                                                    } />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Difficulty Analysis */}
                            <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-[28rem] flex flex-col">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Question Difficulty</h3>
                                <p className="text-sm text-gray-500 mb-4">Questions sorted by lowest correct response rate.</p>

                                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                                    {report.questions.length > 0 ? (
                                        report.questions.map((q, idx) => (
                                            <div key={q.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                                                        <span className="text-gray-400 mr-2">Q{idx + 1}.</span>
                                                        {q.text.replace(/<[^>]*>/g, '')}
                                                    </p>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${q.correctRate < 40 ? 'bg-red-100 text-red-700' :
                                                        q.correctRate > 80 ? 'bg-green-100 text-green-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {q.correctRate}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-400 text-center py-10">No question data available.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section Analysis Chart */}
                        {report.sections && report.sections.length > 0 && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-6">Subject / Section Performance (Avg Score)</h3>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={report.sections} layout="vertical" margin={{ left: 40, right: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                            <XAxis type="number" hide />
                                            <YAxis
                                                dataKey="name"
                                                type="category"
                                                width={150}
                                                tickFormatter={(val) => getText(val, language)}
                                                tick={{ fontSize: 13, fontWeight: 500 }}
                                            />
                                            <RechartsTooltip
                                                cursor={{ fill: '#f9fafb' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-white p-3 border shadow-sm rounded-lg">
                                                                <p className="font-bold mb-1">{getText(data.name, language)}</p>
                                                                <p className="text-sm text-gray-600">Avg Score: <span className="font-bold text-blue-600">{data.avgScore}</span></p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="avgScore" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={30}>
                                                {report.sections.map((_: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill="#8b5cf6" />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                    </div>
                ) : null}
            </main>
        </div>
    );
}
