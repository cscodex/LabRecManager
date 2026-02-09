'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { ArrowLeft, Award, Clock, BookOpen, TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon, Filter } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ExamStats {
    totalExams: number;
    averagePercentage: number;
    bestPercentage: number;
}

interface PerformanceData {
    name: string | Record<string, string>;
    questionsAttempted: number;
    correctAnswers: number;
    marksEarned: number;
    totalPossibleMarks: number;
    percentage: number;
}

export default function PerformanceAnalysisPage() {
    const router = useRouter();
    const { user, language, isAuthenticated, _hasHydrated } = useAuthStore();
    const [examStats, setExamStats] = useState<ExamStats>({ totalExams: 0, averagePercentage: 0, bestPercentage: 0 });
    const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [groupBy, setGroupBy] = useState<'section' | 'tag'>('section');
    const [range, setRange] = useState<'all' | 'latest'>('all');

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || user?.role !== 'student') {
            router.push('/');
            return;
        }
        loadData();
    }, [_hasHydrated, isAuthenticated, user, router, groupBy, range]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load generic stats (only once ideally, but cheap enough)
            const profileRes = await fetch('/api/student/profile');
            const profileData = await profileRes.json();
            if (profileData.success) {
                setExamStats(profileData.examStats || { totalExams: 0, averagePercentage: 0, bestPercentage: 0 });
            }

            // Load filtered performance data
            const perfRes = await fetch(`/api/student/performance?groupBy=${groupBy}&range=${range}`);
            const perfData = await perfRes.json();
            if (perfData.success) {
                setPerformanceData(perfData.performance || []);
            }
        } catch (error) {
            console.error('Failed to load performance data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getText = (obj: string | Record<string, string>, lang: string): string => {
        if (typeof obj === 'string') return obj;
        return obj?.[lang] || obj?.en || '';
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
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-6 h-6 text-blue-600" />
                            <h1 className="text-lg font-bold text-gray-900">Performance Analysis</h1>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setGroupBy('section')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${groupBy === 'section' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Section
                            </button>
                            <button
                                onClick={() => setGroupBy('tag')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${groupBy === 'tag' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Tag
                            </button>
                        </div>
                        <div className="h-6 w-px bg-gray-300 mx-1"></div>
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setRange('all')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${range === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                All Tests
                            </button>
                            <button
                                onClick={() => setRange('latest')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${range === 'latest' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Latest
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 space-y-6">
                {/* Exam Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl shadow-sm p-6 text-center border-l-4 border-green-500">
                        <Award className="w-8 h-8 text-green-600 mx-auto mb-3" />
                        <p className="text-3xl font-bold text-gray-900">{examStats.totalExams}</p>
                        <p className="text-sm text-gray-500 mt-1">Exams Completed</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 text-center border-l-4 border-blue-500">
                        <Clock className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                        <p className="text-3xl font-bold text-gray-900">{examStats.averagePercentage.toFixed(1)}%</p>
                        <p className="text-sm text-gray-500 mt-1">Average Score</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 text-center border-l-4 border-purple-500">
                        <BookOpen className="w-8 h-8 text-purple-600 mx-auto mb-3" />
                        <p className="text-3xl font-bold text-gray-900">{examStats.bestPercentage.toFixed(1)}%</p>
                        <p className="text-sm text-gray-500 mt-1">Best Score</p>
                    </div>
                </div>

                {/* Pie Chart */}
                {performanceData.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <PieChartIcon className="w-6 h-6 text-purple-600" />
                            <h2 className="text-xl font-bold text-gray-900">
                                {groupBy === 'section' ? 'Section' : 'Tag'} Performance Distribution
                            </h2>
                        </div>
                        <div className="h-64 sm:h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={performanceData.map((s) => ({
                                            name: getText(s.name, language),
                                            value: s.percentage,
                                            marks: `${s.marksEarned.toFixed(1)}/${s.totalPossibleMarks.toFixed(1)}`
                                        }))}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                        label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
                                        labelLine={{ stroke: '#6B7280', strokeWidth: 1 }}
                                    >
                                        {performanceData.map((_, index) => {
                                            const colors = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
                                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                        })}
                                    </Pie>
                                    <Tooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length > 0) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white rounded-lg shadow-lg border border-gray-100 p-3">
                                                        <p className="font-semibold text-gray-900">{data.name}</p>
                                                        <p className="text-sm text-gray-600">Score: {data.value.toFixed(1)}%</p>
                                                        <p className="text-sm text-gray-500">Marks: {data.marks}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend
                                        layout="horizontal"
                                        verticalAlign="bottom"
                                        align="center"
                                        wrapperStyle={{ paddingTop: '20px' }}
                                        formatter={(value, entry: any) => (
                                            <span className="text-sm text-gray-700">
                                                {value} ({entry.payload?.value?.toFixed(0)}%)
                                            </span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Detailed List */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                        <h2 className="text-xl font-bold text-gray-900">
                            {groupBy === 'section' ? 'Section' : 'Tag'}-wise Performance
                        </h2>
                        <span className="text-sm text-gray-500 ml-2">(Strongest → Weakest)</span>
                    </div>

                    {performanceData.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                            <p className="text-lg font-medium">No performance data yet</p>
                            <p className="text-sm mt-1">Try changing filters or complete more exams</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {performanceData.map((item, index) => {
                                const isStrong = item.percentage >= 70;
                                const isWeak = item.percentage < 40;
                                return (
                                    <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                                        {/* Rank */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isStrong ? 'bg-green-100 text-green-700' :
                                            isWeak ? 'bg-red-100 text-red-700' :
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            #{index + 1}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-semibold text-gray-900 truncate">
                                                    {getText(item.name, language)}
                                                </span>
                                                <span className={`font-bold text-lg ${isStrong ? 'text-green-600' :
                                                    isWeak ? 'text-red-600' :
                                                        'text-yellow-600'
                                                    }`}>
                                                    {item.percentage.toFixed(1)}%
                                                </span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${isStrong ? 'bg-green-500' :
                                                        isWeak ? 'bg-red-500' :
                                                            'bg-yellow-500'
                                                        }`}
                                                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                                                />
                                            </div>

                                            {/* Stats */}
                                            <div className="flex justify-between text-xs text-gray-500 mt-2">
                                                <span>✓ {item.correctAnswers}/{item.questionsAttempted} correct</span>
                                                <span>{item.marksEarned.toFixed(1)}/{item.totalPossibleMarks.toFixed(1)} marks</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Tips Section */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                    <h3 className="font-bold text-gray-900 mb-3">💡 Tips for Improvement</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                        {performanceData.length > 0 && performanceData[performanceData.length - 1].percentage < 50 && (
                            <li>• Focus more on <strong>{getText(performanceData[performanceData.length - 1].name, language)}</strong> - it&apos;s your weakest area</li>
                        )}
                        <li>• Practice regularly to maintain consistency</li>
                        <li>• Review incorrect answers to understand your mistakes</li>
                        <li>• Time management is key during exams</li>
                    </ul>
                </div>
            </main>
        </div>
    );
}
