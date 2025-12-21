'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FileText, Upload, Award, Video, Users,
    ChevronRight, TrendingUp, Clock, CheckCircle, BookOpen, Monitor
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { dashboardAPI } from '@/lib/api';

export default function DashboardPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated, selectedSessionId } = useAuthStore();
    const [stats, setStats] = useState({});
    const [deadlines, setDeadlines] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadDashboardData();
    }, [isAuthenticated, _hasHydrated, selectedSessionId]);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [statsRes, deadlinesRes] = await Promise.all([
                dashboardAPI.getStats(),
                dashboardAPI.getDeadlines()
            ]);
            setStats(statsRes.data.data.stats);
            setDeadlines(deadlinesRes.data.data.upcomingDeadlines || []);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ icon: Icon, label, value, color, trend }) => (
        <div className="stat-card card-hover">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500">{label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
                    {trend && (
                        <p className="text-sm text-emerald-600 mt-1 flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            {trend}
                        </p>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>
        </div>
    );

    if (!isAuthenticated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6">
            {/* Welcome banner */}
            <div className="card p-6 bg-gradient-to-r from-primary-500 to-accent-500 text-white">
                <h2 className="text-2xl font-bold">Welcome back, {user?.firstName}! 👋</h2>
                <p className="text-white/80 mt-1">Here's what's happening with your lab activities.</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {user?.role === 'student' && (
                    <>
                        <StatCard icon={FileText} label="Assigned to Me" value={stats.assignedToMe || 0} color="bg-primary-500" />
                        <StatCard icon={Upload} label="My Submissions" value={stats.mySubmissions || 0} color="bg-emerald-500" />
                        <StatCard icon={Video} label="Pending Vivas" value={stats.pendingVivas || 0} color="bg-amber-500" />
                        <StatCard icon={Award} label="Avg. Score" value="--" color="bg-accent-500" />
                    </>
                )}
                {(user?.role === 'instructor' || user?.role === 'lab_assistant') && (
                    <>
                        <StatCard icon={FileText} label="My Assignments" value={stats.myAssignments || 0} color="bg-primary-500" />
                        <StatCard icon={Clock} label="Pending Grading" value={stats.pendingGrading || 0} color="bg-amber-500" />
                        <StatCard icon={Video} label="Scheduled Vivas" value={stats.scheduledVivas || 0} color="bg-emerald-500" />
                        <StatCard icon={CheckCircle} label="Completed" value="--" color="bg-accent-500" />
                    </>
                )}
                {user?.role === 'admin' && (
                    <>
                        <StatCard icon={Users} label="Total Users" value={stats.totalUsers || 0} color="bg-primary-500" />
                        <StatCard icon={BookOpen} label="Total Classes" value={stats.totalClasses || 0} color="bg-emerald-500" />
                        <StatCard icon={FileText} label="Assignments" value={stats.totalAssignments || 0} color="bg-amber-500" />
                        <StatCard icon={TrendingUp} label="Active Labs" value="--" color="bg-accent-500" />
                    </>
                )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {user?.role === 'student' && (
                    <>
                        <Link href="/assignments" className="card p-4 hover:shadow-lg transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition">
                                    <FileText className="w-6 h-6 text-primary-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">View Assignments</p>
                                    <p className="text-sm text-slate-500">Check pending work</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                            </div>
                        </Link>
                        <Link href="/submissions" className="card p-4 hover:shadow-lg transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition">
                                    <Upload className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">My Submissions</p>
                                    <p className="text-sm text-slate-500">Track your work</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                            </div>
                        </Link>
                        <Link href="/grades" className="card p-4 hover:shadow-lg transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition">
                                    <Award className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">View Grades</p>
                                    <p className="text-sm text-slate-500">Check your scores</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                            </div>
                        </Link>
                    </>
                )}
                {(user?.role === 'instructor' || user?.role === 'admin') && (
                    <>
                        <Link href="/assignments/create" className="card p-4 hover:shadow-lg transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition">
                                    <FileText className="w-6 h-6 text-primary-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">Create Assignment</p>
                                    <p className="text-sm text-slate-500">Add new practical</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                            </div>
                        </Link>
                        <Link href="/submissions" className="card p-4 hover:shadow-lg transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition">
                                    <Clock className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">Review Pending</p>
                                    <p className="text-sm text-slate-500">Grade submissions</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                            </div>
                        </Link>
                        <Link href="/classes" className="card p-4 hover:shadow-lg transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition">
                                    <Users className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">Manage Classes</p>
                                    <p className="text-sm text-slate-500">View students</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                            </div>
                        </Link>
                    </>
                )}
                {user?.role === 'admin' && (
                    <>
                        <Link href="/admin/labs" className="card p-4 hover:shadow-lg transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition">
                                    <Monitor className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">Labs & PCs</p>
                                    <p className="text-sm text-slate-500">Manage computer labs</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                            </div>
                        </Link>
                        <Link href="/users" className="card p-4 hover:shadow-lg transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition">
                                    <Users className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">User Management</p>
                                    <p className="text-sm text-slate-500">Manage all users</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                            </div>
                        </Link>
                        <Link href="/admin/students" className="card p-4 hover:shadow-lg transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition">
                                    <BookOpen className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">Import Students</p>
                                    <p className="text-sm text-slate-500">Bulk import CSV</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                            </div>
                        </Link>
                    </>
                )}
            </div>

            {/* Upcoming deadlines */}
            <div className="card">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Upcoming Deadlines</h3>
                    <Link href="/assignments" className="text-sm text-primary-600 hover:underline">View all →</Link>
                </div>
                <div className="divide-y divide-slate-100">
                    {deadlines.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p>No upcoming deadlines</p>
                        </div>
                    ) : (
                        deadlines.slice(0, 5).map((item, i) => (
                            <Link key={i} href={`/assignments/${item.id}`} className="p-4 flex items-center justify-between hover:bg-slate-50 transition block">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-primary-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-900">{item.title}</p>
                                        <p className="text-sm text-slate-500">{item.subject?.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="badge badge-warning">
                                        {new Date(item.dueDate).toLocaleDateString()}
                                    </span>
                                    <ChevronRight className="w-5 h-5 text-slate-400" />
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
