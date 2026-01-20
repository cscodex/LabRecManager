'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import {
    ChevronLeft, Plus, Save, Trash2, Globe,
    GripVertical, CheckCircle, Circle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Option {
    id: string;
    text: Record<string, string>;
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
}

interface Section {
    id: string;
    name: Record<string, string>;
}

export default function ManageQuestionsPage() {
    const params = useParams();
    const examId = params.id as string;
    const sectionId = params.sectionId as string;
    const { language, setLanguage } = useAuthStore();

    const [section, setSection] = useState<Section | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);

    const emptyQuestion = {
        textEn: '',
        textPa: '',
        type: 'mcq_single',
        options: [
            { id: 'a', textEn: '', textPa: '' },
            { id: 'b', textEn: '', textPa: '' },
            { id: 'c', textEn: '', textPa: '' },
            { id: 'd', textEn: '', textPa: '' },
        ],
        correctAnswer: [] as string[],
        explanationEn: '',
        explanationPa: '',
        marks: 1,
        negativeMarks: 0,
    };

    const [formData, setFormData] = useState(emptyQuestion);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Load section details
            const sectionsRes = await fetch(`/api/admin/exams/${examId}/sections`);
            const sectionsData = await sectionsRes.json();
            const sec = sectionsData.sections?.find((s: Section) => s.id === sectionId);
            setSection(sec);

            // Load questions
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

        try {
            const response = await fetch(`/api/admin/exams/${examId}/sections/${sectionId}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: formData.type,
                    text: { en: formData.textEn, pa: formData.textPa || formData.textEn },
                    options: formData.options.map(o => ({
                        id: o.id,
                        text: { en: o.textEn, pa: o.textPa || o.textEn },
                    })),
                    correctAnswer: formData.correctAnswer,
                    explanation: formData.explanationEn
                        ? { en: formData.explanationEn, pa: formData.explanationPa || formData.explanationEn }
                        : null,
                    marks: formData.marks,
                    negativeMarks: formData.negativeMarks || null,
                    order: questions.length + 1,
                }),
            });

            if (response.ok) {
                toast.success('Question added!');
                setFormData(emptyQuestion);
                setShowAddForm(false);
                loadData();
            }
        } catch (error) {
            toast.error('Failed to add question');
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

    if (loading) {
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
                {questions.map((q, index) => (
                    <div key={q.id} className="bg-white rounded-xl shadow-sm p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex items-center gap-2">
                                <GripVertical className="w-5 h-5 text-gray-400" />
                                <span className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                                    {index + 1}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-gray-900 font-medium mb-2">
                                    {getText(q.text, language)}
                                </p>
                                {q.options && (
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        {q.options.map(opt => (
                                            <div
                                                key={opt.id}
                                                className={`flex items-center gap-2 p-2 rounded ${q.correct_answer.includes(opt.id)
                                                        ? 'bg-green-50 border border-green-200'
                                                        : 'bg-gray-50'
                                                    }`}
                                            >
                                                <span className="font-medium text-gray-500">{opt.id.toUpperCase()}.</span>
                                                <span className="text-gray-700">{getText(opt.text, language)}</span>
                                                {q.correct_answer.includes(opt.id) && (
                                                    <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <span>Marks: {q.marks}</span>
                                    {q.negative_marks && <span>-ve: {q.negative_marks}</span>}
                                    <span className="capitalize">{q.type.replace('_', ' ')}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add Question Form */}
                {showAddForm ? (
                    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                        <h3 className="font-semibold text-gray-900">Add New Question</h3>

                        {/* Question Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg"
                            >
                                <option value="mcq_single">MCQ - Single Correct</option>
                                <option value="mcq_multiple">MCQ - Multiple Correct</option>
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
                                    placeholder="Enter question text..."
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

                        {/* Options */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Options (click to mark as correct)
                            </label>
                            <div className="space-y-2">
                                {formData.options.map((opt, idx) => (
                                    <div key={opt.id} className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => toggleCorrectAnswer(opt.id)}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center ${formData.correctAnswer.includes(opt.id)
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-gray-200 text-gray-500'
                                                }`}
                                        >
                                            {opt.id.toUpperCase()}
                                        </button>
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
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Marks */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Marks</label>
                                <input
                                    type="number"
                                    value={formData.marks}
                                    onChange={(e) => setFormData({ ...formData, marks: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Negative Marks</label>
                                <input
                                    type="number"
                                    value={formData.negativeMarks}
                                    onChange={(e) => setFormData({ ...formData, negativeMarks: parseFloat(e.target.value) })}
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
                                onClick={() => setShowAddForm(false)}
                                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddQuestion}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                <Save className="w-4 h-4" />
                                Add Question
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowAddForm(true)}
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
