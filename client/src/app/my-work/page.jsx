'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ClipboardList, Search, Filter, Calendar, Users, User, UsersRound,
    Clock, ChevronRight, Eye, Send, AlertCircle
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function MyAssignedWorkPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated, selectedSessionId } = useAuthStore();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [targetTypeFilter, setTargetTypeFilter] = useState('all');
    const [dueDateFilter, setDueDateFilter] = useState('all');

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadAssignedWork();
    }, [isAuthenticated, _hasHydrated, selectedSessionId]);

    const loadAssignedWork = async () => {
        try {
            // Get assignments assigned to the current user
            const res = await api.get('/assignments/my-assigned');
            setAssignments(res.data.data.assignments || []);
        } catch (error) {
            console.error('Failed to load assigned work:', error);
            toast.error('Failed to load assigned work');
        } finally {
            setLoading(false);
        }
    };

    const getTargetTypeIcon = (type) => {
        switch (type) {
            case 'class': return <Users className="w-4 h-4 text-blue-500" />;
            case 'group': return <UsersRound className="w-4 h-4 text-purple-500" />;
            case 'student': return <User className="w-4 h-4 text-emerald-500" />;
            default: return <ClipboardList className="w-4 h-4 text-slate-500" />;
        }
    };

    const getTargetTypeBadge = (type) => {
        const styles = {
            class: 'bg-blue-100 text-blue-700',
            group: 'bg-purple-100 text-purple-700',
            student: 'bg-emerald-100 text-emerald-700'
        };
        return styles[type] || 'bg-slate-100 text-slate-700';
    };

    const getDueDaysText = (dueDate) => {
        if (!dueDate) return null;
        const now = new Date();
        const due = new Date(dueDate);
        const diffMs = due - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { text: `${Math.abs(diffDays)} days overdue`, className: 'text-red-600 bg-red-50' };
        if (diffDays === 0) return { text: 'Due today', className: 'text-amber-600 bg-amber-50' };
        if (diffDays === 1) return { text: 'Due tomorrow', className: 'text-amber-600 bg-amber-50' };
        if (diffDays <= 3) return { text: `Due in ${diffDays} days`, className: 'text-amber-600 bg-amber-50' };
        if (diffDays <= 7) return { text: `Due in ${diffDays} days`, className: 'text-blue-600 bg-blue-50' };
        return { text: `Due in ${diffDays} days`, className: 'text-slate-600 bg-slate-50' };
    };

    // Filter assignments
    let filteredAssignments = assignments.filter(a =>
        a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.titleHindi?.includes(searchQuery) ||
        a.experimentNumber?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Filter by target type
    if (targetTypeFilter !== 'all') {
        filteredAssignments = filteredAssignments.filter(a => a.targetType === targetTypeFilter);
    }

    // Filter by due date
    if (dueDateFilter !== 'all') {
        const now = new Date();
        filteredAssignments = filteredAssignments.filter(a => {
            if (!a.dueDate) return dueDateFilter === 'no_due';
            const due = new Date(a.dueDate);
            const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

            switch (dueDateFilter) {
                case 'overdue': return diffDays < 0;
                case 'today': return diffDays === 0;
                case 'week': return diffDays >= 0 && diffDays <= 7;
                case 'month': return diffDays >= 0 && diffDays <= 30;
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
            <PageHeader title="My Assigned Work" titleHindi="मेरा सौंपा गया कार्य" />

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Filters */}
                <div className="card p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search assignments..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="input pl-10"
                            />
                        </div>
                        <select
                            value={targetTypeFilter}
                            onChange={(e) => setTargetTypeFilter(e.target.value)}
                            className="input"
                        >
                            <option value="all">All Assignment Types</option>
                            <option value="class">Class Assignments</option>
                            <option value="group">Group Assignments</option>
                            <option value="student">Individual Assignments</option>
                        </select>
                        <select
                            value={dueDateFilter}
                            onChange={(e) => setDueDateFilter(e.target.value)}
                            className="input"
                        >
                            <option value="all">All Due Dates</option>
                            <option value="overdue">Overdue</option>
                            <option value="today">Due Today</option>
                            <option value="week">Due This Week</option>
                            <option value="month">Due This Month</option>
                            <option value="no_due">No Deadline</option>
                        </select>
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-slate-900">{assignments.length}</p>
                        <p className="text-sm text-slate-500">Total Assigned</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-amber-600">
                            {assignments.filter(a => a.dueDate && new Date(a.dueDate) < new Date()).length}
                        </p>
                        <p className="text-sm text-slate-500">Overdue</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">
                            {assignments.filter(a => !a.hasSubmitted).length}
                        </p>
                        <p className="text-sm text-slate-500">Pending</p>
                    </div>
                    <div className="card p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-600">
                            {assignments.filter(a => a.hasSubmitted).length}
                        </p>
                        <p className="text-sm text-slate-500">Submitted</p>
                    </div>
                </div>

                {/* Assignments List */}
                {filteredAssignments.length === 0 ? (
                    <div className="card p-12 text-center">
                        <ClipboardList className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No assigned work found</h3>
                        <p className="text-slate-500">
                            {searchQuery || targetTypeFilter !== 'all' || dueDateFilter !== 'all'
                                ? 'Try adjusting your filters'
                                : 'No work has been assigned to you yet'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredAssignments.map((assignment) => {
                            const dueInfo = getDueDaysText(assignment.dueDate);
                            return (
                                <div key={assignment.id} className="card card-hover p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Left - Icon */}
                                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                                            <ClipboardList className="w-6 h-6 text-primary-600" />
                                        </div>

                                        {/* Middle - Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                {assignment.experimentNumber && (
                                                    <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                                                        {assignment.experimentNumber}
                                                    </span>
                                                )}
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1 ${getTargetTypeBadge(assignment.targetType)}`}>
                                                    {getTargetTypeIcon(assignment.targetType)}
                                                    {assignment.targetType === 'class' && 'Class'}
                                                    {assignment.targetType === 'group' && 'Group'}
                                                    {assignment.targetType === 'student' && 'Individual'}
                                                </span>
                                                {assignment.hasSubmitted ? (
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                                        Submitted
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700">
                                                        Pending
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="font-semibold text-slate-900 mb-1">{assignment.title}</h3>
                                            {assignment.titleHindi && (
                                                <p className="text-sm text-slate-600 mb-2">{assignment.titleHindi}</p>
                                            )}

                                            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-4 h-4" />
                                                    {assignment.subject?.name || 'General'}
                                                </span>
                                                {assignment.dueDate && (
                                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded ${dueInfo?.className}`}>
                                                        <Clock className="w-4 h-4" />
                                                        {dueInfo?.text}
                                                    </span>
                                                )}
                                                <span>Max: {assignment.maxMarks} marks</span>
                                                {/* Show grade if graded */}
                                                {assignment.isGraded && assignment.grade && (
                                                    <span className="flex items-center gap-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                                                        📊 {assignment.grade.totalMarks}/{assignment.maxMarks}
                                                        {assignment.grade.gradeLetter && (
                                                            <span className="px-1.5 py-0.5 bg-emerald-500 text-white rounded text-xs">
                                                                {assignment.grade.gradeLetter}
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right - Actions */}
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/assignments/${assignment.id}`}
                                                className="btn btn-ghost p-2"
                                                title="View Details"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </Link>
                                            {!assignment.hasSubmitted && (
                                                <Link
                                                    href={`/assignments/${assignment.id}/submit`}
                                                    className="btn btn-primary"
                                                >
                                                    <Send className="w-4 h-4" />
                                                    Submit
                                                </Link>
                                            )}
                                            {assignment.hasSubmitted && assignment.isGraded && (
                                                <Link
                                                    href="/grades"
                                                    className="btn btn-secondary"
                                                >
                                                    View Grade
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
