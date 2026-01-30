'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import {
    ChevronLeft, Plus, Save, Trash2, Globe,
    CheckCircle, Edit2, X, ChevronUp, ChevronDown,
    Image as ImageIcon, Upload, ChevronRight, Hash, FileText,
    Check, AlertCircle
} from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useConfirmDialog } from '@/components/ConfirmDialog';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';

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
    difficulty: number;
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

    // New state for question type selection
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [isParaMode, setIsParaMode] = useState(false);
    const [editingParagraphId, setEditingParagraphId] = useState<string | null>(null);

    // Sub-questions for paragraph mode
    type SubQuestionForm = {
        id?: string;
        textEn: string;
        textPa: string;
        type: 'mcq_single' | 'mcq_multiple';
        options: FormOption[];
        correctAnswer: string[];
        explanationEn: string;
        explanationPa: string;
        marks: number;
        negativeMarks: number;
        difficulty: number;
    };
    const [paraSubQuestions, setParaSubQuestions] = useState<SubQuestionForm[]>([]);

    const toggleSubQuestionCorrectAnswer = (qIndex: number, optionId: string) => {
        const sq = paraSubQuestions[qIndex];
        let newCorrect: string[];
        if (sq.type === 'mcq_single') {
            newCorrect = [optionId];
        } else {
            newCorrect = sq.correctAnswer.includes(optionId)
                ? sq.correctAnswer.filter(id => id !== optionId)
                : [...sq.correctAnswer, optionId];
        }
        updateParaSubQuestion(qIndex, { correctAnswer: newCorrect });
    };

    const updateSubQuestionOption = (qIndex: number, oIndex: number, updates: Partial<FormOption>) => {
        const newSubQuestions = [...paraSubQuestions];
        const newOptions = [...newSubQuestions[qIndex].options];
        newOptions[oIndex] = { ...newOptions[oIndex], ...updates };
        newSubQuestions[qIndex].options = newOptions;
        setParaSubQuestions(newSubQuestions);
    };

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
        difficulty: 1,
        negativeMarks: 0,
        fillBlankAnswers: '', // Comma-separated for multiple blanks
        imageUrl: '',
        paragraphTextEn: '', // For paragraph type
        paragraphTextPa: '', // For paragraph type
        parentId: '', // For sub-questions linked to paragraphs
    });

    const [formData, setFormData] = useState(createEmptyQuestion());
    const [uploading, setUploading] = useState(false);

    const loadData = useCallback(async () => {
        try {
            // Load questions
            const qRes = await fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions`);
            const qData = await qRes.json();
            if (qData.success) {
                setQuestions(qData.questions);
            }

            // Load section details
            const sRes = await fetch(`/api/admin/exams/${examId}`);
            const sData = await sRes.json();
            if (sData.success) {
                const section = sData.exam.sections.find((s: any) => s.id === sectionId);
                if (section) {
                    setSection(section);
                }
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [examId, sectionId]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        loadData();
    }, [loadData]);




    const updateQuestionsOptimistically = (updatedQuestions: Question[]) => {
        setQuestions(updatedQuestions);
    };

    const addParaSubQuestion = () => {
        setParaSubQuestions([...paraSubQuestions, {
            textEn: '',
            textPa: '',
            type: 'mcq_single',
            options: [
                { id: 'a', textEn: '', textPa: '' },
                { id: 'b', textEn: '', textPa: '' },
                { id: 'c', textEn: '', textPa: '' },
                { id: 'd', textEn: '', textPa: '' },
            ],
            correctAnswer: [],
            explanationEn: '',
            explanationPa: '',
            marks: 2,
            negativeMarks: 0.5,
            difficulty: 1,
        }]);
    };

    const removeParaSubQuestion = (index: number) => {
        if (paraSubQuestions.length <= 1) {
            toast.error('At least one sub-question is required');
            return;
        }
        setParaSubQuestions(paraSubQuestions.filter((_, i) => i !== index));
    };

    const updateParaSubQuestion = (index: number, updates: Partial<SubQuestionForm>) => {
        const newSubQuestions = [...paraSubQuestions];
        newSubQuestions[index] = { ...newSubQuestions[index], ...updates };
        setParaSubQuestions(newSubQuestions);
    };

    const handleBatchSaveParagraph = async () => {
        if (!formData.paragraphTextEn) {
            toast.error('Paragraph content is required');
            return;
        }

        if (paraSubQuestions.length === 0) {
            toast.error('Please add at least one question');
            return;
        }

        // Validate sub-questions
        for (let i = 0; i < paraSubQuestions.length; i++) {
            const sq = paraSubQuestions[i];
            if (!sq.textEn) {
                toast.error(`Question ${i + 1} text is required`);
                return;
            }
            if (sq.correctAnswer.length === 0) {
                toast.error(`Please select correct answer for question ${i + 1}`);
                return;
            }
        }

        // Check for duplicate paragraph content (strip HTML for comparison)
        const stripHtml = (html: string) => html?.replace(/<[^>]*>/g, '').trim().toLowerCase() || '';
        const duplicateParagraph = questions.find(q =>
            q.type === 'paragraph' &&
            q.id !== editingParagraphId &&
            stripHtml(q.paragraph_text?.en || '') === stripHtml(formData.paragraphTextEn || '')
        );
        if (duplicateParagraph) {
            toast.error('A paragraph with the same content already exists!');
            return;
        }

        // Check for duplicate sub-questions
        for (let i = 0; i < paraSubQuestions.length; i++) {
            const sq = paraSubQuestions[i];
            const duplicateQ = questions.find(q =>
                q.id !== sq.id &&
                q.text?.en?.trim().toLowerCase() === sq.textEn?.trim().toLowerCase()
            );
            if (duplicateQ) {
                toast.error(`Question ${i + 1} "${sq.textEn.substring(0, 50)}..." already exists!`);
                return;
            }
        }

        const body = {
            paragraph: {
                text: { en: formData.textEn || 'Paragraph', pa: formData.textPa || formData.textEn || 'ਪੈਰਾ' },
                paragraphText: {
                    en: formData.paragraphTextEn,
                    pa: formData.paragraphTextPa || formData.paragraphTextEn
                },
                imageUrl: formData.imageUrl || null,
            },
            subQuestions: paraSubQuestions.map(sq => ({
                text: { en: sq.textEn, pa: sq.textPa || sq.textEn },
                type: sq.type,
                options: sq.options.map(o => ({
                    id: o.id,
                    text: { en: o.textEn, pa: o.textPa || o.textEn },
                    image_url: o.imageUrl || null
                })),
                correctAnswer: sq.correctAnswer,
                explanation: sq.explanationEn ? { en: sq.explanationEn, pa: sq.explanationPa || sq.explanationEn } : null,
                marks: sq.marks,
                negativeMarks: sq.negativeMarks,
                difficulty: sq.difficulty || 1,
            }))
        };

        try {
            const url = editingParagraphId
                ? `/api/admin/exams/${examId}/sections/${sectionId}/questions/batch/${editingParagraphId}`
                : `/api/admin/exams/${examId}/sections/${sectionId}/questions/batch`;

            const response = await fetch(url, {
                method: editingParagraphId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                toast.success(editingParagraphId ? 'Paragraph updated!' : 'Paragraph and questions added!');
                setShowAddForm(false);
                setIsParaMode(false);
                setEditingParagraphId(null);
                setFormData(createEmptyQuestion());
                setParaSubQuestions([]);
                loadData();
            } else {
                const data = await response.json();
                toast.error(data.error || 'Failed to save');
            }
        } catch (error) {
            toast.error('Error saving paragraph');
        }
    };

    // Helper to calculate correct order placement
    const calculateOrderForLocation = (parentId: string | null | undefined): number => {
        const sorted = [...questions].sort((a, b) => a.order - b.order);

        if (parentId) {
            // Find parent and its current children (excluding self if editing)
            const parent = sorted.find(q => q.id === parentId);
            if (!parent) return sorted.length + 1;

            const children = sorted.filter(q => q.parent_id === parentId && q.id !== editingQuestionId);

            // If children exist, place after the last child. 
            // If no children, place immediately after parent.
            let lastItemOrder = parent.order;
            if (children.length > 0) {
                lastItemOrder = children[children.length - 1].order;
            }

            return lastItemOrder + 1;
        }

        // Default: End of list
        const maxOrder = sorted.length > 0 ? sorted[sorted.length - 1].order : 0;
        return maxOrder + 1;
    };

    const handleAddQuestion = async () => {
        // Validation checks... (Keep existing checks)
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

        // Duplicate Check
        const duplicateQuestion = questions.find(q =>
            q.id !== editingQuestionId &&
            q.text?.en?.trim().toLowerCase() === formData.textEn?.trim().toLowerCase()
        );
        if (duplicateQuestion) {
            toast.error(`A question with the same content already exists!`);
            return;
        }

        const targetOrder = calculateOrderForLocation(formData.parentId);

        // Pre-shift existing orders if inserting in middle
        // Note: The API usually handles simple append, but for "INSERT" we might need to batch update others.
        // However, standard API might blindly insert. 
        // Strategy: We will determine order, verify if we need to shift.
        const needsShift = questions.some(q => q.order >= targetOrder);

        // Prepare Body
        const body: any = {
            type: formData.type,
            text: { en: formData.textEn || 'Paragraph', pa: formData.textPa || formData.textEn || 'ਪੈਰਾ' },
            explanation: formData.explanationEn
                ? { en: formData.explanationEn, pa: formData.explanationPa || formData.explanationEn }
                : null,
            marks: formData.type === 'paragraph' ? 0 : formData.marks,
            negativeMarks: formData.type === 'paragraph' ? 0 : (formData.negativeMarks || null),
            order: targetOrder,
            imageUrl: formData.imageUrl || null,
        };

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
            // First, shift others if needed (Bulk Reorder via API or sequential updates? 
            // Better to rely on the backend or do a bulk update. 
            // But we don't want to complicate. Let's create it, then reorder if needed.
            // Actually, inserting with existing order might cause collision or duplicates.
            // Let's rely on our bulk reorder logic or just send "order". 
            // If we use `reorder` API afterwards, it's safer.

            // To support "Insert", we should shift local state orders, then create.
            if (needsShift) {
                // We'll optimistically shift everything >= targetOrder by 1 locally to avoid conflict?
                // But we can't update server easily without bulk API.
                // We HAVE a bulk API now: `/reorder`.
                const updates = questions
                    .filter(q => q.order >= targetOrder)
                    .map(q => ({ id: q.id, order: q.order + 1 }));

                if (updates.length > 0) {
                    await fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions/reorder`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items: updates }),
                    });
                }
            }

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
        if (!editingQuestionId) return;

        // Validation... (Keep existing validation)
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

        // Determine if parent changed or just content
        const parentChanged = (formData.parentId || null) !== (currentQuestion.parent_id || null);

        let newOrder = currentQuestion.order;
        if (parentChanged) {
            // Recalculate order to move it into the new group
            newOrder = calculateOrderForLocation(formData.parentId);
        }

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

        try {
            // If moving to a new group, we might need to shift others to make space
            if (parentChanged) {
                const needsShift = questions.some(q => q.id !== editingQuestionId && q.order >= newOrder);
                if (needsShift) {
                    const updates = questions
                        .filter(q => q.id !== editingQuestionId && q.order >= newOrder)
                        .map(q => ({ id: q.id, order: q.order + 1 }));

                    if (updates.length > 0) {
                        await fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions/reorder`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ items: updates }),
                        });
                    }
                }
            }

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
                loadData();
            } else {
                loadData();
                toast.error('Failed to update question');
            }
        } catch (error) {
            loadData();
            toast.error('Failed to update question');
        }
    };

    const handleDeleteQuestion = (questionId: string) => {
        const question = questions.find(q => q.id === questionId);
        const isParagraph = question?.type === 'paragraph';
        const linkedCount = questions.filter(q => q.parent_id === questionId).length;

        confirm({
            title: isParagraph ? 'Delete Paragraph Section?' : 'Delete Question',
            message: isParagraph
                ? `This paragraph has ${linkedCount} linked question(s). Deleting it will also delete ALL linked questions. This action cannot be undone.`
                : 'Are you sure you want to delete this question? This action cannot be undone.',
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
        if (selectedQuestions.size === questions.filter(q => q.type !== 'paragraph').length) {
            setSelectedQuestions(new Set());
        } else {
            setSelectedQuestions(new Set(
                questions
                    .filter(q => q.type !== 'paragraph')
                    .map(q => q.id)
            ));
        }
    };

    const startEditQuestion = (question: Question) => {
        if (question.type === 'paragraph') {
            setIsParaMode(true);
            setEditingParagraphId(question.id);
            setShowAddForm(false);

            // Find linked sub-questions
            const linkedQuestions = questions.filter(q => q.parent_id === question.id);
            setParaSubQuestions(linkedQuestions.map(lq => ({
                id: lq.id,
                textEn: lq.text?.en || '',
                textPa: lq.text?.pa || '',
                type: (lq.type === 'mcq_multiple' ? 'mcq_multiple' : 'mcq_single'),
                options: lq.options?.map(o => ({
                    id: o.id,
                    textEn: o.text?.en || '',
                    textPa: o.text?.pa || '',
                    imageUrl: o.image_url
                })) || [
                        { id: 'a', textEn: '', textPa: '' },
                        { id: 'b', textEn: '', textPa: '' },
                        { id: 'c', textEn: '', textPa: '' },
                        { id: 'd', textEn: '', textPa: '' },
                    ],
                correctAnswer: lq.correct_answer || [],
                explanationEn: lq.explanation?.en || '',
                explanationPa: lq.explanation?.pa || '',
                marks: lq.marks,
                negativeMarks: lq.negative_marks || 0,
                difficulty: lq.difficulty || 1
            })));

            setFormData({
                textEn: question.text?.en || '',
                textPa: question.text?.pa || '',
                type: 'paragraph',
                options: [],
                correctAnswer: [],
                explanationEn: '',
                explanationPa: '',
                marks: 0,
                difficulty: 1,
                negativeMarks: 0,
                fillBlankAnswers: '',
                imageUrl: question.image_url || '',
                paragraphTextEn: question.paragraph_text?.en || '',
                paragraphTextPa: question.paragraph_text?.pa || '',
                parentId: ''
            });

            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setEditingQuestionId(question.id);
        setShowAddForm(false);
        setIsParaMode(false);

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
            difficulty: question.difficulty || 1,
            negativeMarks: question.negative_marks || 0,
            fillBlankAnswers: question.type === 'fill_blank' ? (question.correct_answer?.join(', ') || '') : '',
            imageUrl: question.image_url || '',
            paragraphTextEn: question.paragraph_text?.en || '',
            paragraphTextPa: question.paragraph_text?.pa || '',
            parentId: question.parent_id || '',
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingQuestionId(null);
        setEditingParagraphId(null);
        setIsParaMode(false);
        setParaSubQuestions([]);
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
        const sorted = [...questions].sort((a, b) => a.order - b.order);
        const currentIndex = sorted.findIndex(q => q.id === questionId);
        if (currentIndex === -1) return;

        const currentQ = sorted[currentIndex];

        // Grouping Logic: Build groups of [Parent, ...Children] or [Standalone]
        const groups: Question[][] = [];
        const visited = new Set<string>();

        for (const q of sorted) {
            if (visited.has(q.id)) continue;

            if (q.type === 'paragraph') {
                // Paragraph: Find all linked children from the source list
                const children = questions
                    .filter(sq => sq.parent_id === q.id)
                    .sort((a, b) => a.order - b.order);

                groups.push([q, ...children]);
                visited.add(q.id);
                children.forEach(c => visited.add(c.id));
            } else if (q.parent_id) {
                // Child: Check if parent exists
                const parentExists = questions.some(p => p.id === q.parent_id);
                if (parentExists) {
                    // Skip, it will be added when parent is processed (or was already)
                    continue;
                } else {
                    // Orphaned child (treat as standalone)
                    groups.push([q]);
                    visited.add(q.id);
                }
            } else {
                // Standalone question
                groups.push([q]);
                visited.add(q.id);
            }
        }

        const currentGroupIndex = groups.findIndex(g => g.some(item => item.id === questionId));
        if (currentGroupIndex === -1) return;
        const currentGroup = groups[currentGroupIndex];

        const newGroups = [...groups];

        // Determine Move Logic
        if (currentQ.type === 'paragraph') {
            // Move Whole Group
            const swapGroupIndex = direction === 'up' ? currentGroupIndex - 1 : currentGroupIndex + 1;

            if (swapGroupIndex >= 0 && swapGroupIndex < groups.length) {
                [newGroups[currentGroupIndex], newGroups[swapGroupIndex]] = [newGroups[swapGroupIndex], newGroups[currentGroupIndex]];
            }

        } else if (currentQ.parent_id) {
            // Move Child within Group
            const indexInGroup = currentGroup.findIndex(q => q.id === questionId);
            const swapIndexInGroup = direction === 'up' ? indexInGroup - 1 : indexInGroup + 1;

            // Constraint: Index 0 is Parent. Cannot move child above Parent (index 0).
            if (swapIndexInGroup > 0 && swapIndexInGroup < currentGroup.length) {
                const newGroup = [...currentGroup];
                [newGroup[indexInGroup], newGroup[swapIndexInGroup]] = [newGroup[swapIndexInGroup], newGroup[indexInGroup]];
                newGroups[currentGroupIndex] = newGroup;
            }

        } else {
            // Standalone: Move Group (Size 1)
            const swapGroupIndex = direction === 'up' ? currentGroupIndex - 1 : currentGroupIndex + 1;
            if (swapGroupIndex >= 0 && swapGroupIndex < groups.length) {
                [newGroups[currentGroupIndex], newGroups[swapGroupIndex]] = [newGroups[swapGroupIndex], newGroups[currentGroupIndex]];
            }
        }

        // Re-calculate orders for EVERY question based on flattened groups
        const flattened = newGroups.flat();
        const updates = flattened.map((q, i) => ({
            id: q.id,
            order: i + 1
        }));

        // Optimistic Update
        const newQuestions = questions.map(q => {
            const up = updates.find(u => u.id === q.id);
            return up ? { ...q, order: up.order } : q;
        });
        updateQuestionsOptimistically(newQuestions);

        try {
            await fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: updates }),
            });
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

    const renderParagraphForm = (isEdit: boolean = false) => {
        const quillModules = {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link', 'image'],
                ['clean']
            ],
        };

        return (
            <div className="bg-white border-2 border-purple-200 rounded-2xl shadow-xl overflow-hidden mb-8">
                {/* Header */}
                <div className="bg-purple-600 px-6 py-4 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6" />
                        <h3 className="text-lg font-bold">
                            {isEdit ? 'Edit Paragraph & Questions' : 'Create New Paragraph Section'}
                        </h3>
                    </div>
                    <button
                        onClick={() => {
                            if (isEdit) cancelEdit();
                            else {
                                setShowAddForm(false);
                                setIsParaMode(false);
                            }
                        }}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Paragraph Metadata */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Paragraph Content</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Passage Title (English) *</label>
                                <input
                                    type="text"
                                    value={formData.textEn}
                                    onChange={(e) => setFormData({ ...formData, textEn: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="e.g. Reading Comprehension - Section A"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Passage Title (Punjabi)</label>
                                <input
                                    type="text"
                                    value={formData.textPa}
                                    onChange={(e) => setFormData({ ...formData, textPa: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Main Passage Content (Rich Text) *</label>
                            <div className="prose-sm max-w-none">
                                <ReactQuill
                                    theme="snow"
                                    value={formData.paragraphTextEn}
                                    onChange={(val) => setFormData({ ...formData, paragraphTextEn: val })}
                                    modules={quillModules}
                                    className="bg-white rounded-xl overflow-hidden border"
                                    placeholder="Write or paste your passage here. You can include images directly!"
                                />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Sub Questions */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                                Linked Questions ({paraSubQuestions.length})
                            </h4>
                            <button
                                onClick={addParaSubQuestion}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-xl hover:bg-purple-200 font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add Sub-Question
                            </button>
                        </div>

                        <div className="space-y-8">
                            {paraSubQuestions.map((sq, qIdx) => (
                                <div key={qIdx} className="bg-gray-50 rounded-2xl p-6 border-l-4 border-purple-500 relative group animate-in fade-in slide-in-from-top-4 duration-300">
                                    <button
                                        onClick={() => removeParaSubQuestion(qIdx)}
                                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>

                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="w-10 h-10 bg-purple-500 text-white rounded-xl flex items-center justify-center font-bold shadow-lg shadow-purple-200 shrink-0">
                                            {qIdx + 1}
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Question (English)</label>
                                                    <textarea
                                                        value={sq.textEn}
                                                        onChange={(e) => updateParaSubQuestion(qIdx, { textEn: e.target.value })}
                                                        rows={2}
                                                        className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-purple-200 outline-none"
                                                        placeholder="Enter sub-question..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Question (Punjabi)</label>
                                                    <textarea
                                                        value={sq.textPa}
                                                        onChange={(e) => updateParaSubQuestion(qIdx, { textPa: e.target.value })}
                                                        rows={2}
                                                        className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-purple-200 outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                                                    <select
                                                        value={sq.type}
                                                        onChange={(e) => updateParaSubQuestion(qIdx, { type: e.target.value as any, correctAnswer: [] })}
                                                        className="w-full px-3 py-2 border rounded-xl bg-white"
                                                    >
                                                        <option value="mcq_single">MCQ - Single</option>
                                                        <option value="mcq_multiple">MCQ - Multiple</option>
                                                        <option value="fill_blank">Fill in the Blank</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Marks</label>
                                                    <input
                                                        type="number"
                                                        value={sq.marks}
                                                        onChange={(e) => updateParaSubQuestion(qIdx, { marks: parseInt(e.target.value) || 0 })}
                                                        className="w-full px-3 py-2 border rounded-xl"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Negative</label>
                                                    <input
                                                        type="number"
                                                        value={sq.negativeMarks}
                                                        onChange={(e) => updateParaSubQuestion(qIdx, { negativeMarks: parseFloat(e.target.value) || 0 })}
                                                        step={0.25}
                                                        className="w-full px-3 py-2 border rounded-xl"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Difficulty</label>
                                                    <select
                                                        value={sq.difficulty || 1}
                                                        onChange={(e) => updateParaSubQuestion(qIdx, { difficulty: parseInt(e.target.value) || 1 })}
                                                        className="w-full px-3 py-2 border rounded-xl bg-white"
                                                    >
                                                        <option value="1">1</option>
                                                        <option value="2">2</option>
                                                        <option value="3">3</option>
                                                        <option value="4">4</option>
                                                        <option value="5">5</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Options */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 ml-14">
                                        {sq.options.map((option, oIdx) => (
                                            <div key={option.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border group/opt">
                                                <button
                                                    onClick={() => toggleSubQuestionCorrectAnswer(qIdx, option.id)}
                                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${sq.correctAnswer.includes(option.id)
                                                        ? 'bg-green-500 border-green-500 text-white'
                                                        : 'border-gray-200 text-transparent hover:border-green-200'
                                                        }`}
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <div className="flex-1 space-y-2">
                                                    <input
                                                        type="text"
                                                        value={option.textEn}
                                                        onChange={(e) => updateSubQuestionOption(qIdx, oIdx, { textEn: e.target.value })}
                                                        placeholder={`Option ${option.id.toUpperCase()}`}
                                                        className="w-full text-sm border-none bg-transparent focus:ring-0 p-0"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={option.textPa}
                                                        onChange={(e) => updateSubQuestionOption(qIdx, oIdx, { textPa: e.target.value })}
                                                        placeholder="ਪੰਜਾਬੀ ਵਿੱਚ ਵਿਕਲਪ"
                                                        className="w-full text-xs text-gray-400 border-none bg-transparent focus:ring-0 p-0"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Explanation */}
                                    <div className="ml-14 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Explanation (En)</label>
                                            <textarea
                                                value={sq.explanationEn}
                                                onChange={(e) => updateParaSubQuestion(qIdx, { explanationEn: e.target.value })}
                                                rows={1}
                                                className="w-full px-3 py-2 text-sm border rounded-xl bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Explanation (Pa)</label>
                                            <textarea
                                                value={sq.explanationPa}
                                                onChange={(e) => updateParaSubQuestion(qIdx, { explanationPa: e.target.value })}
                                                rows={1}
                                                className="w-full px-3 py-2 text-sm border rounded-xl bg-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={addParaSubQuestion}
                            className="w-full py-4 border-2 border-dashed border-purple-200 rounded-2xl text-purple-400 hover:border-purple-400 hover:text-purple-600 flex items-center justify-center gap-2 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                            Add Another Question for this Passage
                        </button>
                    </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t">
                    <button
                        onClick={() => {
                            if (isEdit) cancelEdit();
                            else {
                                setShowAddForm(false);
                                setIsParaMode(false);
                            }
                        }}
                        className="px-6 py-2 border rounded-xl text-gray-600 hover:bg-gray-100 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleBatchSaveParagraph}
                        className="flex items-center gap-2 px-8 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-bold shadow-lg shadow-purple-200"
                    >
                        <Save className="w-5 h-5" />
                        Save Paragraph Set
                    </button>
                </div>
            </div>
        );
    };

    const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);

    // Question Form Component (inline)
    const renderQuestionForm = (isEdit: boolean = false) => {
        if (isParaMode) {
            return renderParagraphForm(isEdit);
        }

        return (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                        {isEdit ? 'Edit Question' : 'Add New Question'}
                    </h3>
                    <button onClick={() => {
                        if (isEdit) cancelEdit();
                        else {
                            setShowAddForm(false);
                            setIsParaMode(false);
                        }
                    }} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-1">
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
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty (1-5)</label>
                        <select
                            value={formData.difficulty}
                            onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) || 1 })}
                            className="w-full px-3 py-2 border rounded-lg bg-white"
                        >
                            <option value="1">1 - Easy</option>
                            <option value="2">2 - Medium</option>
                            <option value="3">3 - Moderate</option>
                            <option value="4">4 - Hard</option>
                            <option value="5">5 - Expert</option>
                        </select>
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
                            <div className="relative h-16 w-16">
                                <Image src={formData.imageUrl} alt="Question" fill className="object-cover rounded border" />
                            </div>
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
                                            {opt.imageUrl && (
                                                <div className="relative h-8 w-8">
                                                    <Image src={opt.imageUrl} alt="" fill className="object-cover rounded" />
                                                </div>
                                            )}
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
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                        <Save className="w-4 h-4" />
                        {isEdit ? 'Save Changes' : 'Add Question'}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
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
                                <p className="text-sm text-gray-500">{questions.filter(q => q.type !== 'paragraph').length} questions</p>
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
                            checked={selectedQuestions.size > 0 && selectedQuestions.size === questions.filter(q => q.type !== 'paragraph').length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                        />
                        <span className="text-sm text-gray-700">
                            {selectedQuestions.size === questions.filter(q => q.type !== 'paragraph').length ? 'Deselect All' : 'Select All Questions'}
                            {' '}({questions.filter(q => q.type !== 'paragraph').length} questions)
                        </span>
                    </div>
                )}
                {/* Questions List with inline edit forms */}
                {(() => {
                    let displayIndex = 0;
                    return sortedQuestions.map((q, index) => {
                        // Skip paragraphs and their sub-questions when that paragraph is being edited
                        if (editingParagraphId && (q.id === editingParagraphId || q.parent_id === editingParagraphId)) {
                            return null;
                        }

                        const isSubQuestion = !!q.parent_id;
                        if (q.type !== 'paragraph') {
                            displayIndex++;
                        }
                        const currentDisplayIndex = displayIndex;

                        return (
                            <div key={q.id} className={isSubQuestion ? 'my-1' : 'my-4'}>
                                {/* Question Card */}
                                <div className={`
                                    bg-white rounded-xl shadow-sm transition-all
                                    ${editingQuestionId === q.id ? 'ring-2 ring-blue-500' : ''}
                                    ${q.type === 'paragraph' ? 'border-l-4 border-purple-600 bg-purple-50/50' : ''}
                                    ${isSubQuestion ? 'ml-12 border-l-4 border-purple-200' : ''}
                                    p-4
                                `}>
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
                                            <span className={`
                                                w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                                                ${q.type === 'paragraph' ? 'bg-purple-600 text-white' : 'bg-blue-100 text-blue-700'}
                                            `}>
                                                {q.type === 'paragraph' ? (
                                                    <FileText className="w-4 h-4" />
                                                ) : (
                                                    currentDisplayIndex
                                                )}
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
                                            <div className="flex items-center gap-2 mb-1">
                                                {q.type === 'paragraph' && (
                                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase tracking-wider">
                                                        Paragraph Section
                                                    </span>
                                                )}
                                                {isSubQuestion && (
                                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded uppercase tracking-wider">
                                                        Linked Sub-Question
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-gray-900 font-medium mb-2 prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: getText(q.text, language) }} />

                                            {/* Paragraph text for paragraph type */}
                                            {q.type === 'paragraph' && q.paragraph_text && (
                                                <div className="bg-white border-2 border-purple-100 p-4 rounded-xl mb-3 shadow-sm">
                                                    <p className="text-xs text-purple-600 font-bold mb-2 flex items-center gap-1 uppercase tracking-wider">
                                                        <FileText className="w-3 h-3" />
                                                        Passage Content
                                                    </p>
                                                    <div
                                                        className="text-sm text-gray-700 prose prose-sm max-w-none quill-content"
                                                        dangerouslySetInnerHTML={{ __html: getText(q.paragraph_text, language) }}
                                                    />
                                                </div>
                                            )}

                                            {/* Question image */}
                                            {q.image_url && (
                                                <div className="relative h-32 w-full mb-2">
                                                    <Image src={q.image_url!} alt="" fill className="object-contain rounded border" />
                                                </div>
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
                                                            {opt.image_url && (
                                                                <div className="relative h-6 w-6">
                                                                    <Image src={opt.image_url} alt="" fill className="object-cover rounded" />
                                                                </div>
                                                            )}
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
                                                <span className={`px-2 py-0.5 rounded font-medium ${(q.difficulty || 1) <= 2 ? 'bg-green-100 text-green-700' :
                                                    (q.difficulty || 1) === 3 ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    Lvl {q.difficulty || 1}
                                                </span>
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
                        );
                    });
                })()}

                {/* Add/Edit Paragraph Form (at top when editing paragraph) */}
                {editingParagraphId && isParaMode && renderParagraphForm(true)}

                {/* Add Question Form (at bottom) */}
                {showAddForm ? (
                    renderQuestionForm(false)
                ) : !editingQuestionId && !editingParagraphId && (
                    <button
                        onClick={() => setShowTypeSelector(true)}
                        className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Add Question
                    </button>
                )}

                {/* Question Type Selector Modal */}
                {showTypeSelector && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">What would you like to create?</h3>
                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => {
                                        setShowTypeSelector(false);
                                        setIsParaMode(false);
                                        setFormData(createEmptyQuestion());
                                        setShowAddForm(true);
                                    }}
                                    className="p-4 border-2 rounded-xl text-left hover:border-blue-500 hover:bg-blue-50 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                            <Hash className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">Single Question</p>
                                            <p className="text-sm text-gray-500">MCQ, fill-blank, or standalone question</p>
                                        </div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowTypeSelector(false);
                                        setIsParaMode(true);
                                        setFormData({
                                            ...createEmptyQuestion(),
                                            type: 'paragraph',
                                        });
                                        setParaSubQuestions([{
                                            textEn: '',
                                            textPa: '',
                                            type: 'mcq_single',
                                            options: [
                                                { id: 'a', textEn: '', textPa: '' },
                                                { id: 'b', textEn: '', textPa: '' },
                                                { id: 'c', textEn: '', textPa: '' },
                                                { id: 'd', textEn: '', textPa: '' },
                                            ],
                                            correctAnswer: [],
                                            explanationEn: '',
                                            explanationPa: '',
                                            marks: 2,
                                            negativeMarks: 0.5,
                                        }]);
                                        setShowAddForm(true);
                                    }}
                                    className="p-4 border-2 rounded-xl text-left hover:border-purple-500 hover:bg-purple-50 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">Paragraph with Questions</p>
                                            <p className="text-sm text-gray-500">Comprehension passage with linked sub-questions</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                            <button
                                onClick={() => setShowTypeSelector(false)}
                                className="mt-4 w-full py-2 text-gray-500 hover:text-gray-700"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
