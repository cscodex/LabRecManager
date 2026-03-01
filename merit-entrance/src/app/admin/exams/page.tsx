'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { formatDateTimeIST, getText } from '@/lib/utils';
import {
    BookOpen, Plus, Edit, Trash2, Eye, Users,
    Clock, FileText, ChevronLeft, MoreVertical,
    Search, ChevronRight, Wand2, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '@/components/ui/ConfirmModal';

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
    updated_at: string;
    type: string | null;
}

export default function AdminExamsPage() {
    const router = useRouter();
    const { user, language, isAuthenticated, _hasHydrated } = useAuthStore();
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Filter & Pagination State
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    // Auto-Generate State
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [blueprints, setBlueprints] = useState<any[]>([]);
    const [genBlueprintId, setGenBlueprintId] = useState('');
    const [genTitle, setGenTitle] = useState('');
    const [genDesc, setGenDesc] = useState('');
    const [genDuration, setGenDuration] = useState('60');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCheckingShortage, setIsCheckingShortage] = useState(false);
    const [shortageData, setShortageData] = useState<any>(null);
    const [useAiForMissing, setUseAiForMissing] = useState(true);
    const [createDraftWithMissing, setCreateDraftWithMissing] = useState(false);

    // Custom Confirmation State
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string | React.ReactNode;
        confirmText?: string;
        cancelText?: string;
        type?: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
        onCancel: () => void;
        isLoading?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        onCancel: () => { },
    });

    const closeConfirm = () => setConfirmConfig(prev => ({ ...prev, isOpen: false }));

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

    const handleOpenGenerate = async () => {
        setShowGenerateModal(true);
        try {
            const res = await fetch('/api/admin/blueprints');
            const data = await res.json();
            if (data.success) setBlueprints(data.data);
        } catch (e) {
            toast.error('Failed to load blueprints');
        }
    };

    useEffect(() => {
        if (!genBlueprintId) {
            setShortageData(null);
            return;
        }

        const checkShortage = async () => {
            setIsCheckingShortage(true);
            try {
                const res = await fetch(`/api/admin/blueprints/${genBlueprintId}/check-shortage`);
                const data = await res.json();
                if (data.success) {
                    setShortageData(data);
                } else {
                    setShortageData(null);
                }
            } catch (error) {
                console.error("Failed to check shortage", error);
                setShortageData(null);
            } finally {
                setIsCheckingShortage(false);
            }
        };

        checkShortage();
    }, [genBlueprintId]);

    const submitGeneration = async () => {
        if (!genBlueprintId || !genTitle || !genDuration) {
            toast.error('Please fill all required fields');
            return;
        }

        if (shortageData?.hasShortage && !useAiForMissing && !createDraftWithMissing) {
            toast.error('Please select how to handle the missing questions');
            return;
        }

        setIsGenerating(true);

        try {
            const res = await fetch('/api/admin/exams/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    blueprintId: genBlueprintId,
                    title: { en: genTitle, pa: genTitle }, // basic bilingual shape
                    description: genDesc ? { en: genDesc, pa: genDesc } : undefined,
                    duration: genDuration,
                    createdById: user?.id,
                    allowAiGenerationForMissing: shortageData?.hasShortage ? useAiForMissing : false,
                    allowMissingQuestions: shortageData?.hasShortage ? createDraftWithMissing : false
                })
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Exam generated successfully!');
                setShowGenerateModal(false);
                setGenBlueprintId('');
                setGenTitle('');
                setGenDesc('');
                loadExams();
            } else {
                toast.error(data.error || 'Generation failed');
            }
        } catch (e) {
            toast.error('Error generating exam');
        } finally {
            setIsGenerating(false);
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

    // Filter Logic
    const filteredExams = exams.filter(exam =>
        getText(exam.title, language).toLowerCase().includes(search.toLowerCase())
    );

    // Pagination Logic
    const totalPages = Math.ceil(filteredExams.length / itemsPerPage);
    const paginatedExams = filteredExams.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

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
                    <div className="flex gap-3">
                        <button
                            onClick={handleOpenGenerate}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                        >
                            <Wand2 className="w-4 h-4" />
                            Auto-Generate
                        </button>
                        <Link
                            href="/admin/exams/import"
                            className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition shadow-sm"
                        >
                            <BookOpen className="w-4 h-4" />
                            Import PDF
                        </Link>
                        <Link
                            href="/admin/exams/create"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            <Plus className="w-4 h-4" />
                            Create Exam
                        </Link>
                    </div>
                </div>
            </header>

            {/* Search & Filters */}
            <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="relative">
                    <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        placeholder="Search exams by title..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                {filteredExams.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center">
                        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">
                            {search ? 'No exams found matching your search.' : 'No exams created yet.'}
                        </p>
                        {!search && (
                            <Link
                                href="/admin/exams/create"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                <Plus className="w-4 h-4" />
                                Create First Exam
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4">
                            {paginatedExams.map((exam) => (
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
                                                {exam.type && (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                                        {exam.type.replace('_', ' ')}
                                                    </span>
                                                )}
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
                                                href={`/admin/exams/${exam.id}/view`}
                                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                                                title="View Exam"
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
                                        <div className="flex flex-col gap-0.5">
                                            <span>Created: {formatDateTimeIST(exam.created_at)}</span>
                                            {exam.updated_at && (
                                                <span>Updated: {formatDateTimeIST(exam.updated_at)}</span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Link
                                                href={`/admin/exams/${exam.id}/assign`}
                                                className="text-blue-600 hover:underline"
                                            >
                                                Assign Students
                                            </Link>
                                            <span className="text-gray-300">|</span>
                                            <Link
                                                href={`/admin/exams/${exam.id}/monitor`}
                                                className="text-green-600 hover:underline"
                                            >
                                                Live Monitor
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="mt-6 flex items-center justify-between border-t pt-4">
                                <div className="text-sm text-gray-500">
                                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredExams.length)}</span> of <span className="font-medium">{filteredExams.length}</span> exams
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm font-medium px-2">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Delete Confirmation Modal (Now using ConfirmModal) */}
            <ConfirmModal
                isOpen={!!deleteConfirm}
                title="Delete Exam"
                message="This will permanently delete the exam, all sections, questions, and student attempts. This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
                onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
                onCancel={() => setDeleteConfirm(null)}
            />

            {/* Generate Exam Modal */}
            {showGenerateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-lg w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Auto-Generate Exam</h3>
                            <button onClick={() => setShowGenerateModal(false)} className="text-gray-500 hover:bg-gray-100 p-2 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Blueprint *</label>
                                <select
                                    value={genBlueprintId}
                                    onChange={e => setGenBlueprintId(e.target.value)}
                                    className="w-full border rounded-lg p-2 bg-white"
                                >
                                    <option value="">-- Select --</option>
                                    {blueprints.map(bp => (
                                        <option key={bp.id} value={bp.id}>{bp.name}</option>
                                    ))}
                                </select>
                                {genBlueprintId && (() => {
                                    const selectedBp = blueprints.find(bp => bp.id === genBlueprintId);
                                    if (!selectedBp) return null;
                                    let q = 0;
                                    let m = 0;
                                    selectedBp.sections?.forEach((s: any) => {
                                        s.rules?.forEach((r: any) => {
                                            q += Number(r.numberOfQuestions);
                                            m += Number(r.numberOfQuestions) * Number(r.marksPerQuestion);
                                        });
                                    });
                                    return (
                                        <div className="mt-2 text-sm text-gray-600 bg-blue-50 p-2 rounded border border-blue-100 flex gap-4">
                                            <span><strong>{selectedBp.sections?.length || 0}</strong> Sections</span>
                                            <span><strong>{q}</strong> Questions</span>
                                            <span><strong>{m}</strong> Total Marks</span>
                                        </div>
                                    );
                                })()}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Title *</label>
                                <input
                                    type="text"
                                    value={genTitle}
                                    onChange={e => setGenTitle(e.target.value)}
                                    className="w-full border rounded-lg p-2"
                                    placeholder="e.g. Generated Weekly Test"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={genDesc}
                                    onChange={e => setGenDesc(e.target.value)}
                                    className="w-full border rounded-lg p-2"
                                    rows={2}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (mins) *</label>
                                <input
                                    type="number"
                                    value={genDuration}
                                    onChange={e => setGenDuration(e.target.value)}
                                    className="w-full border rounded-lg p-2"
                                    min="1"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                disabled={isGenerating}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => submitGeneration()}
                                disabled={isGenerating}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isGenerating ? 'Generating...' : <><Wand2 className="w-4 h-4" /> Generate</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
