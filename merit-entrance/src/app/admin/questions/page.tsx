'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye,
    ChevronLeft, ChevronRight, BookOpen, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import { MathText } from '@/components/MathText';
import { MathJaxProvider } from '@/components/providers/MathJaxProvider';
import Modal from '@/components/ui/Modal';
import QuestionEditor, { QuestionFormData } from '@/components/admin/QuestionEditor';
import QuestionStats from '@/components/admin/QuestionStats';
import { useConfirmDialog } from '@/components/ConfirmDialog';

interface Question {
    id: string;
    type: string;
    text: Record<string, string>;
    difficulty: number;
    marks: number;
    tags: { id: string; name: string }[];
    section?: {
        name: Record<string, string>;
        exam?: {
            title: Record<string, string>;
        };
    };
    // Additional fields for editing (mapped later)
    options?: any[];
    correct_answer?: any;
    explanation?: any;
    negative_marks?: number;
    image_url?: string;
    parent_id?: string;
    paragraph_text?: Record<string, string>;
    paragraph_id?: string;
    paragraph?: {
        content: Record<string, string>;
        image_url?: string;
    };
    subQuestions?: any[];
    usage_count?: number;
}

export default function QuestionsBankPage() {
    const router = useRouter();
    const { language } = useAuthStore();
    const { confirm, DialogComponent } = useConfirmDialog();

    const [questions, setQuestions] = useState<Question[]>([]);
    const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalQuestions, setTotalQuestions] = useState(0);

    // Filters
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [difficultyFilter, setDifficultyFilter] = useState('all');
    const [tagFilter, setTagFilter] = useState('');

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Global stats from API
    const [globalStats, setGlobalStats] = useState<any>({ totalQuestions: 0, withAnswers: 0, withExplanations: 0, usedInExams: 0, difficultyDistribution: {}, typeDistribution: {} });

    // Debounce search
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const loadTags = async () => {
        try {
            const res = await fetch('/api/admin/tags');
            const data = await res.json();
            if (data.success) setTags(data.tags);
        } catch (e) { console.error('Failed to load tags', e); }
    };

    const loadQuestions = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit === 0 ? '99999' : limit.toString(),
                search: debouncedSearch,
                type: typeFilter,
                difficulty: difficultyFilter,
                tagId: tagFilter
            });

            const res = await fetch(`/api/admin/questions?${params.toString()}`);
            const data = await res.json();

            if (data.success) {
                setQuestions(data.questions);
                setTotalPages(data.pagination.totalPages);
                setTotalQuestions(data.pagination.total);
                if (data.stats) setGlobalStats(data.stats);
            } else {
                toast.error(data.error || 'Failed to load questions');
            }
        } catch (error) {
            console.error('Error loading questions:', error);
            toast.error('Failed to load questions');
        } finally {
            setLoading(false);
        }
    }, [page, limit, debouncedSearch, typeFilter, difficultyFilter, tagFilter]);

    useEffect(() => {
        loadTags();
    }, []);

    useEffect(() => {
        loadQuestions();
    }, [loadQuestions]);


    // Handlers

    const handleEdit = async (question: Question) => {
        // We need full details including sub-questions if paragraph.
        // The list API might not return sub-questions for performance.
        // Let's fetch the single question details to be safe.
        try {
            const res = await fetch(`/api/admin/questions/${question.id}`);
            const data = await res.json();
            if (data.success) {
                setEditingQuestion(data.question);
                setShowModal(true);
            } else {
                toast.error('Failed to fetch details');
            }
        } catch (e) {
            toast.error('Error fetching question details');
        }
    };

    const handleAddNew = () => {
        setEditingQuestion(null);
        setShowModal(true);
    };

    const handleSave = async (formData: QuestionFormData) => {
        setIsSaving(true);
        try {
            const isEdit = !!editingQuestion;
            const url = isEdit ? `/api/admin/questions/${editingQuestion.id}` : '/api/admin/questions';
            const method = isEdit ? 'PUT' : 'POST';

            // Construct body
            const body: any = {
                type: formData.type,
                text: { en: formData.textEn, pa: formData.textPa || formData.textEn },
                explanation: formData.explanationEn ? { en: formData.explanationEn, pa: formData.explanationPa } : null,
                marks: formData.type === 'paragraph' ? 0 : formData.marks,
                negativeMarks: formData.type === 'paragraph' ? 0 : formData.negativeMarks,
                difficulty: formData.difficulty,
                imageUrl: formData.imageUrl,
                tags: formData.tags,
                parentId: formData.parentId || null
            };

            if (formData.type === 'paragraph') {
                body.paragraphText = { en: formData.paragraphTextEn, pa: formData.paragraphTextPa || formData.paragraphTextEn };
                body.subQuestions = formData.subQuestions?.map(sq => ({
                    id: sq.id,
                    text: { en: sq.textEn, pa: sq.textPa || sq.textEn },
                    type: sq.type,
                    options: sq.options.map(o => ({
                        id: o.id,
                        text: { en: o.textEn, pa: o.textPa || o.textEn },
                        image_url: o.imageUrl
                    })),
                    correctAnswer: sq.correctAnswer,
                    explanation: sq.explanationEn ? { en: sq.explanationEn, pa: sq.explanationPa } : null,
                    marks: sq.marks,
                    negativeMarks: sq.negativeMarks,
                    difficulty: sq.difficulty
                }));
            } else if (formData.type === 'fill_blank') {
                body.correctAnswer = formData.fillBlankAnswers.split(',').map(s => s.trim()).filter(Boolean);
            } else {
                body.options = formData.options.map(o => ({
                    id: o.id,
                    text: { en: o.textEn, pa: o.textPa || o.textEn },
                    image_url: o.imageUrl
                }));
                body.correctAnswer = formData.correctAnswer;
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const resData = await res.json();

            if (resData.success) {
                toast.success(isEdit ? 'Question updated' : 'Question created');
                setShowModal(false);
                setEditingQuestion(null);
                loadQuestions();
            } else {
                toast.error(resData.error || 'Failed to save');
            }

        } catch (error) {
            console.error(error);
            toast.error('Error saving question');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        confirm({
            title: 'Delete Question',
            message: 'Are you sure you want to delete this question? This action cannot be undone.',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (data.success) {
                        toast.success('Question deleted');
                        loadQuestions();
                    } else {
                        toast.error(data.error || 'Failed to delete');
                    }
                } catch (e) { toast.error('Error deleting'); }
            }
        });
    };

    // Helper to map Question to FormData
    const getInitialFormData = (q: Question | null): QuestionFormData | undefined => {
        if (!q) return undefined;
        // Map fields
        // Note: For paragraph type, `q` fetched from detail API should have `subQuestions`
        // and `paragraph_text` or `paragraph` object.

        // Handle paragraph text vs text
        // If type is paragraph, the "Question Text" field usually holds title, and paragraph_text holds content.

        return {
            id: q.id,
            textEn: q.text?.en || '',
            textPa: q.text?.pa || '',
            type: q.type,
            options: q.options?.map((o: any) => ({
                id: o.id,
                textEn: o.text?.en || '',
                textPa: o.text?.pa || '',
                imageUrl: o.image_url
            })) || [],
            correctAnswer: q.correct_answer || [],
            explanationEn: q.explanation?.en || '',
            explanationPa: q.explanation?.pa || '',
            marks: q.marks,
            difficulty: q.difficulty,
            negativeMarks: q.negative_marks || 0,
            fillBlankAnswers: q.type === 'fill_blank' ? (q.correct_answer?.join(', ') || '') : '',
            imageUrl: q.image_url || '',
            // If API returns paragraph_text in q directly:
            paragraphTextEn: q.paragraph_text?.en || q.paragraph?.content?.en || '',
            paragraphTextPa: q.paragraph_text?.pa || q.paragraph?.content?.pa || '',
            parentId: q.parent_id || '',
            tags: q.tags?.map(t => t.id) || [],
            subQuestions: q.subQuestions?.map((sq: any) => ({
                id: sq.id,
                textEn: sq.text?.en || '',
                textPa: sq.text?.pa || '',
                type: sq.type,
                options: sq.options?.map((o: any) => ({
                    id: o.id,
                    textEn: o.text?.en || '',
                    textPa: o.text?.pa || '',
                    imageUrl: o.image_url
                })) || [],
                correctAnswer: sq.correct_answer || [],
                explanationEn: sq.explanation?.en || '',
                explanationPa: sq.explanation?.pa || '',
                marks: sq.marks,
                negativeMarks: sq.negative_marks || 0,
                difficulty: sq.difficulty
            }))
        };
    };


    const getDifficultyColor = (diff: number) => {
        if (diff <= 2) return 'bg-green-100 text-green-700';
        if (diff === 3) return 'bg-yellow-100 text-yellow-700';
        return 'bg-red-100 text-red-700';
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'mcq_single': return 'Single Choice';
            case 'mcq_multiple': return 'Multiple Choice';
            case 'fill_blank': return 'Fill Blank';
            case 'paragraph': return 'Paragraph';
            default: return type;
        }
    };

    return (
        <MathJaxProvider>
            <div className="p-6 max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
                        <p className="text-gray-500">Manage all questions in one place</p>
                    </div>
                    <button
                        onClick={handleAddNew}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        Add Question
                    </button>
                </div>

                {/* Summary Scorecard */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
                        <p className="text-3xl font-bold text-blue-600">{globalStats.totalQuestions}</p>
                        <p className="text-xs text-gray-500 uppercase mt-1">Total Questions</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
                        <p className="text-3xl font-bold text-purple-600">{tags.length}</p>
                        <p className="text-xs text-gray-500 uppercase mt-1">Total Tags</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
                        <p className="text-3xl font-bold text-green-600">{globalStats.withAnswers}</p>
                        <p className="text-xs text-gray-500 uppercase mt-1">With Answers</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
                        <p className="text-3xl font-bold text-amber-600">{globalStats.withExplanations}</p>
                        <p className="text-xs text-gray-500 uppercase mt-1">With Explanations</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border text-center">
                        <p className="text-3xl font-bold text-rose-600">{globalStats.usedInExams}</p>
                        <p className="text-xs text-gray-500 uppercase mt-1">Used in Exams</p>
                    </div>
                </div>

                {/* Stats */}
                <QuestionStats questions={questions} stats={globalStats} />

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl shadow-sm border mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative col-span-1 md:col-span-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search questions..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                    </div>

                    <select
                        value={typeFilter}
                        onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                        className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="all">All Types</option>
                        <option value="mcq_single">Single Choice</option>
                        <option value="mcq_multiple">Multiple Choice</option>
                        <option value="fill_blank">Fill in Blank</option>
                        <option value="paragraph">Paragraph</option>
                    </select>

                    <select
                        value={difficultyFilter}
                        onChange={(e) => { setDifficultyFilter(e.target.value); setPage(1); }}
                        className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="all">All Difficulties</option>
                        <option value="1">Level 1 (Easy)</option>
                        <option value="2">Level 2</option>
                        <option value="3">Level 3 (Medium)</option>
                        <option value="4">Level 4</option>
                        <option value="5">Level 5 (Hard)</option>
                    </select>

                    <select
                        value={tagFilter}
                        onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
                        className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">All Tags</option>
                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-6 py-3">Question</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Difficulty</th>
                                    <th className="px-6 py-3">Answer</th>
                                    <th className="px-6 py-3">Explanation</th>
                                    <th className="px-6 py-3">Marks</th>
                                    <th className="px-6 py-3">Popularity</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                            <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                                            Loading...
                                        </td>
                                    </tr>
                                ) : questions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                            No questions found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    questions.map((question) => (
                                        <tr key={question.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 max-w-md">
                                                <div className="font-medium text-gray-900 line-clamp-2 max-h-16 overflow-hidden">
                                                    <MathText text={getText(question.text, language)} inline />
                                                </div>
                                                {question.tags.length > 0 && (
                                                    <div className="flex gap-1 mt-1 flex-wrap">
                                                        {question.tags.map(tag => (
                                                            <span key={tag.id} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border">
                                                                {tag.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100 font-medium">
                                                    {getTypeLabel(question.type)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs rounded border font-medium ${getDifficultyColor(question.difficulty)}`}>
                                                    Level {question.difficulty}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {question.marks}
                                            </td>
                                            <td className="px-6 py-4">
                                                {question.correct_answer && Array.isArray(question.correct_answer) && question.correct_answer.length > 0 ? (
                                                    <span className="text-xs font-mono bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200">
                                                        {question.correct_answer.join(', ')}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 max-w-[150px]">
                                                {question.explanation && (question.explanation.en || question.explanation.pa) ? (
                                                    <span className="text-xs text-gray-600 line-clamp-2" title={question.explanation.en || question.explanation.pa}>
                                                        {getText(question.explanation, language) || '—'}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {(question.usage_count || 0) > 0 ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-200 font-medium">
                                                        {question.usage_count} {(question.usage_count || 0) === 1 ? 'exam' : 'exams'}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">Unused</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEdit(question)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                        title="Edit"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(question.id)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                        title="Delete"
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

                    {/* Pagination */}
                    <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600">
                                Showing <span className="font-medium">{questions.length}</span> of <span className="font-medium">{totalQuestions}</span> questions
                            </span>
                            <select
                                value={limit}
                                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                                className="px-2 py-1 border rounded text-sm text-gray-700"
                            >
                                <option value={10}>10 / page</option>
                                <option value={50}>50 / page</option>
                                <option value={100}>100 / page</option>
                                <option value={500}>500 / page</option>
                                <option value={1000}>1000 / page</option>
                                <option value={0}>All</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 border rounded hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 border rounded hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Modal Editor */}
                <Modal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    title={editingQuestion ? 'Edit Question' : 'Add Question'}
                    maxWidth="4xl"
                >
                    <QuestionEditor
                        initialData={getInitialFormData(editingQuestion)}
                        tags={tags}
                        onSave={handleSave}
                        onCancel={() => setShowModal(false)}
                        isSaving={isSaving}
                    />
                </Modal>

                <DialogComponent />
            </div>
        </MathJaxProvider>
    );
}
