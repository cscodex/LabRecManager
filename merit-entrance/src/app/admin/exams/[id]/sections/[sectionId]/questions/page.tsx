'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import {
    ChevronLeft, Plus, Save, Trash2, Globe,
    CheckCircle, Edit2, X, ChevronUp, ChevronDown,
    Image as ImageIcon, Upload, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirmDialog } from '@/components/ConfirmDialog';

interface Option {
    id: string;
    text: Record<string, string>;
    image_url?: string;
}

interface Question {
    id: string;
    type: string;
    text: Record<string, string>;
    options: Option[] | null;
    correct_answer: string[];
    explanation: Record<string, string> | null;
    marks: number;
    negative_marks: number | null;
    order: number;
    image_url?: string;
    parent_id?: string | null;
    paragraph_text?: Record<string, string> | null;
}

interface Section {
    id: string;
    name: Record<string, string>;
}

interface FormOption {
    id: string;
    textEn: string;
    textPa: string;
    imageUrl?: string;
}

export default function ManageQuestionsPage() {
    const params = useParams();
    const examId = params.id as string;
    const sectionId = params.sectionId as string;
    const { language, setLanguage } = useAuthStore();
    const { confirm, DialogComponent } = useConfirmDialog();

    const [section, setSection] = useState<Section | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());
    const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());

    const createEmptyQuestion = () => ({
        textEn: '',
        textPa: '',
        type: 'mcq_single',
        options: [
            { id: 'a', textEn: '', textPa: '' },
            { id: 'b', textEn: '', textPa: '' },
        ] as FormOption[],
        correctAnswer: [] as string[],
        explanationEn: '',
        explanationPa: '',
        marks: 1,
        negativeMarks: 0,
        fillBlankAnswers: '', // Comma-separated for multiple blanks
        imageUrl: '',
        paragraphTextEn: '', // For paragraph type
        paragraphTextPa: '', // For paragraph type
        parentId: '', // For sub-questions linked to paragraphs
    });

    const [formData, setFormData] = useState(createEmptyQuestion());
    const [uploading, setUploading] = useState(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const sectionsRes = await fetch(`/api/admin/exams/${examId}/sections`);
            const sectionsData = await sectionsRes.json();
            const sec = sectionsData.sections?.find((s: Section) => s.id === sectionId);
            setSection(sec);

            const questionsRes = await fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions`);
            const questionsData = await questionsRes.json();
            if (questionsData.success) {
                setQuestions(questionsData.questions);
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    // Update local state optimistically
    const updateQuestionsOptimistically = (updatedQuestions: Question[]) => {
        setQuestions(updatedQuestions);
    };

    const handleAddQuestion = async () => {
        // For paragraph type, question text is optional (only paragraphText is required)
        if (formData.type !== 'paragraph' && !formData.textEn) {
            toast.error('Question text is required');
            return;
        }

        if (formData.type === 'paragraph' && !formData.paragraphTextEn) {
            toast.error('Paragraph text is required');
            return;
        }

        if (formData.type === 'fill_blank' && !formData.fillBlankAnswers) {
            toast.error('Correct answer(s) required for fill-in-the-blank');
            return;
        }

        if ((formData.type === 'mcq_single' || formData.type === 'mcq_multiple') && formData.correctAnswer.length === 0) {
            toast.error('Please select correct answer(s)');
            return;
        }

        const newOrder = questions.length + 1;
        const body: any = {
            type: formData.type,
            text: { en: formData.textEn || 'Paragraph', pa: formData.textPa || formData.textEn || 'ਪੈਰਾ' },
            explanation: formData.explanationEn
                ? { en: formData.explanationEn, pa: formData.explanationPa || formData.explanationEn }
                : null,
            marks: formData.type === 'paragraph' ? 0 : formData.marks,
            negativeMarks: formData.type === 'paragraph' ? 0 : (formData.negativeMarks || null),
            order: newOrder,
            imageUrl: formData.imageUrl || null,
        };

        // Add paragraphText for paragraph type
        if (formData.type === 'paragraph') {
            body.paragraphText = {
                en: formData.paragraphTextEn,
                pa: formData.paragraphTextPa || formData.paragraphTextEn
            };
            body.options = null;
            body.correctAnswer = [];
        } else if (formData.type === 'fill_blank') {
            body.options = null;
            // Support multiple answers separated by comma
            body.correctAnswer = formData.fillBlankAnswers.split(',').map(a => a.trim()).filter(Boolean);
            if (formData.parentId) body.parentId = formData.parentId;
        } else {
            body.options = formData.options.map(o => ({
                id: o.id,
                text: { en: o.textEn, pa: o.textPa || o.textEn },
                image_url: o.imageUrl || null,
            }));
            body.correctAnswer = formData.correctAnswer;
            if (formData.parentId) body.parentId = formData.parentId;
        }

        try {
            const response = await fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                toast.success('Question added!');
                setFormData(createEmptyQuestion());
                setShowAddForm(false);
                loadData();
            }
        } catch (error) {
            toast.error('Failed to add question');
        }
    };

    const handleUpdateQuestion = async () => {
        // For paragraph type, question text is optional (only paragraphText is required)
        if (!editingQuestionId) return;

        if (formData.type !== 'paragraph' && !formData.textEn) {
            toast.error('Question text is required');
            return;
        }

        if (formData.type === 'paragraph' && !formData.paragraphTextEn) {
            toast.error('Paragraph text is required');
            return;
        }

        const currentQuestion = questions.find(q => q.id === editingQuestionId);
        if (!currentQuestion) return;

        const body: any = {
            type: formData.type,
            text: { en: formData.textEn || 'Paragraph', pa: formData.textPa || formData.textEn || 'ਪੈਰਾ' },
            explanation: formData.explanationEn
                ? { en: formData.explanationEn, pa: formData.explanationPa || formData.explanationEn }
                : null,
            marks: formData.type === 'paragraph' ? 0 : formData.marks,
            negativeMarks: formData.type === 'paragraph' ? 0 : (formData.negativeMarks || null),
            order: currentQuestion.order,
            imageUrl: formData.imageUrl || null,
        };

        // Add paragraphText for paragraph type
        if (formData.type === 'paragraph') {
            body.paragraphText = {
                en: formData.paragraphTextEn,
                pa: formData.paragraphTextPa || formData.paragraphTextEn
            };
            body.options = null;
            body.correctAnswer = [];
        } else if (formData.type === 'fill_blank') {
            body.options = null;
            body.correctAnswer = formData.fillBlankAnswers.split(',').map(a => a.trim()).filter(Boolean);
            body.parentId = formData.parentId || null;
        } else {
            body.options = formData.options.map(o => ({
                id: o.id,
                text: { en: o.textEn, pa: o.textPa || o.textEn },
                image_url: o.imageUrl || null,
            }));
            body.correctAnswer = formData.correctAnswer;
            body.parentId = formData.parentId || null;
        }

        // Optimistic update
        const updatedQuestion: Question = {
            ...currentQuestion,
            type: body.type,
            text: body.text,
            options: body.options,
            correct_answer: body.correctAnswer,
            explanation: body.explanation,
            marks: body.marks,
            negative_marks: body.negativeMarks,
            image_url: body.imageUrl,
        };
        updateQuestionsOptimistically(questions.map(q => q.id === editingQuestionId ? updatedQuestion : q));

        try {
            const response = await fetch(
                `/api/admin/exams/${examId}/sections/${sectionId}/questions/${editingQuestionId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );

            if (response.ok) {
                toast.success('Question updated!');
                setEditingQuestionId(null);
                setFormData(createEmptyQuestion());
            } else {
                loadData(); // Revert on error
                toast.error('Failed to update question');
            }
        } catch (error) {
            loadData();
            toast.error('Failed to update question');
        }
    };

    const handleDeleteQuestion = (questionId: string) => {
        confirm({
            title: 'Delete Question',
            message: 'Are you sure you want to delete this question? This action cannot be undone.',
            variant: 'danger',
            confirmText: 'Delete',
            onConfirm: async () => {
                // Optimistic delete
                updateQuestionsOptimistically(questions.filter(q => q.id !== questionId));

                try {
                    const response = await fetch(
                        `/api/admin/exams/${examId}/sections/${sectionId}/questions/${questionId}`,
                        { method: 'DELETE' }
                    );
                    if (response.ok) {
                        toast.success('Question deleted');
                    } else {
                        loadData();
                        toast.error('Failed to delete question');
                    }
                } catch (error) {
                    loadData();
                    toast.error('Failed to delete question');
                }
            },
        });
    };

    const handleBulkDelete = async () => {
        if (selectedQuestions.size === 0) return;

        confirm({
            title: `Delete ${selectedQuestions.size} Questions`,
            message: `Are you sure you want to delete ${selectedQuestions.size} selected questions? This action cannot be undone.`,
            variant: 'danger',
            confirmText: 'Delete All',
            onConfirm: async () => {
                const idsToDelete = Array.from(selectedQuestions);
                // Optimistic delete
                updateQuestionsOptimistically(questions.filter(q => !selectedQuestions.has(q.id)));
                setSelectedQuestions(new Set());

                try {
                    const response = await fetch(
                        `/api/admin/exams/${examId}/sections/${sectionId}/questions/bulk-delete`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ questionIds: idsToDelete }),
                        }
                    );

                    if (response.ok) {
                        toast.success(`Deleted ${idsToDelete.length} questions!`);
                    } else {
                        loadData();
                        toast.error('Failed to delete some questions');
                    }
                } catch (error) {
                    loadData();
                    toast.error('Failed to delete questions');
                }
            },
        });
    };

    const toggleQuestionSelect = (questionId: string) => {
        setSelectedQuestions(prev => {
            const next = new Set(prev);
            if (next.has(questionId)) {
                next.delete(questionId);
            } else {
                next.add(questionId);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedQuestions.size === questions.length) {
            setSelectedQuestions(new Set());
        } else {
            setSelectedQuestions(new Set(questions.map(q => q.id)));
        }
    };

    const startEditQuestion = (question: Question) => {
        setEditingQuestionId(question.id);
        setShowAddForm(false);

        const options: FormOption[] = question.options?.map(o => ({
            id: o.id,
            textEn: o.text.en || '',
            textPa: o.text.pa || '',
            imageUrl: o.image_url || '',
        })) || [{ id: 'a', textEn: '', textPa: '' }];

        setFormData({
            textEn: question.text.en || '',
            textPa: question.text.pa || '',
            type: question.type,
            options,
            correctAnswer: question.correct_answer || [],
            explanationEn: question.explanation?.en || '',
            explanationPa: question.explanation?.pa || '',
            marks: question.marks,
            negativeMarks: question.negative_marks || 0,
            fillBlankAnswers: question.type === 'fill_blank' ? (question.correct_answer?.join(', ') || '') : '',
            imageUrl: question.image_url || '',
            paragraphTextEn: question.paragraph_text?.en || '',
            paragraphTextPa: question.paragraph_text?.pa || '',
            parentId: question.parent_id || '',
        });
    };

    const cancelEdit = () => {
        setEditingQuestionId(null);
        setFormData(createEmptyQuestion());
    };

    const toggleCorrectAnswer = (optionId: string) => {
        if (formData.type === 'mcq_single') {
            setFormData({ ...formData, correctAnswer: [optionId] });
        } else {
            const current = formData.correctAnswer;
            if (current.includes(optionId)) {
                setFormData({ ...formData, correctAnswer: current.filter(id => id !== optionId) });
            } else {
                setFormData({ ...formData, correctAnswer: [...current, optionId] });
            }
        }
    };

    const addOption = () => {
        const nextId = String.fromCharCode(97 + formData.options.length);
        setFormData({
            ...formData,
            options: [...formData.options, { id: nextId, textEn: '', textPa: '' }],
        });
    };

    const removeOption = (optionId: string) => {
        if (formData.options.length <= 1) {
            toast.error('At least one option is required');
            return;
        }
        // Re-index options after removal
        const filtered = formData.options.filter(o => o.id !== optionId);
        const reIndexed = filtered.map((opt, i) => ({
            ...opt,
            id: String.fromCharCode(97 + i),
        }));

        // Update correct answers
        const idMap: Record<string, string> = {};
        filtered.forEach((opt, i) => {
            idMap[opt.id] = String.fromCharCode(97 + i);
        });

        setFormData({
            ...formData,
            options: reIndexed,
            correctAnswer: formData.correctAnswer
                .filter(id => id !== optionId)
                .map(id => idMap[id] || id),
        });
    };

    const moveOption = (index: number, direction: 'up' | 'down') => {
        const newOptions = [...formData.options];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= newOptions.length) return;

        [newOptions[index], newOptions[swapIndex]] = [newOptions[swapIndex], newOptions[index]];
        const reIndexed = newOptions.map((opt, i) => ({ ...opt, id: String.fromCharCode(97 + i) }));

        const idMap: Record<string, string> = {};
        formData.options.forEach((opt, i) => {
            const newIdx = newOptions.findIndex(o => o === formData.options[i]);
            idMap[opt.id] = String.fromCharCode(97 + newIdx);
        });

        setFormData({
            ...formData,
            options: reIndexed,
            correctAnswer: formData.correctAnswer.map(id => idMap[id] || id),
        });
    };

    const handleMoveQuestion = async (questionId: string, direction: 'up' | 'down') => {
        const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
        const index = sortedQuestions.findIndex(q => q.id === questionId);

        if ((direction === 'up' && index === 0) || (direction === 'down' && index === sortedQuestions.length - 1)) {
            return;
        }

        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        const currentQ = { ...sortedQuestions[index] };
        const swapQ = { ...sortedQuestions[swapIndex] };

        // Swap orders
        const tempOrder = currentQ.order;
        currentQ.order = swapQ.order;
        swapQ.order = tempOrder;

        // Optimistic update
        const updated = sortedQuestions.map((q, i) => {
            if (i === index) return currentQ;
            if (i === swapIndex) return swapQ;
            return q;
        });
        updateQuestionsOptimistically(updated);

        try {
            await Promise.all([
                fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions/${currentQ.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order: currentQ.order }),
                }),
                fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions/${swapQ.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order: swapQ.order }),
                }),
            ]);
            toast.success('Reordered');
        } catch (error) {
            loadData();
            toast.error('Failed to reorder');
        }
    };

    const toggleExplanation = (questionId: string) => {
        const newSet = new Set(expandedExplanations);
        if (newSet.has(questionId)) {
            newSet.delete(questionId);
        } else {
            newSet.add(questionId);
        }
        setExpandedExplanations(newSet);
    };

    // Image upload handler
    const handleImageUpload = async (file: File, type: 'question' | 'option', optionIndex?: number) => {
        setUploading(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            formDataUpload.append('folder', 'merit-entrance/questions');

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formDataUpload,
            });

            const data = await response.json();

            if (data.success) {
                if (type === 'question') {
                    setFormData({ ...formData, imageUrl: data.url });
                } else if (type === 'option' && optionIndex !== undefined) {
                    const newOptions = [...formData.options];
                    newOptions[optionIndex].imageUrl = data.url;
                    setFormData({ ...formData, options: newOptions });
                }
                toast.success('Image uploaded!');
            } else {
                toast.error(data.details || data.error || 'Upload failed');
                console.error('Upload failed:', data);
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Upload failed - check console for details');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);

    // Question Form Component (inline)
    const renderQuestionForm = (isEdit: boolean = false) => (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                    {isEdit ? 'Edit Question' : 'Add New Question'}
                </h3>
                <button onClick={() => isEdit ? cancelEdit() : setShowAddForm(false)} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Question Type */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value, correctAnswer: [] })}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                        <option value="mcq_single">MCQ - Single</option>
                        <option value="mcq_multiple">MCQ - Multiple</option>
                        <option value="fill_blank">Fill in the Blank</option>
                        <option value="paragraph">📄 Paragraph (Passage)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                    <input
                        type="number"
                        value={formData.marks}
                        onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border rounded-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Negative</label>
                    <input
                        type="number"
                        value={formData.negativeMarks}
                        onChange={(e) => setFormData({ ...formData, negativeMarks: parseFloat(e.target.value) || 0 })}
                        step={0.25}
                        className="w-full px-3 py-2 border rounded-lg"
                    />
                </div>
            </div>

            {/* Question Text */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question (English) *</label>
                    <textarea
                        value={formData.textEn}
                        onChange={(e) => setFormData({ ...formData, textEn: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder={formData.type === 'fill_blank' ? "Use _____ for blanks" : "Enter question..."}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question (Punjabi)</label>
                    <textarea
                        value={formData.textPa}
                        onChange={(e) => setFormData({ ...formData, textPa: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg"
                    />
                </div>
            </div>

            {/* Question Image */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question Image</label>
                <div className="flex items-center gap-3">
                    {formData.imageUrl && (
                        <img src={formData.imageUrl} alt="Question" className="h-16 w-auto rounded border" />
                    )}
                    <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <Upload className="w-4 h-4" />
                        <span className="text-sm">{uploading ? 'Uploading...' : 'Upload'}</span>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'question')}
                            disabled={uploading}
                        />
                    </label>
                    {formData.imageUrl && (
                        <button
                            onClick={() => setFormData({ ...formData, imageUrl: '' })}
                            className="text-red-500 text-sm hover:underline"
                        >
                            Remove
                        </button>
                    )}
                </div>
            </div>

            {/* Paragraph Text - only for paragraph type */}
            {formData.type === 'paragraph' && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <label className="block text-sm font-medium text-blue-700 mb-2">
                        📄 Passage / Comprehension Content
                    </label>
                    <p className="text-xs text-blue-600 mb-3">
                        The &quot;Question Text&quot; above will be used as the passage title. Enter the full passage content below.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Passage Content (English) *</label>
                            <textarea
                                value={formData.paragraphTextEn}
                                onChange={(e) => setFormData({ ...formData, paragraphTextEn: e.target.value })}
                                rows={8}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="Enter the full passage content in English..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Passage Content (Punjabi)</label>
                            <textarea
                                value={formData.paragraphTextPa}
                                onChange={(e) => setFormData({ ...formData, paragraphTextPa: e.target.value })}
                                rows={8}
                                className="w-full px-3 py-2 border rounded-lg"
                                placeholder="ਪੈਰਾ ਸਮੱਗਰੀ ਪੰਜਾਬੀ ਵਿੱਚ ਦਰਜ ਕਰੋ..."
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Parent Paragraph Selector - for non-paragraph questions */}
            {formData.type !== 'paragraph' && questions.filter(q => q.type === 'paragraph').length > 0 && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <label className="block text-sm font-medium text-purple-700 mb-2">
                        🔗 Link to Paragraph (Optional)
                    </label>
                    <select
                        value={formData.parentId || ''}
                        onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                        <option value="">-- Standalone Question (No Parent) --</option>
                        {questions.filter(q => q.type === 'paragraph').map((para, idx) => (
                            <option key={para.id} value={para.id}>
                                📄 {idx + 1}. {getText(para.text, language).substring(0, 60)}...
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-purple-600 mt-1">
                        If linked, this question will appear as a sub-question under the selected paragraph in the exam.
                    </p>
                </div>
            )}

            {/* Fill in the Blank Answers / MCQ Options - hidden for paragraph type */}
            {formData.type !== 'paragraph' && (formData.type === 'fill_blank' ? (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Correct Answer(s) * <span className="font-normal text-gray-500">(comma-separated for multiple blanks)</span>
                    </label>
                    <input
                        type="text"
                        value={formData.fillBlankAnswers}
                        onChange={(e) => setFormData({ ...formData, fillBlankAnswers: e.target.value })}
                        placeholder="Answer 1, Answer 2, Answer 3"
                        className="w-full px-3 py-2 border rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Use _____ in question for each blank. Answers should be in order.
                    </p>
                </div>
            ) : (
                /* MCQ Options */
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">Options</label>
                        <button type="button" onClick={addOption} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </div>
                    <div className="space-y-2">
                        {formData.options.map((opt, idx) => (
                            <div key={idx} className="flex items-start gap-2 bg-white p-2 rounded-lg border">
                                <div className="flex flex-col gap-0.5 pt-2">
                                    <button type="button" onClick={() => moveOption(idx, 'up')} disabled={idx === 0} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                                        <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button type="button" onClick={() => moveOption(idx, 'down')} disabled={idx === formData.options.length - 1} className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleCorrectAnswer(opt.id)}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1.5 ${formData.correctAnswer.includes(opt.id) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                                        }`}
                                >
                                    {opt.id.toUpperCase()}
                                </button>
                                <div className="flex-1 space-y-1">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={opt.textEn}
                                            onChange={(e) => {
                                                const newOptions = [...formData.options];
                                                newOptions[idx].textEn = e.target.value;
                                                setFormData({ ...formData, options: newOptions });
                                            }}
                                            placeholder={`Option ${opt.id.toUpperCase()} (EN)`}
                                            className="flex-1 px-2 py-1.5 border rounded text-sm"
                                        />
                                        <input
                                            type="text"
                                            value={opt.textPa}
                                            onChange={(e) => {
                                                const newOptions = [...formData.options];
                                                newOptions[idx].textPa = e.target.value;
                                                setFormData({ ...formData, options: newOptions });
                                            }}
                                            placeholder={`ਵਿਕਲਪ ${opt.id.toUpperCase()} (PA)`}
                                            className="flex-1 px-2 py-1.5 border rounded text-sm"
                                        />
                                    </div>
                                    {/* Option image */}
                                    <div className="flex items-center gap-2">
                                        {opt.imageUrl && <img src={opt.imageUrl} alt="" className="h-8 w-auto rounded" />}
                                        <label className="text-xs text-blue-600 cursor-pointer hover:underline flex items-center gap-1">
                                            <ImageIcon className="w-3 h-3" />
                                            {opt.imageUrl ? 'Change' : 'Add image'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'option', idx)}
                                            />
                                        </label>
                                        {opt.imageUrl && (
                                            <button
                                                onClick={() => {
                                                    const newOptions = [...formData.options];
                                                    newOptions[idx].imageUrl = '';
                                                    setFormData({ ...formData, options: newOptions });
                                                }}
                                                className="text-xs text-red-500 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <button type="button" onClick={() => removeOption(opt.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded mt-1">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Explanation - hidden for paragraph type */}
            {formData.type !== 'paragraph' && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (EN)</label>
                        <textarea
                            value={formData.explanationEn}
                            onChange={(e) => setFormData({ ...formData, explanationEn: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (PA)</label>
                        <textarea
                            value={formData.explanationPa}
                            onChange={(e) => setFormData({ ...formData, explanationPa: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t">
                <button onClick={() => isEdit ? cancelEdit() : setShowAddForm(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
                    Cancel
                </button>
                <button
                    onClick={isEdit ? handleUpdateQuestion : handleAddQuestion}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <Save className="w-4 h-4" />
                    {isEdit ? 'Save Changes' : 'Add Question'}
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <DialogComponent />
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href={`/admin/exams/${examId}`} className="text-gray-500 hover:text-gray-700">
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    {section ? getText(section.name, language) : 'Section'} - Questions
                                </h1>
                                <p className="text-sm text-gray-500">{questions.length} questions</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setLanguage(language === 'en' ? 'pa' : 'en')}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                        >
                            <Globe className="w-4 h-4" />
                            {language === 'en' ? 'EN' : 'ਪੰ'}
                        </button>
                    </div>
                    {/* Bulk Actions Bar */}
                    {selectedQuestions.size > 0 && (
                        <div className="mt-3 flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                            <span className="text-sm text-blue-700">
                                {selectedQuestions.size} question{selectedQuestions.size > 1 ? 's' : ''} selected
                            </span>
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Selected
                            </button>
                            <button
                                onClick={() => setSelectedQuestions(new Set())}
                                className="px-3 py-1.5 text-sm border rounded-lg hover:bg-white"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
                {/* Select All */}
                {questions.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 rounded-lg">
                        <input
                            type="checkbox"
                            checked={selectedQuestions.size === questions.length && questions.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                        />
                        <span className="text-sm text-gray-700">
                            {selectedQuestions.size === questions.length ? 'Deselect All' : 'Select All'} ({questions.length} questions)
                        </span>
                    </div>
                )}
                {/* Questions List with inline edit forms */}
                {sortedQuestions.map((q, index) => (
                    <div key={q.id}>
                        {/* Question Card */}
                        <div className={`bg-white rounded-xl shadow-sm p-4 ${editingQuestionId === q.id ? 'ring-2 ring-blue-500 mb-2' : ''}`}>
                            <div className="flex items-start gap-3">
                                {/* Checkbox for selection */}
                                <input
                                    type="checkbox"
                                    checked={selectedQuestions.has(q.id)}
                                    onChange={() => toggleQuestionSelect(q.id)}
                                    className="mt-3 w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                                />
                                {/* Reorder controls */}
                                <div className="flex flex-col items-center gap-0.5">
                                    <button
                                        onClick={() => handleMoveQuestion(q.id, 'up')}
                                        disabled={index === 0}
                                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                                    >
                                        <ChevronUp className="w-4 h-4" />
                                    </button>
                                    <span className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                                        {index + 1}
                                    </span>
                                    <button
                                        onClick={() => handleMoveQuestion(q.id, 'down')}
                                        disabled={index === sortedQuestions.length - 1}
                                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                                    >
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Question content */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-gray-900 font-medium mb-2">{getText(q.text, language)}</p>

                                    {/* Paragraph text for paragraph type */}
                                    {q.type === 'paragraph' && q.paragraph_text && (
                                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg mb-2">
                                            <p className="text-xs text-blue-600 font-medium mb-1">📄 Passage Content:</p>
                                            <p className="text-gray-700 text-sm whitespace-pre-wrap">
                                                {getText(q.paragraph_text, language)}
                                            </p>
                                        </div>
                                    )}

                                    {/* Question image */}
                                    {q.image_url && (
                                        <img src={q.image_url} alt="" className="max-h-32 rounded border mb-2" />
                                    )}

                                    {q.type === 'paragraph' ? (
                                        <div className="bg-gray-100 p-2 rounded text-sm text-gray-600">
                                            📝 Sub-questions can be linked to this paragraph via CSV import
                                        </div>
                                    ) : q.type === 'fill_blank' ? (
                                        <div className="bg-green-50 border border-green-200 p-2 rounded inline-block">
                                            <span className="text-sm text-green-700">
                                                Answer(s): <strong>{q.correct_answer?.join(', ')}</strong>
                                            </span>
                                        </div>
                                    ) : q.options && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {q.options.map(opt => (
                                                <div
                                                    key={opt.id}
                                                    className={`flex items-center gap-2 p-2 rounded ${q.correct_answer?.includes(opt.id) ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                                                        }`}
                                                >
                                                    <span className="font-medium text-gray-500">{opt.id.toUpperCase()}.</span>
                                                    {opt.image_url && <img src={opt.image_url} alt="" className="h-6 w-auto rounded" />}
                                                    <span className="text-gray-700">{getText(opt.text, language)}</span>
                                                    {q.correct_answer?.includes(opt.id) && (
                                                        <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Meta info */}
                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                        <span>Marks: {q.marks}</span>
                                        {q.negative_marks !== null && q.negative_marks > 0 && <span>-ve: {q.negative_marks}</span>}
                                        <span className="capitalize px-2 py-0.5 bg-gray-100 rounded">{q.type.replace('_', ' ')}</span>
                                    </div>

                                    {/* Explanation toggle */}
                                    {q.explanation && (q.explanation.en || q.explanation.pa) && (
                                        <div className="mt-2">
                                            <button
                                                onClick={() => toggleExplanation(q.id)}
                                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                                            >
                                                <ChevronRight className={`w-3 h-3 transition-transform ${expandedExplanations.has(q.id) ? 'rotate-90' : ''}`} />
                                                Show Explanation
                                            </button>
                                            {expandedExplanations.has(q.id) && (
                                                <p className="mt-1 text-sm text-gray-600 italic pl-4 border-l-2 border-gray-200 whitespace-pre-wrap">
                                                    {getText(q.explanation, language)}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => startEditQuestion(q)}
                                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteQuestion(q.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Edit form appears right below the question */}
                        {editingQuestionId === q.id && renderQuestionForm(true)}
                    </div>
                ))}

                {/* Add Question Form (at bottom) */}
                {showAddForm ? (
                    renderQuestionForm(false)
                ) : !editingQuestionId && (
                    <button
                        onClick={() => {
                            setFormData(createEmptyQuestion());
                            setShowAddForm(true);
                        }}
                        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Add Question
                    </button>
                )}
            </main>
        </div>
    );
}
