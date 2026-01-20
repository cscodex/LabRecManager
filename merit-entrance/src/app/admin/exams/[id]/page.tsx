'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import {
    ChevronLeft, Save, Plus, Trash2, GripVertical,
    FileText, Globe, Settings, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Section {
    id: string;
    name: Record<string, string>;
    order: number;
    duration: number | null;
    question_count: number;
}

interface Exam {
    id: string;
    title: Record<string, string>;
    description: Record<string, string> | null;
    duration: number;
    total_marks: number;
    passing_marks: number | null;
    negative_marking: number | null;
    shuffle_questions: boolean;
    status: string;
    sections: Section[];
    schedules: { id: string; start_time: string; end_time: string }[];
}

export default function EditExamPage() {
    const router = useRouter();
    const params = useParams();
    const examId = params.id as string;
    const { language, setLanguage } = useAuthStore();

    const [exam, setExam] = useState<Exam | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'sections'>('details');

    const [formData, setFormData] = useState({
        titleEn: '',
        titlePa: '',
        descriptionEn: '',
        descriptionPa: '',
        duration: 60,
        totalMarks: 100,
        passingMarks: 40,
        negativeMarking: 0,
        shuffleQuestions: false,
        status: 'draft',
    });

    const [newSection, setNewSection] = useState({ nameEn: '', namePa: '' });
    const [showAddSection, setShowAddSection] = useState(false);

    useEffect(() => {
        loadExam();
    }, [examId]);

    const loadExam = async () => {
        try {
            const response = await fetch(`/api/admin/exams/${examId}`);
            const data = await response.json();
            if (data.success) {
                const e = data.exam;
                setExam(e);
                setFormData({
                    titleEn: e.title.en || '',
                    titlePa: e.title.pa || '',
                    descriptionEn: e.description?.en || '',
                    descriptionPa: e.description?.pa || '',
                    duration: e.duration,
                    totalMarks: e.total_marks,
                    passingMarks: e.passing_marks || 0,
                    negativeMarking: e.negative_marking || 0,
                    shuffleQuestions: e.shuffle_questions,
                    status: e.status,
                });
            }
        } catch (error) {
            toast.error('Failed to load exam');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch(`/api/admin/exams/${examId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: { en: formData.titleEn, pa: formData.titlePa || formData.titleEn },
                    description: formData.descriptionEn
                        ? { en: formData.descriptionEn, pa: formData.descriptionPa || formData.descriptionEn }
                        : null,
                    duration: formData.duration,
                    totalMarks: formData.totalMarks,
                    passingMarks: formData.passingMarks,
                    negativeMarking: formData.negativeMarking || null,
                    shuffleQuestions: formData.shuffleQuestions,
                    status: formData.status,
                }),
            });

            if (response.ok) {
                toast.success('Exam saved!');
                loadExam();
            } else {
                toast.error('Failed to save');
            }
        } catch (error) {
            toast.error('An error occurred');
        } finally {
            setSaving(false);
        }
    };

    const handleAddSection = async () => {
        if (!newSection.nameEn) {
            toast.error('Section name is required');
            return;
        }

        try {
            const response = await fetch(`/api/admin/exams/${examId}/sections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: { en: newSection.nameEn, pa: newSection.namePa || newSection.nameEn },
                    order: (exam?.sections.length || 0) + 1,
                }),
            });

            if (response.ok) {
                toast.success('Section added!');
                setNewSection({ nameEn: '', namePa: '' });
                setShowAddSection(false);
                loadExam();
            }
        } catch (error) {
            toast.error('Failed to add section');
        }
    };

    const handleDeleteSection = async (sectionId: string) => {
        if (!confirm('Delete this section and all its questions?')) return;

        try {
            const response = await fetch(`/api/admin/exams/${examId}/sections/${sectionId}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                toast.success('Section deleted');
                loadExam();
            }
        } catch (error) {
            toast.error('Failed to delete section');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Exam not found</p>
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
                            <Link href="/admin/exams" className="text-gray-500 hover:text-gray-700">
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    {getText(exam.title, language)}
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {exam.sections.length} sections • {exam.sections.reduce((a, s) => a + s.question_count, 0)} questions
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setLanguage(language === 'en' ? 'pa' : 'en')}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                            >
                                <Globe className="w-4 h-4" />
                                {language === 'en' ? 'EN' : 'ਪੰ'}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-4">
                        <button
                            onClick={() => setActiveTab('details')}
                            className={`px-4 py-2 rounded-t-lg text-sm font-medium ${activeTab === 'details'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            <Settings className="w-4 h-4 inline mr-1" /> Details
                        </button>
                        <button
                            onClick={() => setActiveTab('sections')}
                            className={`px-4 py-2 rounded-t-lg text-sm font-medium ${activeTab === 'sections'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            <FileText className="w-4 h-4 inline mr-1" /> Sections & Questions
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-5xl mx-auto px-4 py-6">
                {activeTab === 'details' ? (
                    <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
                        {/* Title */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title (English) *
                                </label>
                                <input
                                    type="text"
                                    value={formData.titleEn}
                                    onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title (Punjabi)
                                </label>
                                <input
                                    type="text"
                                    value={formData.titlePa}
                                    onChange={(e) => setFormData({ ...formData, titlePa: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description (English)
                                </label>
                                <textarea
                                    value={formData.descriptionEn}
                                    onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description (Punjabi)
                                </label>
                                <textarea
                                    value={formData.descriptionPa}
                                    onChange={(e) => setFormData({ ...formData, descriptionPa: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Settings Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration *</label>
                                <input
                                    type="number"
                                    value={formData.duration}
                                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks *</label>
                                <input
                                    type="number"
                                    value={formData.totalMarks}
                                    onChange={(e) => setFormData({ ...formData, totalMarks: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Passing</label>
                                <input
                                    type="number"
                                    value={formData.passingMarks}
                                    onChange={(e) => setFormData({ ...formData, passingMarks: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">-ve Marking</label>
                                <input
                                    type="number"
                                    value={formData.negativeMarking}
                                    onChange={(e) => setFormData({ ...formData, negativeMarking: parseFloat(e.target.value) })}
                                    step={0.25}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="shuffle"
                                checked={formData.shuffleQuestions}
                                onChange={(e) => setFormData({ ...formData, shuffleQuestions: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <label htmlFor="shuffle" className="text-sm text-gray-700">
                                Shuffle questions
                            </label>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Sections List */}
                        {exam.sections.map((section) => (
                            <div key={section.id} className="bg-white rounded-xl shadow-sm p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <GripVertical className="w-5 h-5 text-gray-400 cursor-grab" />
                                        <div>
                                            <h3 className="font-semibold text-gray-900">
                                                {getText(section.name, language)}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {section.question_count} questions
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/admin/exams/${examId}/sections/${section.id}/questions`}
                                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                        >
                                            Manage Questions
                                        </Link>
                                        <button
                                            onClick={() => handleDeleteSection(section.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Add Section */}
                        {showAddSection ? (
                            <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <input
                                        type="text"
                                        value={newSection.nameEn}
                                        onChange={(e) => setNewSection({ ...newSection, nameEn: e.target.value })}
                                        placeholder="Section name (English)"
                                        className="px-4 py-2 border rounded-lg"
                                    />
                                    <input
                                        type="text"
                                        value={newSection.namePa}
                                        onChange={(e) => setNewSection({ ...newSection, namePa: e.target.value })}
                                        placeholder="Section name (Punjabi)"
                                        className="px-4 py-2 border rounded-lg"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowAddSection(false)}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddSection}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        Add Section
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAddSection(true)}
                                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Add Section
                            </button>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
