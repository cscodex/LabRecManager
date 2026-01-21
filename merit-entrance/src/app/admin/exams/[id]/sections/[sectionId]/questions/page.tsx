'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import {
    ChevronLeft, Plus, Save, Trash2, Globe,
    GripVertical, CheckCircle, Circle, Edit2, X,
    ChevronUp, ChevronDown, Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

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
}

interface Section {
    id: string;
    name: Record<string, string>;
}

interface FormOption {
    id: string;
    textEn: string;
    textPa: string;
}

export default function ManageQuestionsPage() {
    const params = useParams();
    const examId = params.id as string;
    const sectionId = params.sectionId as string;
    const { language, setLanguage } = useAuthStore();

    const [section, setSection] = useState<Section | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);

    const createEmptyQuestion = () => ({
        textEn: '',
        textPa: '',
        type: 'mcq_single',
        options: [
            { id: 'a', textEn: '', textPa: '' },
            { id: 'b', textEn: '', textPa: '' },
            { id: 'c', textEn: '', textPa: '' },
            { id: 'd', textEn: '', textPa: '' },
        ] as FormOption[],
        correctAnswer: [] as string[],
        explanationEn: '',
        explanationPa: '',
        marks: 1,
        negativeMarks: 0,
        fillBlankAnswer: '', // For fill_blank type
    });

    const [formData, setFormData] = useState(createEmptyQuestion());

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

    const handleAddQuestion = async () => {
        if (!formData.textEn) {
            toast.error('Question text is required');
            return;
        }

        // Validate based on type
        if (formData.type === 'fill_blank' && !formData.fillBlankAnswer) {
            toast.error('Correct answer is required for fill-in-the-blank');
            return;
        }

        if ((formData.type === 'mcq_single' || formData.type === 'mcq_multiple') && formData.correctAnswer.length === 0) {
            toast.error('Please select correct answer(s)');
            return;
        }

        try {
            const body: any = {
                type: formData.type,
                text: { en: formData.textEn, pa: formData.textPa || formData.textEn },
                explanation: formData.explanationEn
                    ? { en: formData.explanationEn, pa: formData.explanationPa || formData.explanationEn }
                    : null,
                marks: formData.marks,
                negativeMarks: formData.negativeMarks || null,
                order: questions.length + 1,
            };

            if (formData.type === 'fill_blank') {
                body.options = null;
                body.correctAnswer = [formData.fillBlankAnswer];
            } else {
                body.options = formData.options.map(o => ({
                    id: o.id,
                    text: { en: o.textEn, pa: o.textPa || o.textEn },
                }));
                body.correctAnswer = formData.correctAnswer;
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
        if (!editingQuestion || !formData.textEn) {
            toast.error('Question text is required');
            return;
        }

        try {
            const body: any = {
                type: formData.type,
                text: { en: formData.textEn, pa: formData.textPa || formData.textEn },
                explanation: formData.explanationEn
                    ? { en: formData.explanationEn, pa: formData.explanationPa || formData.explanationEn }
                    : null,
                marks: formData.marks,
                negativeMarks: formData.negativeMarks || null,
                order: editingQuestion.order,
            };

            if (formData.type === 'fill_blank') {
                body.options = null;
                body.correctAnswer = [formData.fillBlankAnswer];
            } else {
                body.options = formData.options.map(o => ({
                    id: o.id,
                    text: { en: o.textEn, pa: o.textPa || o.textEn },
                }));
                body.correctAnswer = formData.correctAnswer;
            }

            const response = await fetch(
                `/api/admin/exams/${examId}/sections/${sectionId}/questions/${editingQuestion.id}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );

            if (response.ok) {
                toast.success('Question updated!');
                setEditingQuestion(null);
                setFormData(createEmptyQuestion());
                loadData();
            }
        } catch (error) {
            toast.error('Failed to update question');
        }
    };

    const handleDeleteQuestion = async (questionId: string) => {
        if (!confirm('Delete this question?')) return;
        try {
            const response = await fetch(
                `/api/admin/exams/${examId}/sections/${sectionId}/questions/${questionId}`,
                { method: 'DELETE' }
            );
            if (response.ok) {
                toast.success('Question deleted');
                loadData();
            }
        } catch (error) {
            toast.error('Failed to delete question');
        }
    };

    const startEditQuestion = (question: Question) => {
        setEditingQuestion(question);
        setShowAddForm(false);

        const options: FormOption[] = question.options?.map(o => ({
            id: o.id,
            textEn: o.text.en || '',
            textPa: o.text.pa || '',
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
            fillBlankAnswer: question.type === 'fill_blank' ? (question.correct_answer?.[0] || '') : '',
        });
    };

    const cancelEdit = () => {
        setEditingQuestion(null);
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

    // Add new option
    const addOption = () => {
        const nextId = String.fromCharCode(97 + formData.options.length); // a, b, c, d...
        setFormData({
            ...formData,
            options: [...formData.options, { id: nextId, textEn: '', textPa: '' }],
        });
    };

    // Remove option
    const removeOption = (optionId: string) => {
        if (formData.options.length <= 1) {
            toast.error('At least one option is required');
            return;
        }
        setFormData({
            ...formData,
            options: formData.options.filter(o => o.id !== optionId),
            correctAnswer: formData.correctAnswer.filter(id => id !== optionId),
        });
    };

    // Move option up/down
    const moveOption = (index: number, direction: 'up' | 'down') => {
        const newOptions = [...formData.options];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;

        if (swapIndex < 0 || swapIndex >= newOptions.length) return;

        // Swap positions but keep IDs
        [newOptions[index], newOptions[swapIndex]] = [newOptions[swapIndex], newOptions[index]];

        // Re-assign IDs based on position
        const reIndexed = newOptions.map((opt, i) => ({
            ...opt,
            id: String.fromCharCode(97 + i),
        }));

        // Update correct answers to match new IDs
        const idMap: Record<string, string> = {};
        newOptions.forEach((opt, i) => {
            idMap[opt.id] = String.fromCharCode(97 + i);
        });

        setFormData({
            ...formData,
            options: reIndexed,
            correctAnswer: formData.correctAnswer.map(id => idMap[id] || id),
        });
    };

    // Move question up/down
    const handleMoveQuestion = async (questionId: string, direction: 'up' | 'down') => {
        const sortedQuestions = [...questions].sort((a, b) => a.order - b.order);
        const index = sortedQuestions.findIndex(q => q.id === questionId);

        if ((direction === 'up' && index === 0) || (direction === 'down' && index === sortedQuestions.length - 1)) {
            return;
        }

        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        const currentQ = sortedQuestions[index];
        const swapQ = sortedQuestions[swapIndex];

        try {
            await Promise.all([
                fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions/${currentQ.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order: swapQ.order }),
                }),
                fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions/${swapQ.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order: currentQ.order }),
                }),
            ]);
            loadData();
        } catch (error) {
            toast.error('Failed to reorder questions');
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
    const isEditing = !!editingQuestion;
    const isFormOpen = showAddForm || isEditing;

    // Question Form Component
    const renderQuestionForm = () => (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                    {isEditing ? 'Edit Question' : 'Add New Question'}
                </h3>
                {isEditing && (
                    <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Question Type */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value, correctAnswer: [] })}
                    className="w-full px-4 py-2 border rounded-lg"
                >
                    <option value="mcq_single">MCQ - Single Correct</option>
                    <option value="mcq_multiple">MCQ - Multiple Correct</option>
                    <option value="fill_blank">Fill in the Blank</option>
                </select>
            </div>

            {/* Question Text */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question (English) *</label>
                    <textarea
                        value={formData.textEn}
                        onChange={(e) => setFormData({ ...formData, textEn: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border rounded-lg"
                        placeholder={formData.type === 'fill_blank'
                            ? "Enter question with _____ for blank (e.g., The capital of India is _____)"
                            : "Enter question text..."}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Question (Punjabi)</label>
                    <textarea
                        value={formData.textPa}
                        onChange={(e) => setFormData({ ...formData, textPa: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border rounded-lg"
                        placeholder="ਸਵਾਲ ਦਾ ਟੈਕਸਟ ਦਰਜ ਕਰੋ..."
                    />
                </div>
            </div>

            {/* Fill in the Blank Answer */}
            {formData.type === 'fill_blank' ? (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer *</label>
                    <input
                        type="text"
                        value={formData.fillBlankAnswer}
                        onChange={(e) => setFormData({ ...formData, fillBlankAnswer: e.target.value })}
                        placeholder="Enter the correct answer for the blank"
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Use underscore _____ in the question to indicate blanks
                    </p>
                </div>
            ) : (
                /* MCQ Options */
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Options (click to mark as correct)
                        </label>
                        <button
                            type="button"
                            onClick={addOption}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                            <Plus className="w-4 h-4" />
                            Add Option
                        </button>
                    </div>
                    <div className="space-y-2">
                        {formData.options.map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                {/* Reorder buttons */}
                                <div className="flex flex-col gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => moveOption(idx, 'up')}
                                        disabled={idx === 0}
                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                        <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveOption(idx, 'down')}
                                        disabled={idx === formData.options.length - 1}
                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                    >
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Correct answer toggle */}
                                <button
                                    type="button"
                                    onClick={() => toggleCorrectAnswer(opt.id)}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${formData.correctAnswer.includes(opt.id)
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-200 text-gray-500'
                                        }`}
                                >
                                    {opt.id.toUpperCase()}
                                </button>

                                {/* Option inputs */}
                                <input
                                    type="text"
                                    value={opt.textEn}
                                    onChange={(e) => {
                                        const newOptions = [...formData.options];
                                        newOptions[idx].textEn = e.target.value;
                                        setFormData({ ...formData, options: newOptions });
                                    }}
                                    placeholder={`Option ${opt.id.toUpperCase()} (English)`}
                                    className="flex-1 px-3 py-2 border rounded-lg"
                                />
                                <input
                                    type="text"
                                    value={opt.textPa}
                                    onChange={(e) => {
                                        const newOptions = [...formData.options];
                                        newOptions[idx].textPa = e.target.value;
                                        setFormData({ ...formData, options: newOptions });
                                    }}
                                    placeholder={`ਵਿਕਲਪ ${opt.id.toUpperCase()} (Punjabi)`}
                                    className="flex-1 px-3 py-2 border rounded-lg"
                                />

                                {/* Remove option */}
                                <button
                                    type="button"
                                    onClick={() => removeOption(opt.id)}
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Marks */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                    <input
                        type="number"
                        value={formData.marks}
                        onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Negative Marks</label>
                    <input
                        type="number"
                        value={formData.negativeMarks}
                        onChange={(e) => setFormData({ ...formData, negativeMarks: parseFloat(e.target.value) || 0 })}
                        step={0.25}
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>
            </div>

            {/* Explanation */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (English)</label>
                    <textarea
                        value={formData.explanationEn}
                        onChange={(e) => setFormData({ ...formData, explanationEn: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (Punjabi)</label>
                    <textarea
                        value={formData.explanationPa}
                        onChange={(e) => setFormData({ ...formData, explanationPa: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
                <button
                    onClick={() => {
                        if (isEditing) cancelEdit();
                        else setShowAddForm(false);
                    }}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    onClick={isEditing ? handleUpdateQuestion : handleAddQuestion}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <Save className="w-4 h-4" />
                    {isEditing ? 'Update Question' : 'Add Question'}
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
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
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
                {/* Questions List */}
                {sortedQuestions.map((q, index) => (
                    <div key={q.id} className={`bg-white rounded-xl shadow-sm p-4 ${editingQuestion?.id === q.id ? 'ring-2 ring-blue-500' : ''}`}>
                        <div className="flex items-start gap-3">
                            {/* Reorder controls */}
                            <div className="flex flex-col items-center gap-0.5">
                                <button
                                    onClick={() => handleMoveQuestion(q.id, 'up')}
                                    disabled={index === 0}
                                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                                    title="Move up"
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
                                    title="Move down"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Question content */}
                            <div className="flex-1 min-w-0">
                                <p className="text-gray-900 font-medium mb-2">
                                    {getText(q.text, language)}
                                </p>
                                {q.type === 'fill_blank' ? (
                                    <div className="bg-green-50 border border-green-200 p-2 rounded inline-block">
                                        <span className="text-sm text-green-700">
                                            Answer: <strong>{q.correct_answer?.[0]}</strong>
                                        </span>
                                    </div>
                                ) : q.options && (
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        {q.options.map(opt => (
                                            <div
                                                key={opt.id}
                                                className={`flex items-center gap-2 p-2 rounded ${q.correct_answer?.includes(opt.id)
                                                        ? 'bg-green-50 border border-green-200'
                                                        : 'bg-gray-50'
                                                    }`}
                                            >
                                                <span className="font-medium text-gray-500">{opt.id.toUpperCase()}.</span>
                                                <span className="text-gray-700">{getText(opt.text, language)}</span>
                                                {q.correct_answer?.includes(opt.id) && (
                                                    <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <span>Marks: {q.marks}</span>
                                    {q.negative_marks !== null && q.negative_marks > 0 && <span>-ve: {q.negative_marks}</span>}
                                    <span className="capitalize px-2 py-0.5 bg-gray-100 rounded">
                                        {q.type.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-1">
                                <button
                                    onClick={() => startEditQuestion(q)}
                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                                    title="Edit question"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDeleteQuestion(q.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                    title="Delete question"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Question Form */}
                {isFormOpen ? (
                    renderQuestionForm()
                ) : (
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
