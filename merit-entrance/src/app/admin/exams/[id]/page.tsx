'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { getText } from '@/lib/utils';
import { getDifficultyColor } from '@/lib/performance';
import {
    ChevronLeft, Save, Plus, Trash2, Upload,
    FileText, Globe, Settings, ChevronUp, ChevronDown, Edit2, Clock, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import MasterImportModal from '@/components/MasterImportModal';
import RichTextEditor from '@/components/RichTextEditor';

interface Section {
    id: string;
    name: Record<string, string>;
    order: number;
    duration: number | null;
    question_count: number;
    avg_difficulty?: number;
}

interface Exam {
    id: string;
    title: Record<string, string>;
    description: Record<string, string> | null;
    instructions: Record<string, string> | null;
    duration: number;
    total_marks: number;
    passing_marks: number | null;
    negative_marking: number | null;
    shuffle_questions: boolean;
    security_mode?: boolean;
    status: string;
    sections: Section[];
    schedules: { id: string; start_time: string; end_time: string }[];
    avg_difficulty?: number;
}

export default function EditExamPage() {
    const router = useRouter();
    const params = useParams();
    const examId = params.id as string;
    const { language, setLanguage } = useAuthStore();
    const { confirm, DialogComponent } = useConfirmDialog();

    const [exam, setExam] = useState<Exam | null>(null);
    const [sections, setSections] = useState<Section[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
    const [activeTab, setActiveTab] = useState<'details' | 'instructions' | 'sections'>('details');
    const [editingSection, setEditingSection] = useState<Section | null>(null);
    const [editSectionData, setEditSectionData] = useState({ nameEn: '', namePa: '', duration: '' });

    const [formData, setFormData] = useState({
        titleEn: '',
        titlePa: '',
        descriptionEn: '',
        descriptionPa: '',
        instructionsEn: '',
        instructionsPa: '',
        duration: 60,
        totalMarks: 100,
        passingMarks: 40,
        negativeMarking: 0,
        shuffleQuestions: false,
        securityMode: false,
        status: 'draft',
    });

    const [newSection, setNewSection] = useState({ nameEn: '', namePa: '', duration: '' });
    const [showAddSection, setShowAddSection] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Refs for auto-save debouncing
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const initialLoadRef = useRef(true);
    const savedStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);


    const loadExam = useCallback(async () => {
        try {
            const response = await fetch(`/api/admin/exams/${examId}`);
            const data = await response.json();
            if (data.success) {
                const e = data.exam;
                setExam(e);
                setSections(e.sections || []);
                setFormData({
                    titleEn: e.title.en || '',
                    titlePa: e.title.pa || '',
                    descriptionEn: e.description?.en || '',
                    descriptionPa: e.description?.pa || '',
                    instructionsEn: e.instructions?.en || '',
                    instructionsPa: e.instructions?.pa || '',
                    duration: e.duration,
                    totalMarks: e.total_marks,
                    passingMarks: e.passing_marks || 0,
                    negativeMarking: e.negative_marking || 0,
                    shuffleQuestions: e.shuffle_questions,
                    securityMode: e.security_mode || false,
                    status: e.status,
                });
            }
        } catch (error) {
            toast.error('Failed to load exam');
        } finally {
            setLoading(false);
            // Mark initial load complete so auto-save can start
            setTimeout(() => {
                initialLoadRef.current = false;
            }, 100);
        }
    }, [examId]);

    useEffect(() => {
        loadExam();
    }, [examId, loadExam]);

    // Auto-save with debounce
    useEffect(() => {
        // Skip auto-save on initial load
        if (initialLoadRef.current) {
            return;
        }

        // Skip if still loading or no exam data
        if (loading || !exam) {
            return;
        }

        setAutoSaveStatus('pending');

        // Clear any existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Debounce save for 1.5 seconds
        saveTimeoutRef.current = setTimeout(async () => {
            setAutoSaveStatus('saving');
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
                        instructions: formData.instructionsEn
                            ? { en: formData.instructionsEn, pa: formData.instructionsPa || formData.instructionsEn }
                            : null,
                        duration: formData.duration,
                        totalMarks: formData.totalMarks,
                        passingMarks: formData.passingMarks,
                        negativeMarking: formData.negativeMarking || null,
                        shuffleQuestions: formData.shuffleQuestions,
                        securityMode: formData.securityMode,
                        status: formData.status,
                    }),
                });

                if (response.ok) {
                    setAutoSaveStatus('saved');
                    // Clear saved status after 2 seconds
                    if (savedStatusTimeoutRef.current) {
                        clearTimeout(savedStatusTimeoutRef.current);
                    }
                    savedStatusTimeoutRef.current = setTimeout(() => {
                        setAutoSaveStatus('idle');
                    }, 2000);
                } else {
                    const errorData = await response.json();
                    setAutoSaveStatus('error');
                    toast.error(`Auto-save failed: ${errorData.details || errorData.error || 'Unknown error'}`);
                    console.error('Auto-save error:', errorData);
                }
            } catch (error) {
                setAutoSaveStatus('error');
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                toast.error(`Auto-save failed: ${errorMsg}`);
                console.error('Auto-save exception:', error);
            } finally {
                setSaving(false);
            }
        }, 1500);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [formData, examId, loading, exam]);



    const updateSectionsOptimistically = (newSections: Section[]) => {
        setSections(newSections);
        if (exam) {
            setExam({ ...exam, sections: newSections });
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
                    instructions: formData.instructionsEn
                        ? { en: formData.instructionsEn, pa: formData.instructionsPa || formData.instructionsEn }
                        : null,
                    duration: formData.duration,
                    totalMarks: formData.totalMarks,
                    passingMarks: formData.passingMarks,
                    negativeMarking: formData.negativeMarking || null,
                    shuffleQuestions: formData.shuffleQuestions,
                    securityMode: formData.securityMode,
                    status: formData.status,
                }), // Added securityMode to manual save payload too
            });

            if (response.ok) {
                toast.success('Exam saved!');
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

        const newOrder = sections.length + 1;
        const tempId = `temp-${Date.now()}`;
        const newSec: Section = {
            id: tempId,
            name: { en: newSection.nameEn, pa: newSection.namePa || newSection.nameEn },
            order: newOrder,
            duration: newSection.duration ? parseInt(newSection.duration) : null,
            question_count: 0,
        };

        updateSectionsOptimistically([...sections, newSec]);
        setNewSection({ nameEn: '', namePa: '', duration: '' });
        setShowAddSection(false);

        try {
            const response = await fetch(`/api/admin/exams/${examId}/sections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: { en: newSection.nameEn, pa: newSection.namePa || newSection.nameEn },
                    order: newOrder,
                    duration: newSection.duration ? parseInt(newSection.duration) : null,
                }),
            });

            if (response.ok) {
                toast.success('Section added!');
                loadExam();
            } else {
                loadExam();
                toast.error('Failed to add section');
            }
        } catch (error) {
            loadExam();
            toast.error('Failed to add section');
        }
    };

    const handleDeleteSection = (sectionId: string) => {
        confirm({
            title: 'Delete Section',
            message: 'Are you sure you want to delete this section? All questions in this section will also be deleted.',
            variant: 'danger',
            confirmText: 'Delete',
            onConfirm: async () => {
                updateSectionsOptimistically(sections.filter(s => s.id !== sectionId));
                try {
                    const response = await fetch(`/api/admin/exams/${examId}/sections/${sectionId}`, {
                        method: 'DELETE',
                    });
                    if (response.ok) {
                        toast.success('Section deleted');
                    } else {
                        loadExam();
                        toast.error('Failed to delete section');
                    }
                } catch (error) {
                    loadExam();
                    toast.error('Failed to delete section');
                }
            },
        });
    };

    const handleMoveSection = async (sectionId: string, direction: 'up' | 'down') => {
        const sortedSections = [...sections].sort((a, b) => a.order - b.order);
        const index = sortedSections.findIndex(s => s.id === sectionId);

        if ((direction === 'up' && index === 0) || (direction === 'down' && index === sortedSections.length - 1)) {
            return;
        }

        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        const current = { ...sortedSections[index] };
        const swap = { ...sortedSections[swapIndex] };

        const tempOrder = current.order;
        current.order = swap.order;
        swap.order = tempOrder;

        const updated = sortedSections.map((s, i) => {
            if (i === index) return current;
            if (i === swapIndex) return swap;
            return s;
        });
        updateSectionsOptimistically(updated);

        try {
            await Promise.all([
                fetch(`/api/admin/exams/${examId}/sections/${current.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: current.name,
                        order: current.order,
                        duration: current.duration,
                    }),
                }),
                fetch(`/api/admin/exams/${examId}/sections/${swap.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: swap.name,
                        order: swap.order,
                        duration: swap.duration,
                    }),
                }),
            ]);
            toast.success('Reordered');
        } catch (error) {
            loadExam();
            toast.error('Failed to reorder sections');
        }
    };

    const startEditSection = (section: Section) => {
        setEditingSection(section);
        setEditSectionData({
            nameEn: section.name.en || '',
            namePa: section.name.pa || '',
            duration: section.duration?.toString() || '',
        });
    };

    const saveEditSection = async () => {
        if (!editingSection) return;

        const updatedSection: Section = {
            ...editingSection,
            name: { en: editSectionData.nameEn, pa: editSectionData.namePa || editSectionData.nameEn },
            duration: editSectionData.duration ? parseInt(editSectionData.duration) : null,
        };

        updateSectionsOptimistically(sections.map(s => s.id === editingSection.id ? updatedSection : s));
        setEditingSection(null);

        try {
            const response = await fetch(`/api/admin/exams/${examId}/sections/${editingSection.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: { en: editSectionData.nameEn, pa: editSectionData.namePa || editSectionData.nameEn },
                    order: editingSection.order,
                    duration: editSectionData.duration ? parseInt(editSectionData.duration) : null,
                }),
            });

            if (response.ok) {
                toast.success('Section updated!');
            } else {
                const errorData = await response.json();
                loadExam();
                toast.error(`Failed: ${errorData.details || errorData.error || 'Unknown error'}`);
                console.error('Section update error:', errorData);
            }
        } catch (error) {
            loadExam();
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            toast.error(`Failed: ${errorMsg}`);
            console.error('Section update exception:', error);
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

    const sortedSections = [...sections].sort((a, b) => a.order - b.order);
    const totalQuestions = sections.reduce((a, s) => a + s.question_count, 0);

    return (
        <div className="min-h-screen bg-gray-50">
            <DialogComponent />

            {showImportModal && exam && (
                <MasterImportModal
                    isOpen={showImportModal}
                    onClose={() => setShowImportModal(false)}
                    examId={examId}
                    sections={sections}
                    onSuccess={() => {
                        loadExam(); // Refresh to show new question counts
                    }}
                />
            )}

            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
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
                                <p className="text-sm text-gray-500 flex items-center gap-2">
                                    <span>{sections.length} sections</span>
                                    <span>•</span>
                                    <span>{totalQuestions} questions</span>
                                    {exam.avg_difficulty && (
                                        <>
                                            <span>•</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getDifficultyColor(Number(exam.avg_difficulty))}`}>
                                                Avg Difficulty: {Number(exam.avg_difficulty).toFixed(1)}
                                            </span>
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
                            >
                                <Upload className="w-4 h-4" />
                                Master Import
                            </button>
                            <Link
                                href={`/admin/exams/${examId}/preview`}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                <Eye className="w-4 h-4" />
                                Preview
                            </Link>
                            <button
                                onClick={() => setLanguage(language === 'en' ? 'pa' : 'en')}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                            >
                                <Globe className="w-4 h-4" />
                                {language === 'en' ? 'EN' : 'ਪੰ'}
                            </button>
                            {/* Auto-save status indicator */}
                            <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
                                {autoSaveStatus === 'pending' && (
                                    <span className="text-amber-600 flex items-center gap-1">
                                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                        Unsaved changes
                                    </span>
                                )}
                                {autoSaveStatus === 'saving' && (
                                    <span className="text-blue-600 flex items-center gap-1">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                        Saving...
                                    </span>
                                )}
                                {autoSaveStatus === 'saved' && (
                                    <span className="text-green-600 flex items-center gap-1">
                                        <Save className="w-4 h-4" />
                                        Saved ✓
                                    </span>
                                )}
                                {autoSaveStatus === 'error' && (
                                    <span className="text-red-600 flex items-center gap-1">
                                        <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                        Save failed
                                    </span>
                                )}
                            </div>
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
                            onClick={() => setActiveTab('instructions')}
                            className={`px-4 py-2 rounded-t-lg text-sm font-medium ${activeTab === 'instructions'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            <FileText className="w-4 h-4 inline mr-1" /> Instructions
                        </button>
                        <button
                            onClick={() => setActiveTab('sections')}
                            className={`px-4 py-2 rounded-t-lg text-sm font-medium ${activeTab === 'sections'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            <FileText className="w-4 h-4 inline mr-1" /> Sections
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title (English) *</label>
                                <input
                                    type="text"
                                    value={formData.titleEn}
                                    onChange={(e) => setFormData({ ...formData, titleEn: e.target.value })}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title (Punjabi)</label>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description (English)</label>
                                <textarea
                                    value={formData.descriptionEn}
                                    onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Punjabi)</label>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                                <input
                                    type="number"
                                    value={formData.duration}
                                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
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

                        <div className="flex items-center gap-6 mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="shuffle"
                                    checked={formData.shuffleQuestions}
                                    onChange={(e) => setFormData({ ...formData, shuffleQuestions: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <label htmlFor="shuffle" className="text-sm text-gray-700">Shuffle questions</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="securityMode"
                                    checked={formData.securityMode}
                                    onChange={(e) => setFormData({ ...formData, securityMode: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <label htmlFor="securityMode" className="text-sm text-gray-700 flex items-center gap-1">
                                    Controlled Environment
                                    <span className="text-xs text-gray-400 font-normal">(Strict mode)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'instructions' ? (
                    <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
                        <div className="border-b pb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Exam Instructions</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                These instructions are displayed to students before the exam starts. The timer begins only after they click &quot;Start Exam&quot;.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Instructions (English)</label>
                                <RichTextEditor
                                    value={formData.instructionsEn}
                                    onChange={(value) => setFormData({ ...formData, instructionsEn: value })}
                                    placeholder="Enter exam instructions in English..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Instructions (Punjabi)</label>
                                <RichTextEditor
                                    value={formData.instructionsPa}
                                    onChange={(value) => setFormData({ ...formData, instructionsPa: value })}
                                    placeholder="ਪੰਜਾਬੀ ਵਿੱਚ ਪ੍ਰੀਖਿਆ ਦੀਆਂ ਹਦਾਇਤਾਂ ਦਰਜ ਕਰੋ..."
                                />
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Tips for Instructions</h4>
                            <ul className="text-sm text-blue-700 space-y-1">
                                <li>• Use bullet points for clarity</li>
                                <li>• Mention exam duration and total marks</li>
                                <li>• Explain the marking scheme (negative marking if any)</li>
                                <li>• Add rules about navigation and submission</li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Sections List */}
                        {sortedSections.map((section, index) => (
                            <div key={section.id} className="bg-white rounded-xl shadow-sm p-4">
                                {editingSection?.id === section.id ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <input
                                                type="text"
                                                value={editSectionData.nameEn}
                                                onChange={(e) => setEditSectionData({ ...editSectionData, nameEn: e.target.value })}
                                                placeholder="Section name (English)"
                                                className="px-3 py-2 border rounded-lg"
                                            />
                                            <input
                                                type="text"
                                                value={editSectionData.namePa}
                                                onChange={(e) => setEditSectionData({ ...editSectionData, namePa: e.target.value })}
                                                placeholder="Section name (Punjabi)"
                                                className="px-3 py-2 border rounded-lg"
                                            />
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                <input
                                                    type="number"
                                                    value={editSectionData.duration}
                                                    onChange={(e) => setEditSectionData({ ...editSectionData, duration: e.target.value })}
                                                    placeholder="Duration (min)"
                                                    className="flex-1 px-3 py-2 border rounded-lg"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setEditingSection(null)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">
                                                Cancel
                                            </button>
                                            <button onClick={saveEditSection} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col gap-0.5">
                                                <button
                                                    onClick={() => handleMoveSection(section.id, 'up')}
                                                    disabled={index === 0}
                                                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                                                >
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleMoveSection(section.id, 'down')}
                                                    disabled={index === sortedSections.length - 1}
                                                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30"
                                                >
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900">{getText(section.name, language)}</h3>
                                                <p className="text-sm text-gray-500">
                                                    {section.question_count} questions
                                                    {section.duration && ` • ${section.duration} min`}
                                                    {section.avg_difficulty && (
                                                        <>
                                                            <span> • </span>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getDifficultyColor(Number(section.avg_difficulty))}`}>
                                                                Diff: {Number(section.avg_difficulty).toFixed(1)}
                                                            </span>
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => startEditSection(section)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <Link
                                                href={`/admin/exams/${examId}/sections/${section.id}/questions`}
                                                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                                            >
                                                Questions
                                            </Link>
                                            <Link
                                                href={`/admin/exams/${examId}/sections/${section.id}/import`}
                                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                                            >
                                                <Upload className="w-3 h-3" />
                                                Import
                                            </Link>
                                            <button onClick={() => handleDeleteSection(section.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Add Section */}
                        {showAddSection ? (
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 space-y-4">
                                <h4 className="font-medium text-gray-900">Add New Section</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input
                                        type="text"
                                        value={newSection.nameEn}
                                        onChange={(e) => setNewSection({ ...newSection, nameEn: e.target.value })}
                                        placeholder="Section name (English) *"
                                        className="px-4 py-2 border rounded-lg bg-white"
                                    />
                                    <input
                                        type="text"
                                        value={newSection.namePa}
                                        onChange={(e) => setNewSection({ ...newSection, namePa: e.target.value })}
                                        placeholder="Section name (Punjabi)"
                                        className="px-4 py-2 border rounded-lg bg-white"
                                    />
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <input
                                            type="number"
                                            value={newSection.duration}
                                            onChange={(e) => setNewSection({ ...newSection, duration: e.target.value })}
                                            placeholder="Duration (optional)"
                                            className="flex-1 px-4 py-2 border rounded-lg bg-white"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowAddSection(false)} className="px-4 py-2 border rounded-lg hover:bg-white">
                                        Cancel
                                    </button>
                                    <button onClick={handleAddSection} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
                )
                }
            </main >
        </div >
    );
}
