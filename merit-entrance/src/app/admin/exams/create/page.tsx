'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { ChevronLeft, Save, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateExamPage() {
    const router = useRouter();
    const { language, setLanguage } = useAuthStore();
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        securityMode: false,
        gradingInstructions: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.titleEn) {
            toast.error('Exam title (English) is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/admin/exams', {
                method: 'POST',
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
                    securityMode: formData.securityMode,
                    gradingInstructions: formData.gradingInstructions,
                }),
            });

            const data = await response.json();
            if (data.success) {
                toast.success('Exam created successfully!');
                router.push(`/admin/exams/${data.examId}`);
            } else {
                toast.error(data.error || 'Failed to create exam');
            }
        } catch (error) {
            toast.error('An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/exams" className="text-gray-500 hover:text-gray-700">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-xl font-bold text-gray-900">Create New Exam</h1>
                    </div>
                    <button
                        onClick={() => setLanguage(language === 'en' ? 'pa' : 'en')}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                    >
                        <Globe className="w-4 h-4" />
                        {language === 'en' ? 'English' : 'ਪੰਜਾਬੀ'}
                    </button>
                </div>
            </header>

            {/* Form */}
            <main className="max-w-4xl mx-auto px-4 py-6">
                <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
                    {/* Title */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Exam Title (English) *
                            </label>
                            <input
                                type="text"
                                value={formData.titleEn}
                                onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                                placeholder="e.g., Class 10 Entrance Exam"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Exam Title (Punjabi)
                            </label>
                            <input
                                type="text"
                                value={formData.titlePa}
                                onChange={(e) => setFormData({ ...formData, titlePa: e.target.value })}
                                placeholder="ਜਮਾਤ 10 ਦਾਖਲਾ ਪ੍ਰੀਖਿਆ"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                placeholder="Brief description of the exam..."
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                placeholder="ਪ੍ਰੀਖਿਆ ਦਾ ਸੰਖੇਪ ਵੇਰਵਾ..."
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Grading Instructions */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            AI Grading Instructions (Optional)
                        </label>
                        <textarea
                            value={formData.gradingInstructions}
                            onChange={(e) => setFormData({ ...formData, gradingInstructions: e.target.value })}
                            rows={3}
                            placeholder="Custom instructions for the AI grader (e.g., 'Be lenient with spelling', 'Focus on keywords')..."
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">These instructions will be appended to the system prompt when grading subjective answers.</p>
                    </div>

                    {/* Settings */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Duration (mins) *
                            </label>
                            <input
                                type="number"
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                                min={1}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Total Marks *
                            </label>
                            <input
                                type="number"
                                value={formData.totalMarks}
                                onChange={(e) => setFormData({ ...formData, totalMarks: parseInt(e.target.value) })}
                                min={1}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Passing Marks
                            </label>
                            <input
                                type="number"
                                value={formData.passingMarks}
                                onChange={(e) => setFormData({ ...formData, passingMarks: parseInt(e.target.value) })}
                                min={0}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Negative Marking
                            </label>
                            <input
                                type="number"
                                value={formData.negativeMarking}
                                onChange={(e) => setFormData({ ...formData, negativeMarking: parseFloat(e.target.value) })}
                                min={0}
                                step={0.25}
                                placeholder="0.25"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Options */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="shuffle"
                            checked={formData.shuffleQuestions}
                            onChange={(e) => setFormData({ ...formData, shuffleQuestions: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <label htmlFor="shuffle" className="text-sm text-gray-700">
                            Shuffle questions for each student
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="security"
                            checked={formData.securityMode}
                            onChange={(e) => setFormData({ ...formData, securityMode: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                        />
                        <label htmlFor="security" className="text-sm text-gray-700">
                            <strong>Controlled Environment</strong> (Disable tab switching, context menu, etc.)
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t">
                        <Link
                            href="/admin/exams"
                            className="flex-1 px-4 py-2.5 text-center border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {isSubmitting ? 'Creating...' : 'Create Exam'}
                        </button>
                    </div>
                </form>

                <p className="text-center text-sm text-gray-500 mt-4">
                    After creating the exam, you can add sections and questions.
                </p>
            </main>
        </div>
    );
}
