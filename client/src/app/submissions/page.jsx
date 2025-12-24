'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FileText, Search, Filter, CheckCircle, Clock,
    XCircle, Eye, Award, User
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { submissionsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SubmissionsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated, selectedSessionId } = useAuthStore();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadSubmissions();
    }, [isAuthenticated, statusFilter, _hasHydrated, selectedSessionId]);

    const loadSubmissions = async () => {
        try {
            let res;
            if (user?.role === 'student') {
                res = await submissionsAPI.getMySubmissions(
                    statusFilter !== 'all' ? { status: statusFilter } : {}
                );
            } else {
                res = await submissionsAPI.getPendingReview(
                    statusFilter !== 'all' ? { status: statusFilter } : {}
                );
            }
            setSubmissions(res.data.data.submissions || []);
        } catch (error) {
            console.error('Failed to load submissions:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
            toast.error(`Failed to load submissions: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status) => {
        const icons = {
            submitted: <Clock className="w-5 h-5 text-blue-500" />,
            under_review: <Eye className="w-5 h-5 text-amber-500" />,
            graded: <CheckCircle className="w-5 h-5 text-emerald-500" />,
            needs_revision: <XCircle className="w-5 h-5 text-red-500" />,
            returned: <Award className="w-5 h-5 text-purple-500" />
        };
        return icons[status] || <FileText className="w-5 h-5 text-slate-500" />;
    };

    const getStatusBadge = (status) => {
        const styles = {
            submitted: 'badge-primary',
            under_review: 'badge-warning',
            graded: 'badge-success',
            needs_revision: 'badge-danger',
            returned: 'badge-info'
        };
        return styles[status] || 'badge-secondary';
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const isInstructor = user?.role === 'instructor' || user?.role === 'admin' || user?.role === 'lab_assistant';

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">
                            ← Back
                        </Link>
                        <h1 className="text-xl font-semibold text-slate-900">
                            {isInstructor ? 'Submissions for Review' : 'My Submissions'}
                        </h1>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Filters */}
                <div className="card p-4 mb-6">
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${statusFilter === 'all'
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setStatusFilter('submitted')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${statusFilter === 'submitted'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            Submitted
                        </button>
                        <button
                            onClick={() => setStatusFilter('graded')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${statusFilter === 'graded'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            Graded
                        </button>
                        <button
                            onClick={() => setStatusFilter('needs_revision')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${statusFilter === 'needs_revision'
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            Needs Revision
                        </button>
                    </div>
                </div>

                {/* Submissions List */}
                {submissions.length === 0 ? (
                    <div className="card p-12 text-center">
                        <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No submissions found</h3>
                        <p className="text-slate-500">
                            {isInstructor
                                ? 'No submissions pending for review.'
                                : 'You have not submitted any assignments yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {submissions.map((submission) => (
                            <div key={submission.id} className="card card-hover p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                                            {getStatusIcon(submission.status)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`badge ${getStatusBadge(submission.status)}`}>
                                                    {submission.status.replace('_', ' ')}
                                                </span>
                                                {submission.submissionNumber > 1 && (
                                                    <span className="text-xs text-slate-500">
                                                        Revision #{submission.submissionNumber}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-lg font-semibold text-slate-900">
                                                {submission.assignment?.title || 'Assignment'}
                                            </h3>
                                            {isInstructor && submission.student && (
                                                <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                                                    <User className="w-4 h-4" />
                                                    {submission.student.firstName} {submission.student.lastName}
                                                    {(submission.student.studentId || submission.student.admissionNumber) && (
                                                        <span className="text-slate-400">
                                                            ({submission.student.studentId || submission.student.admissionNumber})
                                                        </span>
                                                    )}
                                                </p>
                                            )}
                                            <p className="text-sm text-slate-500 mt-2">
                                                Submitted: {new Date(submission.submittedAt).toLocaleString()}
                                                {submission.isLate && (
                                                    <span className="ml-2 text-red-500">
                                                        (Late by {submission.lateDays} days)
                                                    </span>
                                                )}
                                            </p>
                                            {submission.grade && (
                                                <p className="text-sm font-medium text-emerald-600 mt-1">
                                                    Marks: {submission.grade.finalMarks} / {submission.grade.maxMarks}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/submissions/${submission.id}`}
                                            className="btn btn-primary py-1.5 px-3 text-sm"
                                        >
                                            {isInstructor && submission.status === 'submitted' ? 'Review' : 'View'}
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
