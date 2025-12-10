'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Activity, Search, Filter, Calendar, User, Clock,
    FileText, Award, Video, LogIn, LogOut, Users, BookOpen,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function ActivityLogsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        // Only admin, principal, instructor can view activity logs
        const allowedRoles = ['admin', 'principal', 'instructor'];
        if (!allowedRoles.includes(user?.role)) {
            router.push('/dashboard');
            return;
        }
        loadLogs();
    }, [isAuthenticated, _hasHydrated, page, typeFilter]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const params = { page, limit: 50 };
            if (typeFilter !== 'all') params.actionType = typeFilter;

            const res = await api.get('/activity-logs', { params });
            setLogs(res.data.data.logs || []);
            setTotalPages(res.data.data.pagination?.pages || 1);
        } catch (error) {
            console.error('Failed to load activity logs:', error);
            toast.error('Failed to load activity logs');
        } finally {
            setLoading(false);
        }
    };

    const getActivityIcon = (type) => {
        const icons = {
            login: <LogIn className="w-4 h-4 text-green-500" />,
            logout: <LogOut className="w-4 h-4 text-slate-500" />,
            submission: <FileText className="w-4 h-4 text-blue-500" />,
            grade: <Award className="w-4 h-4 text-amber-500" />,
            assignment: <BookOpen className="w-4 h-4 text-purple-500" />,
            assignment_assigned: <BookOpen className="w-4 h-4 text-emerald-500" />,
            assignment_unassigned: <BookOpen className="w-4 h-4 text-red-500" />,
            viva: <Video className="w-4 h-4 text-pink-500" />,
            payment: <Users className="w-4 h-4 text-emerald-500" />,
            other: <Activity className="w-4 h-4 text-slate-500" />
        };
        return icons[type] || icons.other;
    };

    const getActivityColor = (type) => {
        const colors = {
            login: 'bg-green-100',
            logout: 'bg-slate-100',
            submission: 'bg-blue-100',
            grade: 'bg-amber-100',
            assignment: 'bg-purple-100',
            assignment_assigned: 'bg-emerald-100',
            assignment_unassigned: 'bg-red-100',
            viva: 'bg-pink-100',
            payment: 'bg-emerald-100',
            other: 'bg-slate-100'
        };
        return colors[type] || colors.other;
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    // Filter logs
    let filteredLogs = logs.filter(log =>
        log.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user?.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Filter by date
    if (dateFilter !== 'all') {
        const now = new Date();
        filteredLogs = filteredLogs.filter(log => {
            const logDate = new Date(log.createdAt);
            const diffDays = Math.floor((now - logDate) / 86400000);

            switch (dateFilter) {
                case 'today': return diffDays < 1;
                case 'week': return diffDays <= 7;
                case 'month': return diffDays <= 30;
                default: return true;
            }
        });
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title="Activity Logs" titleHindi="गतिविधि लॉग" />

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Filters */}
                <div className="card p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by user or activity..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input pl-10"
                            />
                        </div>
                        <select
                            value={typeFilter}
                            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                            className="input"
                        >
                            <option value="all">All Activity Types</option>
                            <option value="login">Logins</option>
                            <option value="logout">Logouts</option>
                            <option value="submission">Submissions</option>
                            <option value="grade">Grading</option>
                            <option value="assignment">Assignments</option>
                            <option value="assignment_assigned">Work Assigned</option>
                            <option value="assignment_unassigned">Work Removed</option>
                            <option value="viva">Viva Sessions</option>
                        </select>
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="input"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">Last 7 Days</option>
                            <option value="month">Last 30 Days</option>
                        </select>
                    </div>
                </div>

                {/* Activity List */}
                {filteredLogs.length === 0 ? (
                    <div className="card p-12 text-center">
                        <Activity className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No activity logs found</h3>
                        <p className="text-slate-500">Activity will appear here as users perform actions</p>
                    </div>
                ) : (
                    <div className="card overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {filteredLogs.map((log) => (
                                <div key={log.id} className="p-4 hover:bg-slate-50 transition">
                                    <div className="flex items-start gap-4">
                                        {/* Activity Icon */}
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(log.actionType)}`}>
                                            {getActivityIcon(log.actionType)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">
                                                        {log.description}
                                                    </p>
                                                    {log.descriptionHindi && (
                                                        <p className="text-xs text-slate-500">{log.descriptionHindi}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {log.user?.firstName} {log.user?.lastName}
                                                        </span>
                                                        <span className="capitalize px-1.5 py-0.5 rounded bg-slate-100">
                                                            {log.user?.role?.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-xs text-slate-500">{formatTime(log.createdAt)}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        {new Date(log.createdAt).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </div>
                                            {log.ipAddress && (
                                                <p className="text-xs text-slate-400 mt-1">IP: {log.ipAddress}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                                <p className="text-sm text-slate-500">
                                    Page {page} of {totalPages}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="btn btn-ghost py-1 px-3 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="btn btn-ghost py-1 px-3 disabled:opacity-50"
                                    >
                                        Next
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
