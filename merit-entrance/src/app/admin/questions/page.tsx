'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Plus, Search, Filter, MoreVertical, Edit, Trash2, Eye,
    ChevronLeft, ChevronRight, BookOpen, AlertCircle, CheckCircle, X, Files, Loader2, CheckSquare, ArrowRight
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
    created_at?: string;
    updated_at?: string;
}

const AddToExamModal = ({
    isOpen,
    onClose,
    selectedIds,
    onSuccess
}: {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: Set<string>;
    onSuccess: () => void
}) => {
    const { language } = useAuthStore();
    const [exams, setExams] = useState<{ id: string, title: any }[]>([]);
    const [sections, setSections] = useState<{ id: string, name: any }[]>([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [selectedSectionId, setSelectedSectionId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [marks, setMarks] = useState<number>(1);
    const [negativeMarks, setNegativeMarks] = useState<number>(0);

    // New Exam / Section State
    const [newExamTitle, setNewExamTitle] = useState('');
    const [newExamDuration, setNewExamDuration] = useState<number>(60);
    const [newExamTotalMarks, setNewExamTotalMarks] = useState<number>(100);
    const [newSectionName, setNewSectionName] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const fetchExams = async () => {
            try {
                const res = await fetch('/api/admin/exams');
                const data = await res.json();
                if (data.success) setExams(data.exams);
            } catch (error) { console.error('Failed to load exams', error); }
        };
        fetchExams();
    }, [isOpen]);

    useEffect(() => {
        if (!selectedExamId || selectedExamId === 'new') {
            setSections([]);
            if (selectedExamId === 'new') setSelectedSectionId('new');
            else setSelectedSectionId('');
            return;
        }
        const fetchSections = async () => {
            try {
                const res = await fetch(`/api/admin/exams/${selectedExamId}/sections`);
                const data = await res.json();
                if (data.success) setSections(data.sections);
            } catch (error) { console.error('Failed to load sections', error); }
        };
        fetchSections();
    }, [selectedExamId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedExamId || !selectedSectionId || selectedIds.size === 0) return;

        setIsSaving(true);
        try {
            let finalExamId = selectedExamId;
            let finalSectionId = selectedSectionId;

            // 1. Create New Exam if needed
            if (selectedExamId === 'new') {
                const examRes = await fetch('/api/admin/exams', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: { en: newExamTitle, pa: newExamTitle },
                        duration: newExamDuration,
                        totalMarks: newExamTotalMarks,
                        passingMarks: Math.floor(newExamTotalMarks * 0.33),
                        negativeMarking: 0,
                        shuffleQuestions: false,
                        securityMode: false
                    })
                });
                const examData = await examRes.json();
                if (!examData.success) throw new Error(examData.error || 'Failed to create exam');
                finalExamId = examData.examId;
            }

            // 2. Create New Section if needed
            if (selectedSectionId === 'new') {
                const secRes = await fetch(`/api/admin/exams/${finalExamId}/sections`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: { en: newSectionName, pa: newSectionName },
                        order: sections.length + 1,
                        duration: null
                    })
                });
                const secData = await secRes.json();
                if (!secData.success) throw new Error(secData.error || 'Failed to create section');
                finalSectionId = secData.sectionId;
            }

            // 3. Link Questions
            const res = await fetch(`/api/admin/exams/${finalExamId}/sections/${finalSectionId}/questions/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionIds: Array.from(selectedIds),
                    marks: marks,
                    negativeMarks: negativeMarks || null
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(data.message || `Linked ${selectedIds.size} questions successfully.`);

                // Clear state
                setSelectedExamId('');
                setSelectedSectionId('');
                setNewExamTitle('');
                setNewSectionName('');

                onSuccess();
                onClose();
            } else {
                toast.error(data.error || 'Failed to link questions');
            }
        } catch (error: any) {
            console.error('Error linking questions:', error);
            toast.error(error.message || 'An error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Add ${selectedIds.size} Questions to Exam`}>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm mb-4">
                    You are extending an existing exam with these questions. They will be shared across any exams they are already a part of.
                </div>

                <div className="space-y-4 pt-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Target Exam *</label>
                        <select
                            required
                            value={selectedExamId}
                            onChange={(e) => setSelectedExamId(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">-- Choose Exam --</option>
                            <option value="new" className="font-semibold text-blue-600">+ Create New Exam</option>
                            {exams.map(ex => (
                                <option key={ex.id} value={ex.id}>{getText(ex.title, language)}</option>
                            ))}
                        </select>
                    </div>

                    {selectedExamId === 'new' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-3 rounded-lg border">
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Exam Title *</label>
                                <input
                                    type="text"
                                    required
                                    value={newExamTitle}
                                    onChange={(e) => setNewExamTitle(e.target.value)}
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g. Midterm 2024"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (mins) *</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={newExamDuration}
                                    onChange={(e) => setNewExamDuration(parseInt(e.target.value) || 60)}
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks *</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={newExamTotalMarks}
                                    onChange={(e) => setNewExamTotalMarks(parseInt(e.target.value) || 100)}
                                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {selectedExamId && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select Section *</label>
                            <select
                                required
                                value={selectedSectionId}
                                disabled={selectedExamId === 'new'}
                                onChange={(e) => setSelectedSectionId(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-100"
                            >
                                <option value="">-- Choose Section --</option>
                                <option value="new" className="font-semibold text-blue-600">+ Create New Section</option>
                                {sections.map(sec => (
                                    <option key={sec.id} value={sec.id}>{getText(sec.name, language)}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {selectedSectionId === 'new' && (
                        <div className="bg-gray-50 p-3 rounded-lg border">
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Section Name *</label>
                            <input
                                type="text"
                                required
                                value={newSectionName}
                                onChange={(e) => setNewSectionName(e.target.value)}
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. Mathematics"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Marks Override</label>
                            <input
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={marks}
                                onChange={(e) => setMarks(parseFloat(e.target.value))}
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Negative Marks</label>
                            <input
                                type="number"
                                min="0"
                                step="0.25"
                                value={negativeMarks}
                                onChange={(e) => setNegativeMarks(parseFloat(e.target.value) || 0)}
                                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || !selectedSectionId}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</>
                        ) : (
                            <><ArrowRight className="w-4 h-4" /> Add Questions</>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

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
    const [usageFilter, setUsageFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [viewingQuestion, setViewingQuestion] = useState<Question | null>(null);

    // Duplicates State
    const [showDuplicatesModal, setShowDuplicatesModal] = useState(false);
    const [duplicateGroups, setDuplicateGroups] = useState<any[][]>([]);
    const [isFindingDuplicates, setIsFindingDuplicates] = useState(false);
    const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
    const [isDeletingDuplicates, setIsDeletingDuplicates] = useState(false);

    // Bulk Add to Exam State
    const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
    const [showAddToExamModal, setShowAddToExamModal] = useState(false);

    // Global stats from API
    const [globalStats, setGlobalStats] = useState<any>({ totalQuestions: 0, withAnswers: 0, withExplanations: 0, usedInExams: 0, difficultyDistribution: {}, typeDistribution: {} });

    // Available paragraphs for linking
    const [availableParagraphs, setAvailableParagraphs] = useState<{ id: string; textEn: string }[]>([]);

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

    const loadParagraphs = async () => {
        try {
            const res = await fetch('/api/admin/questions?type=paragraph&limit=99999');
            const data = await res.json();
            if (data.success) {
                setAvailableParagraphs(data.questions.map((q: any) => ({
                    id: q.id,
                    textEn: typeof q.text === 'object' ? (q.text as any).en || '' : String(q.text || '')
                })));
            }
        } catch (e) { console.error('Failed to load paragraphs', e); }
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
                tagId: tagFilter,
                usageCount: usageFilter,
                dateFrom,
                dateTo
            });

            const res = await fetch(`/api/admin/questions?${params.toString()}`);
            const data = await res.json();

            if (data.success) {
                setQuestions(data.questions);
                setTotalPages(data.pagination.totalPages);
                setTotalQuestions(data.pagination.total);
                if (data.stats) setGlobalStats(data.stats);
                setSelectedQuestions(new Set());
            } else {
                toast.error(data.error || 'Failed to load questions');
            }
        } catch (error) {
            console.error('Error loading questions:', error);
            toast.error('Failed to load questions');
        } finally {
            setLoading(false);
        }
    }, [page, limit, debouncedSearch, typeFilter, difficultyFilter, tagFilter, usageFilter]);

    useEffect(() => {
        loadTags();
        loadParagraphs();
    }, []);
    useEffect(() => {
        loadQuestions();
    }, [loadQuestions]);


    // Handlers

    const fetchQuestionDetails = async (questionId: string) => {
        const res = await fetch(`/api/admin/questions/${questionId}`);
        const data = await res.json();
        if (!data.success) throw new Error('Failed to fetch details');
        return data.question;
    };

    const handleEdit = async (question: Question) => {
        const toastId = toast.loading('Loading details...');
        try {
            const full = await fetchQuestionDetails(question.id);
            setEditingQuestion(full);
            setShowModal(true);
            toast.dismiss(toastId);
        } catch (e) {
            toast.error('Error fetching question details', { id: toastId });
        }
    };

    const handleView = async (question: Question) => {
        const toastId = toast.loading('Loading details...');
        try {
            const full = await fetchQuestionDetails(question.id);
            setViewingQuestion(full);
            toast.dismiss(toastId);
        } catch (e) {
            toast.error('Error fetching question details', { id: toastId });
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
                paragraph_text: formData.type === 'paragraph' ? { en: formData.paragraphTextEn, pa: formData.paragraphTextPa } : null,
                subQuestions: formData.subQuestions,
                tags: formData.tags,
                parentId: formData.parentId || null
            };

            if (formData.type === 'paragraph') {
                body.paragraphText = { en: formData.paragraphTextEn, pa: formData.paragraphTextPa || formData.paragraphTextEn };
                body.subQuestions = formData.subQuestions?.map(sq => ({
                    id: sq.id,
                    text: { en: sq.textEn, pa: sq.textPa || sq.textEn },
                    type: sq.type,
                    options: sq.type === 'fill_blank' ? [] : sq.options.map(o => ({
                        id: o.id,
                        text: { en: o.textEn, pa: o.textPa || o.textEn },
                        image_url: o.imageUrl
                    })),
                    correctAnswer: sq.type === 'fill_blank'
                        ? (sq.fillBlankAnswers || '').split(',').map((s: string) => s.trim()).filter(Boolean)
                        : sq.correctAnswer,
                    explanation: sq.explanationEn ? { en: sq.explanationEn, pa: sq.explanationPa } : null,
                    marks: sq.marks,
                    negativeMarks: sq.negativeMarks,
                    difficulty: sq.difficulty,
                    imageUrl: sq.imageUrl || null
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

    const handleFindDuplicates = async () => {
        setIsFindingDuplicates(true);
        setShowDuplicatesModal(true);
        setDuplicateGroups([]);
        setSelectedDuplicates(new Set());
        try {
            const res = await fetch('/api/admin/questions/find-duplicates');
            const data = await res.json();
            if (data.success) {
                setDuplicateGroups(data.groups);
            } else {
                toast.error(data.error || 'Failed to find duplicates');
                setShowDuplicatesModal(false);
            }
        } catch (e) {
            toast.error('Error finding duplicates');
            setShowDuplicatesModal(false);
        } finally {
            setIsFindingDuplicates(false);
        }
    };

    const handleBulkDeleteDuplicates = async () => {
        if (selectedDuplicates.size === 0) return;
        confirm({
            title: 'Delete Duplicate Questions',
            message: `Are you sure you want to delete ${selectedDuplicates.size} selected duplicate questions?`,
            variant: 'danger',
            onConfirm: async () => {
                setIsDeletingDuplicates(true);
                try {
                    const res = await fetch('/api/admin/questions/bulk-delete', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ questionIds: Array.from(selectedDuplicates) })
                    });
                    const data = await res.json();
                    if (data.success) {
                        toast.success(`Deleted ${data.deletedCount} duplicates`);
                        setShowDuplicatesModal(false);
                        loadQuestions();
                    } else {
                        toast.error(data.error || 'Failed to delete');
                    }
                } catch (e) {
                    toast.error('Error deleting duplicates');
                } finally {
                    setIsDeletingDuplicates(false);
                }
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
                difficulty: sq.difficulty,
                imageUrl: sq.image_url || '',
                fillBlankAnswers: sq.type === 'fill_blank' ? (sq.correct_answer?.join(', ') || '') : ''
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
                    <div className="flex gap-3">
                        <button
                            onClick={handleFindDuplicates}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                            <Files className="w-5 h-5" />
                            Find Duplicates
                        </button>
                        <button
                            onClick={handleAddNew}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Add Question
                        </button>
                    </div>
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

                    {globalStats?.maxUsage > 0 && (
                        <select
                            value={usageFilter}
                            onChange={(e) => { setUsageFilter(e.target.value); setPage(1); }}
                            className="col-span-1 md:col-span-4 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-auto mt-2 md:mt-0"
                        >
                            <option value="all">Any Usage</option>
                            <option value="0">Unused (0 Exams)</option>
                            {Array.from({ length: globalStats.maxUsage }, (_, i) => i + 1).map(count => (
                                <option key={count} value={count.toString()}>
                                    Shared in {count} Exam{count !== 1 ? 's' : ''}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Date Filters */}
                    <div className="col-span-1 md:col-span-4 flex items-center gap-2 mt-2 md:mt-0">
                        <label className="text-sm text-gray-600 whitespace-nowrap">From:</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full"
                        />
                        <label className="text-sm text-gray-600 whitespace-nowrap ml-2">To:</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full"
                        />
                        {(dateFrom || dateTo) && (
                            <button
                                onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0 ml-1"
                                title="Clear Dates"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Bulk Actions Bar */}
                {selectedQuestions.size > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between shadow-sm">
                        <span className="text-blue-800 font-medium text-sm flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">
                                {selectedQuestions.size}
                            </span>
                            Questions Selected
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedQuestions(new Set())}
                                className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                            >
                                Clear Selection
                            </button>
                            <button
                                onClick={() => setShowAddToExamModal(true)}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors shadow-sm flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" />
                                Add to Exam
                            </button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-4 py-3 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={questions.length > 0 && selectedQuestions.size === questions.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedQuestions(new Set(questions.map(q => q.id)));
                                                } else {
                                                    setSelectedQuestions(new Set());
                                                }
                                            }}
                                        />
                                    </th>
                                    <th className="px-6 py-3">Question</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Difficulty</th>
                                    <th className="px-6 py-3">Answer</th>
                                    <th className="px-6 py-3">Marks</th>
                                    <th className="px-6 py-3">Explanation</th>
                                    <th className="px-6 py-3">Popularity</th>
                                    <th className="px-6 py-3 text-center">Dates</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                                            <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                                            Loading...
                                        </td>
                                    </tr>
                                ) : questions.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                                            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                            No questions found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    questions.map((question) => (
                                        <tr key={question.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={selectedQuestions.has(question.id)}
                                                    onChange={(e) => {
                                                        const newSet = new Set(selectedQuestions);
                                                        if (e.target.checked) newSet.add(question.id);
                                                        else newSet.delete(question.id);
                                                        setSelectedQuestions(newSet);
                                                    }}
                                                />
                                            </td>
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
                                            <td className="px-6 py-4">
                                                {question.correct_answer && Array.isArray(question.correct_answer) && question.correct_answer.length > 0 ? (
                                                    <span className="text-xs font-mono bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200">
                                                        {question.correct_answer.join(', ')}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {question.marks}
                                            </td>
                                            <td className="px-6 py-4 max-w-[150px]">
                                                {question.explanation && (question.explanation.en || question.explanation.pa) ? (
                                                    <div className="text-xs text-gray-600 line-clamp-2" title={question.explanation.en || question.explanation.pa}>
                                                        <MathText text={getText(question.explanation, language)} inline />
                                                    </div>
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
                                            <td className="px-6 py-4 text-center text-xs text-gray-500 whitespace-nowrap">
                                                {question.created_at && (
                                                    <div className="mb-1" title="Created On">
                                                        <span className="font-semibold text-gray-400 mr-1">C:</span>
                                                        {new Date(question.created_at).toLocaleDateString('en-GB')}
                                                    </div>
                                                )}
                                                {question.updated_at && question.updated_at !== question.created_at && (
                                                    <div title="Last Updated">
                                                        <span className="font-semibold text-gray-400 mr-1">U:</span>
                                                        {new Date(question.updated_at).toLocaleDateString('en-GB')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleView(question)}
                                                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                                                        title="View"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
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
                        availableParagraphs={availableParagraphs.filter(p => p.id !== editingQuestion?.id)}
                    />
                </Modal>

                {/* View Question Modal */}
                <Modal
                    isOpen={!!viewingQuestion}
                    onClose={() => setViewingQuestion(null)}
                    title="Question Preview"
                    maxWidth="3xl"
                >
                    {viewingQuestion && (
                        <div className="space-y-5">
                            {/* Header badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100 font-medium">
                                    {getTypeLabel(viewingQuestion.type)}
                                </span>
                                <span className={`px-2 py-1 text-xs rounded border font-medium ${getDifficultyColor(viewingQuestion.difficulty)}`}>
                                    Level {viewingQuestion.difficulty}
                                </span>
                                <span className="text-sm text-gray-500">+{viewingQuestion.marks} marks</span>
                                {(viewingQuestion.negative_marks ?? 0) > 0 && (
                                    <span className="text-sm text-red-500">-{viewingQuestion.negative_marks}</span>
                                )}
                                {viewingQuestion.tags && viewingQuestion.tags.length > 0 && (
                                    <div className="flex gap-1 ml-2">
                                        {viewingQuestion.tags.map(tag => (
                                            <span key={tag.id} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] border">{tag.name}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Question text */}
                            <div className="text-gray-900 text-base">
                                <MathText text={getText(viewingQuestion.text, language)} />
                            </div>

                            {/* Para content */}
                            {viewingQuestion.type === 'paragraph' && viewingQuestion.paragraph_text && (
                                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs font-bold text-blue-600 mb-2 uppercase">📖 Passage</p>
                                    <div className="text-gray-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: getText(viewingQuestion.paragraph_text, language) }} />
                                </div>
                            )}

                            {/* Image */}
                            {viewingQuestion.image_url && (
                                <div className="relative h-48 w-full bg-gray-50 rounded-lg border overflow-hidden">
                                    <img src={viewingQuestion.image_url} alt="Question" className="w-full h-full object-contain" />
                                </div>
                            )}

                            {/* Options / Fill blank */}
                            {viewingQuestion.type === 'fill_blank' ? (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                    <p className="text-sm text-green-700"><strong>Correct Answer(s):</strong> {viewingQuestion.correct_answer?.join(', ')}</p>
                                </div>
                            ) : viewingQuestion.options && viewingQuestion.options.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-gray-700">Options</p>
                                    {viewingQuestion.options.map((opt: any) => {
                                        const isCorrect = viewingQuestion.correct_answer?.includes(opt.id);
                                        return (
                                            <div key={opt.id} className={`flex items-center gap-3 p-3 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
                                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                                    {opt.id?.toUpperCase()}
                                                </span>
                                                <span className="flex-1 text-gray-800">
                                                    <MathText text={getText(opt.text, language)} inline />
                                                </span>
                                                {opt.image_url && <img src={opt.image_url} alt="" className="h-10 w-auto rounded" />}
                                                {isCorrect && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}

                            {/* Explanation */}
                            {viewingQuestion.explanation && (viewingQuestion.explanation.en || viewingQuestion.explanation.pa) && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs font-semibold text-blue-600 mb-1">Explanation</p>
                                    <div className="text-sm text-blue-800"><MathText text={getText(viewingQuestion.explanation, language)} /></div>
                                </div>
                            )}

                            {/* Sub-questions for paragraph */}
                            {viewingQuestion.type === 'paragraph' && viewingQuestion.subQuestions && viewingQuestion.subQuestions.length > 0 && (
                                <div className="space-y-4 border-t pt-4">
                                    <p className="text-sm font-semibold text-gray-700">Sub-Questions ({viewingQuestion.subQuestions.length})</p>
                                    {viewingQuestion.subQuestions.map((sq: any, sqIdx: number) => (
                                        <div key={sq.id || sqIdx} className="bg-gray-50 p-4 rounded-lg border space-y-3">
                                            <div className="flex items-center gap-2">
                                                <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">{sqIdx + 1}</span>
                                                <span className="px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-700 border border-blue-100">{getTypeLabel(sq.type)}</span>
                                                <span className={`px-2 py-0.5 text-xs rounded border ${getDifficultyColor(sq.difficulty)}`}>Level {sq.difficulty}</span>
                                                <span className="text-xs text-gray-500">+{sq.marks} marks</span>
                                            </div>
                                            <div className="text-gray-900"><MathText text={getText(sq.text, language)} /></div>
                                            {sq.options && sq.options.map((opt: any) => {
                                                const isC = sq.correct_answer?.includes(opt.id);
                                                return (
                                                    <div key={opt.id} className={`flex items-center gap-2 p-2 rounded border ${isC ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
                                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${isC ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{opt.id?.toUpperCase()}</span>
                                                        <div className="flex-1">
                                                            <span className="text-sm"><MathText text={getText(opt.text, language)} inline /></span>
                                                            {(opt.image_url || opt.imageUrl) && <img src={opt.image_url || opt.imageUrl} alt="" className="mt-1 h-10 w-auto rounded border" />}
                                                        </div>
                                                        {isC && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                                                    </div>
                                                );
                                            })}
                                            {sq.explanation && (sq.explanation.en || sq.explanation.pa) && (
                                                <div className="p-2 bg-blue-50 rounded text-xs text-blue-800">
                                                    <span className="font-semibold">Explanation:</span> <MathText text={getText(sq.explanation, language)} inline />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-end pt-4 border-t">
                                <button onClick={() => { setViewingQuestion(null); handleEdit(viewingQuestion); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                                    <Edit className="w-4 h-4" /> Edit Question
                                </button>
                            </div>
                        </div>
                    )}
                </Modal>

                {/* Duplicates Modal */}
                <Modal
                    isOpen={showDuplicatesModal}
                    onClose={() => !isDeletingDuplicates && setShowDuplicatesModal(false)}
                    title="Potential Duplicate Questions"
                    maxWidth="4xl"
                >
                    <div className="p-6">
                        {isFindingDuplicates ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                                <p>Scanning database for fuzzy duplicates...</p>
                            </div>
                        ) : duplicateGroups.length === 0 ? (
                            <div className="text-center py-12">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                <h3 className="text-lg font-medium text-gray-900">No Duplicates Found</h3>
                                <p className="text-gray-500 mt-1">Your question bank looks clean based on our similarity checks.</p>
                                <button onClick={() => setShowDuplicatesModal(false)} className="mt-6 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex gap-3 text-sm">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold">Review Carefully</p>
                                        <p>These questions have over 85% textual similarity. Select the redundant copies you wish to delete.</p>
                                    </div>
                                </div>

                                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                                    {duplicateGroups.map((group, groupIndex) => (
                                        <div key={groupIndex} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                                            <div className="bg-gray-50 border-b px-4 py-3 flex justify-between items-center">
                                                <h4 className="font-medium text-gray-800">Match Group {groupIndex + 1} ({group.length} items)</h4>
                                                <button
                                                    onClick={() => {
                                                        const newSet = new Set(selectedDuplicates);
                                                        // select all except first
                                                        for (let i = 1; i < group.length; i++) {
                                                            newSet.add(group[i].id);
                                                        }
                                                        setSelectedDuplicates(newSet);
                                                    }}
                                                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                >
                                                    <CheckSquare className="w-4 h-4" /> Keep First & Select Rest
                                                </button>
                                            </div>
                                            <div className="divide-y">
                                                {group.map((q, idx) => (
                                                    <div key={q.id} className="p-4 flex gap-4 hover:bg-gray-50">
                                                        <div className="flex-shrink-0 pt-1">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                checked={selectedDuplicates.has(q.id)}
                                                                onChange={(e) => {
                                                                    const newSet = new Set(selectedDuplicates);
                                                                    if (e.target.checked) newSet.add(q.id);
                                                                    else newSet.delete(q.id);
                                                                    setSelectedDuplicates(newSet);
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs px-2 py-0.5 rounded border bg-blue-50 text-blue-700">{getTypeLabel(q.type)}</span>
                                                                <span className="text-xs text-gray-500 font-mono">{q.id.split('-')[0]}...</span>
                                                            </div>
                                                            <div className="text-sm text-gray-800 line-clamp-3">
                                                                <MathText text={getText(q.text, language)} inline />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="border-t pt-4 flex justify-between items-center">
                                    <div className="text-sm font-medium text-gray-700">
                                        {selectedDuplicates.size} questions selected for deletion
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowDuplicatesModal(false)}
                                            disabled={isDeletingDuplicates}
                                            className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleBulkDeleteDuplicates}
                                            disabled={isDeletingDuplicates || selectedDuplicates.size === 0}
                                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isDeletingDuplicates ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            Delete Selected
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>

                <DialogComponent />

                {/* Add to Exam Modal */}
                <AddToExamModal
                    isOpen={showAddToExamModal}
                    onClose={() => setShowAddToExamModal(false)}
                    selectedIds={selectedQuestions}
                    onSuccess={() => {
                        setSelectedQuestions(new Set());
                        loadQuestions();
                    }}
                />
            </div>
        </MathJaxProvider>
    );
}
