'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import {
    BookOpen, Users, FileText, Calendar,
    PlusCircle, LogOut, Settings, BarChart3,
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
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to load stats');
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
        { label: 'Settings', icon: Settings, href: '/admin/settings', color: 'bg-gray-500' },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BookOpen className="w-8 h-8 text-blue-600" />
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Merit Entrance</h1>
                            <p className="text-sm text-gray-500">Admin Panel</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-600">Welcome, <strong>{user?.name}</strong></span>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {quickActions.map((action) => (
                        <Link
                            key={action.label}
                            href={action.href}
                            className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition group"
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

                {/* Navigation Menu */}
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Management</h2>
                <div className="bg-white rounded-xl shadow-sm divide-y">
                    <Link href="/admin/exams" className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-gray-500" />
                            <span className="font-medium">Manage Exams</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>
                    <Link href="/admin/students" className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3">
                            <Users className="w-5 h-5 text-gray-500" />
                            <span className="font-medium">Manage Students</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>
                    <Link href="/admin/results" className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3">
                            <BarChart3 className="w-5 h-5 text-gray-500" />
                            <span className="font-medium">View Results & Analytics</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>
                </div>
            </main>
        </div>
    );
}
