'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { formatDateTimeIST, getText } from '@/lib/utils';
import {
    BookOpen, Plus, Edit, Trash2, Eye, Users,
    Clock, FileText, ChevronLeft, MoreVertical
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Exam {
    id: string;
    title: Record<string, string>;
    description: Record<string, string> | null;
    duration: number;
    total_marks: number;
    status: string;
    created_at: string;
    section_count: number;
    question_count: number;
    assigned_count: number;
}

export default function AdminExamsPage() {
    const router = useRouter();
    const { user, language, isAuthenticated, _hasHydrated } = useAuthStore();
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadExams();
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadExams = async () => {
        try {
            const response = await fetch('/api/admin/exams');
            const data = await response.json();
            if (data.success) {
                setExams(data.exams);
            }
        } catch (error) {
            toast.error('Failed to load exams');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (examId: string) => {
        try {
            const response = await fetch(`/api/admin/exams/${examId}`, { method: 'DELETE' });
            if (response.ok) {
                toast.success('Exam deleted');
                setExams(exams.filter(e => e.id !== examId));
            } else {
                toast.error('Failed to delete exam');
            }
        } catch (error) {
            toast.error('An error occurred');
        }
        setDeleteConfirm(null);
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-600',
            published: 'bg-green-100 text-green-600',
            archived: 'bg-red-100 text-red-600',
        };
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || styles.draft}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
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
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Manage Exams</h1>
                            <p className="text-sm text-gray-500">{exams.length} total exams</p>
                        </div>
                    </div>
                    <Link
                        href="/admin/exams/create"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus className="w-4 h-4" />
                        Create Exam
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                {exams.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center">
                        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">No exams created yet.</p>
                        <Link
                            href="/admin/exams/create"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4" />
                            Create First Exam
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {exams.map((exam) => (
                            <div
                                key={exam.id}
                                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {getText(exam.title, language)}
                                            </h3>
                                            {getStatusBadge(exam.status)}
                                        </div>

                                        {exam.description && (
                                            <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                                                {getText(exam.description, language)}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {exam.duration} mins
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <FileText className="w-4 h-4" />
                                                {exam.section_count} sections, {exam.question_count} questions
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users className="w-4 h-4" />
                                                {exam.assigned_count} students assigned
                                            </span>
                                            <span>Total: {exam.total_marks} marks</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        <Link
                                            href={`/admin/exams/${exam.id}`}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                            title="View/Edit"
                                        >
                                            <Edit className="w-5 h-5" />
                                        </Link>
                                        <Link
                                            href={`/admin/exams/${exam.id}/questions`}
                                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                                            title="Manage Questions"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </Link>
                                        <button
                                            onClick={() => setDeleteConfirm(exam.id)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs text-gray-400">
                                    <span>Created: {formatDateTimeIST(exam.created_at)}</span>
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/admin/exams/${exam.id}/schedule`}
                                            className="text-blue-600 hover:underline"
                                        >
                                            Schedule
                                        </Link>
                                        <Link
                                            href={`/admin/exams/${exam.id}/assign`}
                                            className="text-blue-600 hover:underline"
                                        >
                                            Assign Students
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Exam?</h3>
                        <p className="text-gray-500 mb-6">
                            This will permanently delete the exam, all sections, questions, and student attempts.
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
