'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import {
    BarChart3, Users, FileText, Activity,
    ArrowUpRight, ArrowDownRight, Clock,
    ChevronRight, Search, PieChart
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GlobalStats {
    totalStudents: number;
    totalExams: number;
    totalAttempts: number;
    avgScore: number;
    passRate: number;
    recentActivity: {
        action: string;
        description: string;
        timestamp: string;
    }[];
}

export default function ReportsDashboard() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadStats();
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadStats = async () => {
        try {
            const response = await fetch('/api/admin/reports/stats');
            if (response.status === 401) {
                toast.error('Session expired. Please login again.');
                router.push('/');
                return;
            }
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            } else {
                console.error('Reports Stats API error:', data.error);
            }
        } catch (error) {
            toast.error('Failed to load stats');
        } finally {
            setLoading(false);
        }
    };

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
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-8 h-8 text-blue-600" />
                        Reports & Analytics
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Comprehensive insights into student performance and exam effectiveness.
                    </p>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard
                        title="Total Students"
                        value={stats?.totalStudents || 0}
                        icon={Users}
                        color="blue"
                    />
                    <StatsCard
                        title="Exams Conducted"
                        value={stats?.totalExams || 0}
                        icon={FileText}
                        color="purple"
                    />
                    <StatsCard
                        title="Total Attempts"
                        value={stats?.totalAttempts || 0}
                        icon={Activity}
                        color="orange"
                    />
                    <StatsCard
                        title="Global Pass Rate"
                        value={`${stats?.passRate || 0}%`}
                        icon={PieChart}
                        color="green"
                        subtext={`Avg Score: ${stats?.avgScore || 0}`}
                    />
                </div>

                {/* Quick Actions / Navigation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Link href="/admin/reports/student" className="block group">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition h-full">
                            <div className="flex items-start justify-between">
                                <div className="p-3 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition">
                                    <Users className="w-8 h-8 text-indigo-600" />
                                </div>
                                <div className="p-2 bg-gray-50 rounded-full group-hover:bg-gray-100 transition">
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mt-4 group-hover:text-indigo-600 transition">Student Analytics</h3>
                            <p className="text-gray-500 mt-2 text-sm">
                                Deep dive into individual student performance. View progress trends, attempt history, and export reports.
                            </p>
                        </div>
                    </Link>

                    <Link href="/admin/reports/exam" className="block group">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition h-full">
                            <div className="flex items-start justify-between">
                                <div className="p-3 bg-pink-50 rounded-lg group-hover:bg-pink-100 transition">
                                    <Activity className="w-8 h-8 text-pink-600" />
                                </div>
                                <div className="p-2 bg-gray-50 rounded-full group-hover:bg-gray-100 transition">
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mt-4 group-hover:text-pink-600 transition">Exam Analytics</h3>
                            <p className="text-gray-500 mt-2 text-sm">
                                Analyze exam difficulty and effectiveness. View score distributions, item analysis, and class performance.
                            </p>
                        </div>
                    </Link>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-500" />
                        Recent System Activity
                    </h2>
                    <div className="space-y-6">
                        {stats?.recentActivity.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No recent activity.</p>
                        ) : (
                            stats?.recentActivity.map((activity, index) => (
                                <div key={index} className="flex gap-4">
                                    <div className="relative">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                                        {index !== stats.recentActivity.length - 1 && (
                                            <div className="absolute top-4 left-1 w-0.5 h-full bg-gray-100"></div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {formatAction(activity.action)}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-0.5">{activity.description}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {new Date(activity.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, color, subtext }: any) {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600',
        orange: 'bg-orange-50 text-orange-600',
        green: 'bg-green-50 text-green-600',
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{value}</span>
                {subtext && <span className="text-sm text-gray-500">{subtext}</span>}
            </div>
        </div>
    );
}

function formatAction(action: string) {
    return action.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
