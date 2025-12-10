'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FileText, Plus, Search, Filter, Calendar, Users,
    ChevronRight, Clock, CheckCircle, Edit, Trash2, Eye
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { assignmentsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function AssignmentsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Confirmation dialog state
    const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, title: '' });
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadAssignments();
    }, [isAuthenticated, _hasHydrated]);

    const loadAssignments = async () => {
        try {
            const res = await assignmentsAPI.getAll({ status: statusFilter !== 'all' ? statusFilter : undefined });
            setAssignments(res.data.data.assignments || []);
        } catch (error) {
            toast.error('Failed to load assignments');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (id, title) => {
        setDeleteDialog({ open: true, id, title });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteDialog.id) return;
        setDeleteLoading(true);
        try {
            await assignmentsAPI.delete(deleteDialog.id);
            toast.success('Assignment deleted');
            setDeleteDialog({ open: false, id: null, title: '' });
            loadAssignments();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handlePublish = async (id) => {
        try {
            await assignmentsAPI.publish(id);
            toast.success('Assignment published!');
            loadAssignments();
        } catch (error) {
            toast.error('Failed to publish');
        }
    };

    const filteredAssignments = assignments.filter(a =>
        a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.titleHindi?.includes(searchQuery)
    );

    const getStatusBadge = (status) => {
        const styles = {
            draft: 'badge-warning',
            published: 'badge-success',
            archived: 'badge-danger'
        };
        return styles[status] || 'badge-primary';
    };

    const isInstructor = user?.role === 'instructor' || user?.role === 'admin' || user?.role === 'lab_assistant';

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title="Assignments">
                {isInstructor && (
                    <Link href="/assignments/create" className="btn btn-primary">
                        <Plus className="w-4 h-4" />
                        Create Assignment
                    </Link>
                )}
            </PageHeader>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Filters */}
                <div className="card p-4 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
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
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); loadAssignments(); }}
                            className="input w-full md:w-48"
                        >
                            <option value="all">All Status</option>
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                </div>

                {/* Assignments List */}
                {filteredAssignments.length === 0 ? (
                    <div className="card p-12 text-center">
                        <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No assignments found</h3>
                        <p className="text-slate-500">
                            {isInstructor ? 'Create your first assignment to get started.' : 'No assignments have been assigned to you yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {filteredAssignments.map((assignment) => (
                            <div key={assignment.id} className="card card-hover p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`badge ${getStatusBadge(assignment.status)}`}>
                                                {assignment.status}
                                            </span>
                                            {assignment.experimentNumber && (
                                                <span className="text-sm text-slate-500">{assignment.experimentNumber}</span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-1">
                                            {assignment.title}
                                        </h3>
                                        {assignment.titleHindi && (
                                            <p className="text-sm text-slate-600 mb-2">{assignment.titleHindi}</p>
                                        )}
                                        <p className="text-slate-600 text-sm line-clamp-2 mb-3">
                                            {assignment.description}
                                        </p>
                                        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No deadline'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <CheckCircle className="w-4 h-4" />
                                                Max Marks: {assignment.maxMarks}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <FileText className="w-4 h-4" />
                                                {assignment.assignmentType}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        <Link
                                            href={`/assignments/${assignment.id}`}
                                            className="btn btn-ghost p-2"
                                            title="View"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </Link>
                                        {isInstructor && (
                                            <>
                                                {assignment.status === 'draft' && (
                                                    <button
                                                        onClick={() => handlePublish(assignment.id)}
                                                        className="btn btn-primary py-1.5 px-3 text-sm"
                                                    >
                                                        Publish
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteClick(assignment.id, assignment.title)}
                                                    className="btn btn-ghost p-2 text-red-500 hover:bg-red-50"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </>
                                        )}
                                        {user?.role === 'student' && assignment.status === 'published' && (
                                            <Link
                                                href={`/assignments/${assignment.id}/submit`}
                                                className="btn btn-primary py-1.5 px-3 text-sm"
                                            >
                                                Submit
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteDialog.open}
                onClose={() => setDeleteDialog({ open: false, id: null, title: '' })}
                onConfirm={handleDeleteConfirm}
                title="Delete Assignment"
                message={`Are you sure you want to delete "${deleteDialog.title}"? This action cannot be undone.`}
                confirmText="Delete"
                type="danger"
                loading={deleteLoading}
            />
        </div>
    );
}
