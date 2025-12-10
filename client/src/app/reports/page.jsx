'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, Users, FileText, Award, Download, BarChart3, Calendar, CheckCircle, Info, X } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

// Grade Scale Configuration
const GRADE_SCALE = [
    { grade: 'A+', minPercent: 90, maxPercent: 100, description: 'Outstanding' },
    { grade: 'A', minPercent: 80, maxPercent: 89, description: 'Excellent' },
    { grade: 'B+', minPercent: 70, maxPercent: 79, description: 'Very Good' },
    { grade: 'B', minPercent: 60, maxPercent: 69, description: 'Good' },
    { grade: 'C+', minPercent: 50, maxPercent: 59, description: 'Above Average' },
    { grade: 'C', minPercent: 40, maxPercent: 49, description: 'Average' },
    { grade: 'D', minPercent: 33, maxPercent: 39, description: 'Below Average' },
    { grade: 'F', minPercent: 0, maxPercent: 32, description: 'Fail' }
];

export default function ReportsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('month');
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalAssignments: 0,
        totalSubmissions: 0,
        gradedSubmissions: 0,
        submissionRate: 0,
        avgScore: 0
    });
    const [gradeDistribution, setGradeDistribution] = useState([]);
    const [topPerformers, setTopPerformers] = useState([]);
    const [exporting, setExporting] = useState(false);
    const [showGradeScale, setShowGradeScale] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (user?.role !== 'admin' && user?.role !== 'instructor' && user?.role !== 'principal') {
            router.push('/dashboard');
            return;
        }
        loadReportData();
    }, [isAuthenticated, user, dateRange, _hasHydrated]);

    const loadReportData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/reports/analytics', {
                params: { dateRange }
            });
            const data = res.data.data;

            setStats({
                totalStudents: data.totalStudents || 0,
                totalAssignments: data.totalAssignments || 0,
                totalSubmissions: data.totalSubmissions || 0,
                gradedSubmissions: data.gradedSubmissions || 0,
                submissionRate: data.submissionRate || 0,
                avgScore: data.avgScore || 0
            });
            setGradeDistribution(data.gradeDistribution || []);
            setTopPerformers(data.topPerformers || []);
        } catch (error) {
            console.error('Failed to load report data:', error);
            toast.error('Failed to load analytics data');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format) => {
        setExporting(true);
        try {
            const response = await api.get('/reports/export', {
                params: { format, dateRange },
                responseType: 'blob'
            });

            // Create download link
            const blob = new Blob([response.data], {
                type: format === 'csv' ? 'text/csv' : 'application/pdf'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `lab_report_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success(`Report exported as ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export report');
        } finally {
            setExporting(false);
        }
    };

    const gradeColors = {
        'A+': 'bg-emerald-500',
        'A': 'bg-emerald-400',
        'B+': 'bg-blue-500',
        'B': 'bg-blue-400',
        'C+': 'bg-amber-500',
        'C': 'bg-amber-400',
        'D': 'bg-orange-500',
        'F': 'bg-red-500'
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title="Reports & Analytics" titleHindi="रिपोर्ट और विश्लेषण">
                <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="input py-2 text-sm w-36"
                >
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                    <option value="quarter">Last 90 Days</option>
                    <option value="year">This Year</option>
                    <option value="all">All Time</option>
                </select>
                <div className="relative">
                    <button
                        onClick={() => handleExport('csv')}
                        disabled={exporting}
                        className="btn btn-primary"
                    >
                        <Download className="w-4 h-4" />
                        {exporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                </div>
            </PageHeader>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="card p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                                <Users className="w-6 h-6 text-primary-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Total Students</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.totalStudents}</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Assignments</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.totalAssignments}</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Submission Rate</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.submissionRate}%</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Award className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Avg Score</p>
                                <p className="text-2xl font-bold text-slate-900">{stats.avgScore}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Grade Distribution */}
                    <div className="lg:col-span-2 card">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" />
                                Grade Distribution
                            </h3>
                            <button
                                onClick={() => setShowGradeScale(true)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition text-slate-500 hover:text-slate-700"
                                title="View Grade Scale"
                            >
                                <Info className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            {gradeDistribution.length === 0 ? (
                                <p className="text-center text-slate-500 py-8">No grading data available</p>
                            ) : (
                                gradeDistribution.map((g) => {
                                    const maxCount = Math.max(...gradeDistribution.map(d => d.count), 1);
                                    return (
                                        <div key={g.grade} className="flex items-center gap-4">
                                            <span className="w-8 font-semibold text-slate-700">{g.grade}</span>
                                            <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden">
                                                <div
                                                    className={`h-full ${gradeColors[g.grade] || 'bg-slate-400'} rounded-lg flex items-center justify-end pr-2`}
                                                    style={{ width: `${Math.max((g.count / maxCount) * 100, 5)}%` }}
                                                >
                                                    <span className="text-xs font-medium text-white">{g.count}</span>
                                                </div>
                                            </div>
                                            <span className="text-sm text-slate-600 w-12 text-right">
                                                {(stats.gradedSubmissions > 0 ? ((g.count / stats.gradedSubmissions) * 100) : 0).toFixed(0)}%
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Top Performers */}
                    <div className="card">
                        <div className="p-4 border-b border-slate-100">
                            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <Award className="w-5 h-5 text-amber-500" />
                                Top Performers
                            </h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {topPerformers.length === 0 ? (
                                <p className="p-6 text-center text-slate-500">No performance data available</p>
                            ) : (
                                topPerformers.map((s, i) => (
                                    <div key={s.id || i} className="p-4 flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' :
                                            i === 1 ? 'bg-slate-200 text-slate-700' :
                                                i === 2 ? 'bg-orange-100 text-orange-700' :
                                                    'bg-slate-100 text-slate-600'
                                            }`}>
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-900 truncate">
                                                {s.firstName} {s.lastName}
                                            </p>
                                            <p className="text-xs text-slate-500">{s.admissionNumber || s.email}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-primary-600">{(typeof s.avgScore === 'number' ? s.avgScore.toFixed(1) : '0')}%</p>
                                            <p className="text-xs text-slate-500">{s.gradedCount || 0} graded</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Additional Stats */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <div className="card p-4 text-center">
                        <p className="text-sm text-slate-500">Total Submissions</p>
                        <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalSubmissions}</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-sm text-slate-500">Graded</p>
                        <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.gradedSubmissions}</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-sm text-slate-500">Pending Grading</p>
                        <p className="text-3xl font-bold text-amber-600 mt-1">
                            {stats.totalSubmissions - stats.gradedSubmissions}
                        </p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-sm text-slate-500">Pass Rate</p>
                        <p className="text-3xl font-bold text-blue-600 mt-1">
                            {gradeDistribution.length > 0
                                ? (stats.gradedSubmissions > 0 ? ((gradeDistribution.filter(g => g.grade !== 'F').reduce((sum, g) => sum + g.count, 0) / stats.gradedSubmissions) * 100) : 0).toFixed(0)
                                : 0}%
                        </p>
                    </div>
                </div>
            </main>

            {/* Grade Scale Modal */}
            {showGradeScale && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">Grade Distribution Scale</h3>
                            <button
                                onClick={() => setShowGradeScale(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-sm text-slate-500 border-b">
                                        <th className="pb-3 font-medium">Grade</th>
                                        <th className="pb-3 font-medium">Marks Range</th>
                                        <th className="pb-3 font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {GRADE_SCALE.map((g) => (
                                        <tr key={g.grade} className="text-sm">
                                            <td className="py-3">
                                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold ${gradeColors[g.grade] || 'bg-slate-400'}`}>
                                                    {g.grade}
                                                </span>
                                            </td>
                                            <td className="py-3 text-slate-700 font-medium">
                                                {g.minPercent}% - {g.maxPercent}%
                                            </td>
                                            <td className="py-3 text-slate-500">
                                                {g.description}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="text-xs text-slate-400 mt-4 text-center">
                                Grade scale can be modified in Settings → Grading Configuration
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
