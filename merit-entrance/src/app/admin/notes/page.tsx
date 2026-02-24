'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { formatDateTimeIST } from '@/lib/utils';
import { FileText, Plus, Search, Edit2, Trash2, ChevronLeft, ChevronRight, X, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { MathJaxProvider } from '@/components/providers/MathJaxProvider';
import { MathText } from '@/components/MathText';
import RichTextEditor from '@/components/RichTextEditor';

interface AdminNote {
    id: string;
    title: string;
    content: Record<string, string>;
    author_id: string;
    author_name: string;
    created_at: string;
    updated_at: string;
}

export default function AdminNotesPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();

    const [notes, setNotes] = useState<AdminNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalNotes, setTotalNotes] = useState(0);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<AdminNote | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        contentEn: '',
        contentPa: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/admin/login');
            return;
        }
        fetchNotes();
    }, [_hasHydrated, isAuthenticated, user, router, page, limit]);

    // Update debounce for search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (page === 1) {
                fetchNotes();
            } else {
                setPage(1); // Changing page will automatically trigger fetch
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/notes?page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();

            if (data.success) {
                setNotes(data.notes);
                setTotalPages(data.pagination.totalPages);
                setTotalNotes(data.pagination.total);
            } else {
                toast.error(data.error || 'Failed to fetch notes');
            }
        } catch (error) {
            console.error('Error fetching notes:', error);
            toast.error('Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (note?: AdminNote, isPreview: boolean = false) => {
        if (note) {
            setEditingNote(note);
            setFormData({
                title: note.title,
                contentEn: note.content?.en || '',
                contentPa: note.content?.pa || ''
            });
            if (isPreview) {
                setIsPreviewModalOpen(true);
            } else {
                setIsModalOpen(true);
            }
        } else {
            setEditingNote(null);
            setFormData({ title: '', contentEn: '', contentPa: '' });
            setIsModalOpen(true);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setIsPreviewModalOpen(false);
        setEditingNote(null);
        setFormData({ title: '', contentEn: '', contentPa: '' });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.contentEn.trim()) {
            toast.error('Title and English content are required');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                title: formData.title,
                content: {
                    en: formData.contentEn,
                    pa: formData.contentPa || formData.contentEn
                }
            };

            const url = editingNote
                ? `/api/admin/notes/${editingNote.id}`
                : '/api/admin/notes';

            const method = editingNote ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                toast.success(editingNote ? 'Note updated successfully' : 'Note created successfully');
                handleCloseModal();
                fetchNotes();
            } else {
                toast.error(data.error || 'Failed to save note');
            }
        } catch (error) {
            console.error('Error saving note:', error);
            toast.error('An error occurred while saving');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/notes/${id}`, { method: 'DELETE' });
            const data = await res.json();

            if (data.success) {
                toast.success('Note deleted successfully');
                if (notes.length === 1 && page > 1) {
                    setPage(page - 1);
                } else {
                    fetchNotes();
                }
            } else {
                toast.error(data.error || 'Failed to delete note');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            toast.error('An error occurred while deleting');
        }
    };

    if (!_hasHydrated) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
    }

    return (
        <MathJaxProvider>
            <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Admin Notes</h1>
                                <p className="text-sm text-gray-500">Manage internal notes, formulas, and references</p>
                            </div>
                        </div>
                        <button
                            onClick={() => handleOpenModal()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm shadow-blue-200 flex items-center gap-2 justify-center"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Create Note</span>
                        </button>
                    </div>

                    {/* Filters & Table Wrapper */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">

                        {/* Filters Bar */}
                        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between bg-gray-50/50">
                            <div className="relative w-full sm:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search notes..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all text-sm"
                                />
                            </div>

                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <label className="text-sm text-gray-600 whitespace-nowrap">Show:</label>
                                <select
                                    value={limit}
                                    onChange={(e) => {
                                        setLimit(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none cursor-pointer bg-white"
                                >
                                    <option value={10}>10 items</option>
                                    <option value={20}>20 items</option>
                                    <option value={50}>50 items</option>
                                    <option value={100}>100 items</option>
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-gray-50/50 text-gray-600 border-b border-gray-100">
                                        <th className="px-6 py-4 font-semibold">Title</th>
                                        <th className="px-6 py-4 font-semibold text-center w-32">Preview</th>
                                        <th className="px-6 py-4 font-semibold">Author</th>
                                        <th className="px-6 py-4 font-semibold">Date</th>
                                        <th className="px-6 py-4 font-semibold text-right w-32">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100/70">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                                    Loading notes...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : notes.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                {searchQuery ? 'No notes matched your search.' : 'No notes found. Create your first note above.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        notes.map((note) => (
                                            <tr key={note.id} className="hover:bg-gray-50/80 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-gray-900 line-clamp-2">
                                                        <MathText text={note.title} inline />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => handleOpenModal(note, true)}
                                                        className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md hover:bg-blue-100 transition whitespace-nowrap"
                                                    >
                                                        View Content
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                                                    {note.author_name}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                                    {formatDateTimeIST(note.created_at)}
                                                </td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleOpenModal(note, true)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                            title="View Note"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenModal(note, false)}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                            title="Edit Note"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(note.id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                            title="Delete Note"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        {!loading && notes.length > 0 && (
                            <div className="border-t border-gray-100 p-4 bg-gray-50/30 flex items-center justify-between text-sm text-gray-600">
                                <div>
                                    Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(page * limit, totalNotes)}</span> of <span className="font-medium">{totalNotes}</span> records
                                </div>
                                <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    <span className="px-3 py-1 font-medium text-blue-600 bg-blue-50 rounded-md">
                                        Page {page} of {totalPages}
                                    </span>

                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages || totalPages === 0}
                                        className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Note Editor Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm sm:p-6">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 sm:p-6">
                            <h2 className="text-xl font-bold tracking-tight text-gray-900">
                                {editingNote ? 'Edit Note' : 'Create Note'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50/50">
                            <form id="note-form" onSubmit={handleSave} className="space-y-6">

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-gray-700">Note Title <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm"
                                        placeholder="E.g., Formula set for Thermodynamics"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-semibold text-gray-700">Content (English) <span className="text-red-500">*</span></label>
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Markdown & MathJax ($$) supported</span>
                                    </div>
                                    <div className="bg-white border text-sm border-gray-200 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all overflow-hidden">
                                        <RichTextEditor
                                            value={formData.contentEn}
                                            onChange={(val: string) => setFormData(prev => ({ ...prev, contentEn: val }))}
                                            placeholder="Write your note here..."
                                        />
                                    </div>
                                    {formData.contentEn && (
                                        <div className="mt-4 p-4 border border-blue-100 bg-blue-50/30 rounded-xl space-y-2">
                                            <p className="text-xs font-semibold text-blue-800 uppercase tracking-widest">Live Math Preview</p>
                                            <div className="text-gray-900 prose prose-sm max-w-none">
                                                <MathText text={formData.contentEn} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-gray-700">Content (Punjabi) <span className="text-gray-400 font-normal">(Optional)</span></label>
                                    <div className="bg-white border text-sm border-gray-200 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all overflow-hidden">
                                        <RichTextEditor
                                            value={formData.contentPa}
                                            onChange={(val: string) => setFormData(prev => ({ ...prev, contentPa: val }))}
                                            placeholder="Punjabi translation..."
                                        />
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-100 sm:p-6 bg-white flex justify-end gap-3 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                disabled={isSaving}
                                className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="note-form"
                                disabled={isSaving}
                                className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm shadow-blue-200 disabled:opacity-70 flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Note'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Note Preview Modal */}
            {isPreviewModalOpen && editingNote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm sm:p-6">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                        {/* Preview Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 sm:p-6 bg-gray-50/50">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-gray-900">
                                    <MathText text={editingNote.title} inline />
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Written by {editingNote.author_name} • {formatDateTimeIST(editingNote.created_at)}
                                </p>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition self-start"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Preview Content */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white space-y-8">
                            {/* English Content */}
                            {editingNote.content?.en && (
                                <div className="space-y-3">
                                    <div className="text-gray-900 prose prose-blue prose-sm sm:prose-base max-w-none break-words overflow-x-auto">
                                        <MathText text={editingNote.content.en} className="whitespace-pre-wrap break-words" />
                                    </div>
                                </div>
                            )}

                            {/* Punjabi Content */}
                            {editingNote.content?.pa && editingNote.content.pa !== editingNote.content.en && (
                                <div className="space-y-3 pt-6 border-t border-gray-100">
                                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Punjabi Translation</h3>
                                    <div className="text-gray-900 prose prose-blue prose-sm sm:prose-base max-w-none break-words overflow-x-auto">
                                        <MathText text={editingNote.content.pa} className="whitespace-pre-wrap break-words" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Preview Footer */}
                        <div className="p-4 border-t border-gray-100 sm:p-6 bg-gray-50/50 flex justify-end gap-3 rounded-b-2xl">
                            <button
                                onClick={handleCloseModal}
                                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm rounded-xl transition"
                            >
                                Close Preview
                            </button>
                            <button
                                onClick={() => {
                                    setIsPreviewModalOpen(false);
                                    setIsModalOpen(true);
                                }}
                                className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm shadow-blue-200 flex items-center gap-2"
                            >
                                <Edit2 className="w-4 h-4" />
                                Edit Note
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MathJaxProvider>
    );
}
