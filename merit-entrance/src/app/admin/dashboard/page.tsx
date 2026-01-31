'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import {
    BookOpen, Users, FileText, Calendar,
    PlusCircle, Settings, BarChart3,
    ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardStats {
    totalExams: number;
    totalStudents: number;
    totalQuestions: number;
    activeExams: number;
}

export default function AdminDashboard() {
    const router = useRouter();
    const { user, isAuthenticated, logout, _hasHydrated } = useAuthStore();
    const [stats, setStats] = useState<DashboardStats>({
        totalExams: 0,
        totalStudents: 0,
        totalQuestions: 0,
        activeExams: 0,
    });
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
            const response = await fetch('/api/admin/stats');
            if (response.status === 401) {
                toast.error('Session expired. Please login again.');
                router.push('/');
                return;
            }
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            } else {
                console.error('Stats API error:', data.error);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
            toast.error('Failed to load dashboard stats');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        logout();
        router.push('/');
    };

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const quickActions = [
        { label: 'Create Exam', icon: PlusCircle, href: '/admin/exams/create', color: 'bg-blue-500' },
        { label: 'Add Students', icon: Users, href: '/admin/students', color: 'bg-green-500' },
        { label: 'View Results', icon: BarChart3, href: '/admin/results', color: 'bg-purple-500' },
        { label: 'Analytics', icon: BarChart3, href: '/admin/reports', color: 'bg-indigo-500' },
        { label: 'Settings', icon: Settings, href: '/admin/settings', color: 'bg-gray-500' },
    ];

    return (
        <div className="bg-gray-50 h-full">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome back, {user?.name}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalExams}</p>
                            <p className="text-sm text-gray-500">Total Exams</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <Users className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
                            <p className="text-sm text-gray-500">Total Students</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-lg">
                            <BookOpen className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.totalQuestions}</p>
                            <p className="text-sm text-gray-500">Total Questions</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-100 rounded-lg">
                            <Calendar className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.activeExams}</p>
                            <p className="text-sm text-gray-500">Active Exams</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((action) => (
                    <Link
                        key={action.label}
                        href={action.href}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition group border border-transparent hover:border-gray-200"
                    >
                        <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center mb-4`}>
                            <action.icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{action.label}</span>
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition" />
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
