'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { formatDateTimeIST, getText } from '@/lib/utils';
import { Plus, Trash2, ChevronLeft, Save, X, Search, Edit2, Loader2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminBlueprintsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated, language } = useAuthStore();
    const [blueprints, setBlueprints] = useState<any[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingBpId, setEditingBpId] = useState<string | null>(null);
    const [viewingBp, setViewingBp] = useState<any | null>(null);
    const [selectedBlueprintIds, setSelectedBlueprintIds] = useState<string[]>([]);

    // Knowledge Base State
    const [referenceMaterials, setReferenceMaterials] = useState<any[]>([]);
    const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);

    // New Blueprint State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [generationMethod, setGenerationMethod] = useState<'pull_existing' | 'generate_novel'>('pull_existing');
    const [sections, setSections] = useState<any[]>([
        { name: { en: 'Main Section', pa: 'ਮੁੱਖ ਭਾਗ' }, rules: [] }
    ]);

    // AI Generation State
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGeneratingBlueprint, setIsGeneratingBlueprint] = useState(false);
    const [savedPrompts, setSavedPrompts] = useState<{ id: string, name: string, prompt: string }[]>([]);
    const [aiImages, setAiImages] = useState<File[]>([]);
    const [aiImagePreviews, setAiImagePreviews] = useState<string[]>([]);

    // Tag Search State
    const [searchTagTerm, setSearchTagTerm] = useState<{ [key: string]: string }>({});
    const [showTagDropdown, setShowTagDropdown] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadData();

        // Load saved prompts
        loadSavedPrompts();
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadSavedPrompts = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`/api/admin/blueprints/ai-prompts?adminId=${user.id}`);
            const data = await res.json();
            if (data.success) {
                setSavedPrompts(data.data);
            }
        } catch (e) {
            console.error("Failed to load saved prompts", e);
        }
    };

    const loadData = async () => {
        try {
            const [bpRes, tagsRes, matRes] = await Promise.all([
                fetch('/api/admin/blueprints'),
                fetch('/api/admin/tags'),
                fetch('/api/admin/knowledge-base?limit=100')
            ]);

            const bpData = await bpRes.json();
            const tagsData = await tagsRes.json();
            const matData = await matRes.json();

            if (bpData.success) setBlueprints(bpData.data);
            if (tagsData.success) setTags(tagsData.tags);
            if (matData.success) setReferenceMaterials(matData.data || []);
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (bp: any) => {
        setEditingBpId(bp.id);
        setName(bp.name);
        setDescription(bp.description || '');
        setGenerationMethod(bp.generationMethod || 'pull_existing');
        // Pre-fill selected materials if available in the relation
        setSelectedMaterialIds(bp.materials?.map((m: any) => m.id) || []);

        if (bp.sections && bp.sections.length > 0) {
            setSections(bp.sections.map((s: any) => ({
                name: s.name,
                rules: s.rules.map((r: any) => ({
                    topicTags: r.topicTags?.map((t: any) => t.id) || [],
                    questionType: r.questionType,
                    numberOfQuestions: r.numberOfQuestions,
                    marksPerQuestion: r.marksPerQuestion,
                    negativeMarks: r.negativeMarks || 0,
                    difficulty: r.difficulty || ''
                }))
            })));
        } else {
            setSections([{ name: { en: 'Main Section', pa: 'ਮੁੱਖ ਭਾਗ' }, rules: [] }]);
        }
        setShowCreateModal(true);
    };

    const deleteBlueprint = async (id: string) => {
        if (!confirm('Are you sure you want to delete this blueprint?')) return;
        try {
            const res = await fetch(`/api/admin/blueprints/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Blueprint deleted');
                loadData();
            } else {
                toast.error('Failed to delete blueprint');
            }
        } catch (err) {
            toast.error('Error deleting blueprint');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedBlueprintIds.length === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedBlueprintIds.length} blueprints?`)) return;

        try {
            const promises = selectedBlueprintIds.map(id => fetch(`/api/admin/blueprints/${id}`, { method: 'DELETE' }));
            const results = await Promise.all(promises);

            if (results.every(res => res.ok)) {
                toast.success('Selected blueprints deleted');
                setSelectedBlueprintIds([]);
                loadData();
            } else {
                toast.error('Failed to delete some blueprints');
                loadData();
            }
        } catch (err) {
            toast.error('Error during bulk deletion');
        }
    };

    const handleCreateBlueprint = async () => {
        if (!name) {
            toast.error('Name is required');
            return;
        }

        let hasRule = false;
        for (const sec of sections) {
            if (sec.rules.length > 0) hasRule = true;
        }

        if (!hasRule) {
            toast.error('At least one rule is required in across all sections');
            return;
        }

        try {
            const url = editingBpId ? `/api/admin/blueprints/${editingBpId}` : '/api/admin/blueprints';
            const method = editingBpId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description,
                    generationMethod,
                    createdById: user?.id,
                    sections,
                    materialIds: selectedMaterialIds
                })
            });

            const data = await res.json();

            if (data.requiresAiConfirmation) {
                // Smart UI Feature: If they run out of bank questions, seamlessly ask to turn on AI!
                const wantsAi = window.confirm(data.error);
                if (wantsAi) {
                    setGenerationMethod('generate_novel');
                    const res2 = await fetch(url, {
                        method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name,
                            description,
                            generationMethod: 'generate_novel',
                            createdById: user?.id,
                            sections,
                            materialIds: selectedMaterialIds
                        })
                    });
                    const data2 = await res2.json();
                    if (data2.success) {
                        toast.success(`Blueprint ${editingBpId ? 'updated' : 'created'} successfully with AI Generation enabled!`);
                        closeModal();
                        loadData();
                    } else {
                        toast.error(data2.error || 'Failed to save');
                    }
                }
                return;
            }

            if (data.success) {
                toast.success(`Blueprint ${editingBpId ? 'updated' : 'created'} successfully`);
                closeModal();
                loadData();
            } else {
                toast.error(data.error || 'Failed to save');
            }
        } catch (err: any) {
            toast.error('An error occurred');
        }
    };

    const handleSavePrompt = async () => {
        if (!aiPrompt.trim()) return;
        const promptName = window.prompt("Enter a name to save this custom AI Blueprint prompt:");
        if (!promptName?.trim()) return;

        try {
            const res = await fetch('/api/admin/blueprints/ai-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: promptName,
                    promptText: aiPrompt,
                    createdById: user?.id
                })
            });
            const data = await res.json();
            if (data.success) {
                setSavedPrompts(prev => [data.data, ...prev]);
                toast.success("Prompt saved to your templates!");
            } else {
                toast.error(data.error || "Failed to save prompt");
            }
        } catch (e) {
            toast.error("An error occurred while saving");
        }
    };

    const handleDeletePrompt = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Delete this saved template?")) return;

        try {
            const res = await fetch(`/api/admin/blueprints/ai-prompts/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setSavedPrompts(prev => prev.filter(p => p.id !== id));
            } else {
                toast.error("Failed to delete prompt");
            }
        } catch (e) {
            toast.error("An error occurred while deleting");
        }
    };

    const handleGenerateWithAi = async () => {
        if (!aiPrompt.trim() && aiImages.length === 0) {
            toast.error('Please enter a description or upload an image for the AI');
            return;
        }

        setIsGeneratingBlueprint(true);
        const toastId = toast.loading('AI is designing the blueprint structure...');

        try {
            // Convert images to base64
            const base64Images = await Promise.all(
                aiImages.map(file => new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                }))
            );

            const res = await fetch('/api/ai/generate-blueprint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: aiPrompt,
                    images: base64Images,
                    materialIds: selectedMaterialIds
                })
            });

            const data = await res.json();

            if (data.success && data.data) {
                const aiBp = data.data;
                if (aiBp.name) setName(aiBp.name);
                if (aiBp.description) setDescription(aiBp.description);
                if (aiBp.sections && Array.isArray(aiBp.sections)) {
                    setSections(aiBp.sections);
                }
                setAiPrompt(''); // clear prompt
                setAiImages([]);
                setAiImagePreviews([]);
                toast.success('Blueprint successfully generated! Please review.', { id: toastId });
            } else {
                toast.error(data.error || 'Failed to generate blueprint', { id: toastId });
            }
        } catch (err) {
            console.error(err);
            toast.error('An error occurred while calling the AI', { id: toastId });
        } finally {
            setIsGeneratingBlueprint(false);
        }
    };

    const handleImageDrop = (e: React.DragEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>) => {
        let files: File[] = [];
        if ('dataTransfer' in e) {
            e.preventDefault();
            files = Array.from(e.dataTransfer.files);
        } else {
            files = Array.from(e.target.files || []);
        }

        const validImages = files.filter(f => f.type.startsWith('image/'));
        if (validImages.length === 0) return;

        setAiImages(prev => [...prev, ...validImages]);
        validImages.forEach(file => {
            const url = URL.createObjectURL(file);
            setAiImagePreviews(prev => [...prev, url]);
        });
    };

    const removeImage = (idx: number) => {
        setAiImages(prev => prev.filter((_, i) => i !== idx));
        setAiImagePreviews(prev => {
            const newPreviews = [...prev];
            URL.revokeObjectURL(newPreviews[idx]); // clean up memory
            newPreviews.splice(idx, 1);
            return newPreviews;
        });
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingBpId(null);
        setName('');
        setDescription('');
        setGenerationMethod('pull_existing');
        setSections([{ name: { en: 'Main Section', pa: 'ਮੁੱਖ ਭਾਗ' }, rules: [] }]);
    };

    const closeViewModal = () => {
        setViewingBp(null);
    };

    const addSection = () => {
        setSections([...sections, { name: { en: `Section ${sections.length + 1}`, pa: '' }, rules: [] }]);
    };

    const updateSectionName = (secIdx: number, value: string) => {
        const newSections = [...sections];
        newSections[secIdx].name.en = value;
        setSections(newSections);
    };

    const removeSection = (secIdx: number) => {
        if (sections.length === 1) return;
        setSections(sections.filter((_: any, i: number) => i !== secIdx));
    };

    const addRule = (secIdx: number) => {
        const newSections = [...sections];
        newSections[secIdx].rules.push({
            topicTags: [],
            questionType: 'mcq_single',
            numberOfQuestions: 10,
            marksPerQuestion: 1,
            negativeMarks: 0,
            difficulty: ''
        });
        setSections(newSections);
    };

    const updateRule = (secIdx: number, ruleIdx: number, field: string, value: any) => {
        const newSections = [...sections];
        newSections[secIdx].rules[ruleIdx][field] = value;
        setSections(newSections);
    };

    const removeRule = (secIdx: number, ruleIdx: number) => {
        const newSections = [...sections];
        newSections[secIdx].rules = newSections[secIdx].rules.filter((_: any, i: number) => i !== ruleIdx);
        setSections(newSections);
    };

    const duplicateRule = (secIdx: number, ruleIdx: number) => {
        const newSections = [...sections];
        const ruleToCopy = newSections[secIdx].rules[ruleIdx];
        newSections[secIdx].rules.splice(ruleIdx + 1, 0, { ...ruleToCopy, topicTags: [...(ruleToCopy.topicTags || [])] });
        setSections(newSections);
    };

    // Tag Selection
    const selectTag = (secIdx: number, ruleIdx: number, tagId: string, tagName: string) => {
        const newSections = [...sections];
        const currentTags = newSections[secIdx].rules[ruleIdx].topicTags || [];
        if (!currentTags.includes(tagId)) {
            newSections[secIdx].rules[ruleIdx].topicTags = [...currentTags, tagId];
            setSections(newSections);
        }
        setSearchTagTerm({ ...searchTagTerm, [`${secIdx}-${ruleIdx}`]: '' });
        setShowTagDropdown({ ...showTagDropdown, [`${secIdx}-${ruleIdx}`]: false });
    };

    const removeTag = (secIdx: number, ruleIdx: number, tagId: string) => {
        const newSections = [...sections];
        const currentTags = newSections[secIdx].rules[ruleIdx].topicTags || [];
        newSections[secIdx].rules[ruleIdx].topicTags = currentTags.filter((id: string) => id !== tagId);
        setSections(newSections);
    };

    // Calculate totals dynamically
    const { totalQuestions, totalMarks } = useMemo(() => {
        let q = 0;
        let m = 0;
        sections.forEach(sec => {
            sec.rules.forEach((r: any) => {
                const count = Number(r.numberOfQuestions) || 0;
                const marks = Number(r.marksPerQuestion) || 0;
                q += count;
                m += count * marks;
            });
        });
        return { totalQuestions: q, totalMarks: m };
    }, [sections]);

    if (!_hasHydrated || loading) {
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
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
                            <ChevronLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Manage Blueprints</h1>
                            <p className="text-sm text-gray-500">Auto-generate exams from blueprints</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {selectedBlueprintIds.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition border border-red-200"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Selected ({selectedBlueprintIds.length})
                            </button>
                        )}
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                            <Plus className="w-4 h-4" />
                            Create Blueprint
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {blueprints.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center text-gray-500">
                        No blueprints created yet.
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b text-sm text-gray-500">
                                        <th className="p-4 w-12">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={blueprints.length > 0 && selectedBlueprintIds.length === blueprints.length}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedBlueprintIds(blueprints.map(bp => bp.id));
                                                    else setSelectedBlueprintIds([]);
                                                }}
                                            />
                                        </th>
                                        <th className="p-4 font-semibold">Name</th>
                                        <th className="p-4 font-semibold">Description</th>
                                        <th className="p-4 font-semibold">Structure</th>
                                        <th className="p-4 font-semibold">Created</th>
                                        <th className="p-4 text-right font-semibold relative">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {blueprints.map(bp => {
                                        let bpQ = 0; let bpM = 0;
                                        bp.sections?.forEach((s: any) => {
                                            s.rules?.forEach((r: any) => {
                                                bpQ += Number(r.numberOfQuestions);
                                                bpM += Number(r.numberOfQuestions) * Number(r.marksPerQuestion);
                                            });
                                        });

                                        return (
                                            <tr key={bp.id} className={`hover:bg-gray-50 transition group ${selectedBlueprintIds.includes(bp.id) ? 'bg-blue-50/30' : ''}`}>
                                                <td className="p-4 w-12">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer p-2"
                                                        checked={selectedBlueprintIds.includes(bp.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedBlueprintIds([...selectedBlueprintIds, bp.id]);
                                                            else setSelectedBlueprintIds(selectedBlueprintIds.filter(id => id !== bp.id));
                                                        }}
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                                                        {bp.name}
                                                        {bp.generationMethod === 'generate_novel' && (
                                                            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                                                <span className="-mt-0.5">✨</span> AI
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm text-gray-600 max-w-xs truncate">
                                                    {bp.description || '-'}
                                                </td>
                                                <td className="p-4 text-sm text-blue-800 font-medium">
                                                    {bp.sections?.length || 0} Sections · {bpQ} Qs · {bpM} Marks
                                                </td>
                                                <td className="p-4 text-sm text-gray-500">
                                                    {formatDateTimeIST(bp.createdAt).split(',')[0]}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => setViewingBp(bp)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition" title="View Details">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => openEditModal(bp)} className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition" title="Edit Blueprint">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => deleteBlueprint(bp.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition" title="Delete Blueprint">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl max-w-5xl w-full p-6 my-8 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-xl font-bold">{editingBpId ? 'Edit Exam Blueprint' : 'Create Exam Blueprint'}</h2>
                                <p className="text-sm text-gray-500">{editingBpId ? 'Modify sections and marking rules' : 'Define sections and marking rules'}</p>
                            </div>
                            <button onClick={closeModal} className="text-gray-500 hover:bg-gray-100 p-2 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto pr-2 flex-1">
                            <div className="space-y-4 mb-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Blueprint Name *</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className="w-full border rounded-lg p-2"
                                            placeholder="e.g. JEE Main Mock Pattern"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Question Source</label>
                                        <select
                                            value={generationMethod}
                                            onChange={e => setGenerationMethod(e.target.value as any)}
                                            className="w-full border rounded-lg p-2 bg-white"
                                        >
                                            <option value="pull_existing">Pull from Question Bank</option>
                                            <option value="generate_novel">✨ Generate Novel AI Questions (RAG)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                        <textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            className="w-full border rounded-lg p-2 h-[88px]"
                                            placeholder="Optional description"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Authorized Knowledge Base Materials (RAG)
                                        </label>
                                        <div className="w-full border rounded-lg p-2 bg-white h-[88px] overflow-y-auto">
                                            {referenceMaterials.length === 0 ? (
                                                <div className="text-xs text-gray-500 italic mt-2">No library materials uploaded yet.</div>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    {referenceMaterials.map(mat => (
                                                        <label key={mat.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedMaterialIds.includes(mat.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) setSelectedMaterialIds([...selectedMaterialIds, mat.id]);
                                                                    else setSelectedMaterialIds(selectedMaterialIds.filter(id => id !== mat.id));
                                                                }}
                                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="truncate flex-1">{mat.title}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                                    <span className="text-xl">✨</span> AI Blueprint Architect
                                </label>
                                <p className="text-xs text-blue-700 mb-3">
                                    Describe your ideal exam structure OR upload images of a Syllabus table & Mark Distribution.
                                    The AI will extract chapters, map distributions, and automatically generate missing Topic Tags.
                                </p>

                                {/* Image Dropzone */}
                                <div
                                    className="mb-3 border-2 border-dashed border-blue-300 rounded-lg p-4 text-center bg-white hover:bg-blue-50/50 transition cursor-pointer"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleImageDrop}
                                    onClick={() => document.getElementById('blueprintImageUpload')?.click()}
                                >
                                    <input
                                        type="file"
                                        id="blueprintImageUpload"
                                        className="hidden"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageDrop}
                                    />
                                    <div className="text-sm text-blue-600 font-medium">Click to upload Syllabus & Distribution images</div>
                                    <div className="text-xs text-blue-400 mt-1">or drag & drop here (e.g. PNG, JPG)</div>
                                </div>

                                {/* Image Previews */}
                                {aiImagePreviews.length > 0 && (
                                    <div className="flex flex-wrap gap-3 mb-4">
                                        {aiImagePreviews.map((preview, idx) => (
                                            <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-blue-200 shadow-sm">
                                                <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleGenerateWithAi()}
                                        className="flex-1 border-blue-200 rounded-lg p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Type extra instructions here (optional if images provided)..."
                                        disabled={isGeneratingBlueprint}
                                    />
                                    <button
                                        onClick={handleSavePrompt}
                                        disabled={isGeneratingBlueprint || !aiPrompt.trim()}
                                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
                                        title="Save this prompt as a custom template"
                                    >
                                        ⭐
                                    </button>
                                    <button
                                        onClick={handleGenerateWithAi}
                                        disabled={isGeneratingBlueprint || !aiPrompt.trim()}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition"
                                    >
                                        {isGeneratingBlueprint ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Designing...</>
                                        ) : (
                                            'Generate'
                                        )}
                                    </button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 items-center">
                                    <span className="text-xs font-semibold text-blue-800">Quick Templates:</span>
                                    <button
                                        onClick={() => setAiPrompt("Create a 200 question full-length NEET Mock Exam. Section A: Physics (50q, MCQ, +4/-1). Section B: Chemistry (50q, MCQ, +4/-1). Section C: Botany (50q, MCQ, +4/-1). Section D: Zoology (50q, MCQ, +4/-1).")}
                                        className="text-[10px] bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 px-2 py-1 rounded-full transition"
                                    >
                                        🩺 NEET Mock
                                    </button>
                                    <button
                                        onClick={() => setAiPrompt("Create a 90 question JEE Main Mock Exam. Section 1: Physics (20 MCQ, +4/-1, and 10 Numerical, +4/-1). Section 2: Chemistry (20 MCQ, 10 Numerical, same marks). Section 3: Mathematics (20 MCQ, 10 Numerical, same marks).")}
                                        className="text-[10px] bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 px-2 py-1 rounded-full transition"
                                    >
                                        📐 JEE Main
                                    </button>
                                    <button
                                        onClick={() => setAiPrompt("Create a 100 question UPSC Civil Services Prelims Mock Exam (GS Paper 1). 100 MCQs total. Sections: History, Geography, Polity, Economy, Science & Tech. All marks +2/-0.66.")}
                                        className="text-[10px] bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 px-2 py-1 rounded-full transition"
                                    >
                                        🏛️ UPSC Prelims
                                    </button>
                                </div>

                                {savedPrompts.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2 items-center border-t border-blue-100 pt-3">
                                        <span className="text-xs font-semibold text-blue-800">My Saved Templates:</span>
                                        {savedPrompts.map(p => (
                                            <div key={p.id} className="group relative flex items-center">
                                                <button
                                                    onClick={() => setAiPrompt((p as any).promptText || p.prompt)}
                                                    className="text-[10px] bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 px-3 py-1 rounded-full transition pr-6"
                                                    title={(p as any).promptText || p.prompt}
                                                >
                                                    ⭐ {p.name}
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeletePrompt(p.id, e)}
                                                    className="absolute right-1.5 text-indigo-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Delete this template"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {generationMethod === 'generate_novel' && (
                                <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg text-purple-800 text-sm flex gap-3">
                                    <div className="mt-0.5">✨</div>
                                    <div>
                                        <strong>AI Generation Mode Active:</strong> This blueprint will dynamically write brand new questions based on your defined tags by scanning the uploaded PDF Knowledge Base. Number of requested questions can exceed bank limits.
                                    </div>
                                </div>
                            )}

                            <div className="mb-6 space-y-6">
                                {sections.map((sec, secIdx) => (
                                    <div key={secIdx} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                                            <div className="flex items-center gap-3 flex-1">
                                                <span className="font-semibold text-gray-700">Section {secIdx + 1}</span>
                                                <input
                                                    type="text"
                                                    value={sec.name.en}
                                                    onChange={e => updateSectionName(secIdx, e.target.value)}
                                                    placeholder="Section Name"
                                                    className="border rounded p-1 text-sm flex-1 max-w-xs"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => addRule(secIdx)} className="text-sm text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-lg flex gap-1 items-center bg-white border">
                                                    <Plus className="w-4 h-4" /> Add Rule
                                                </button>
                                                {sections.length > 1 && (
                                                    <button onClick={() => removeSection(secIdx)} className="text-sm text-red-500 hover:bg-red-50 p-1.5 rounded-lg border bg-white">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white">
                                            {sec.rules.length === 0 ? (
                                                <div className="text-center text-gray-400 py-4 text-sm">No rules in this section.</div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {sec.rules.map((rule: any, ruleIdx: number) => (
                                                        <div key={ruleIdx} className="flex flex-wrap gap-4 items-end p-4 border rounded-lg bg-gray-50 relative">

                                                            <div className="w-64 relative">
                                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Topic Tags (Multi-Select)</label>

                                                                {/* Selected Tags Pills */}
                                                                <div className="flex flex-wrap gap-1 mb-1">
                                                                    {rule.topicTags?.map((tagId: string) => {
                                                                        const t = tags.find(x => x.id === tagId);
                                                                        if (!t) return null;
                                                                        return (
                                                                            <span key={tagId} className="inline-flex items-center text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                                                {t.name}
                                                                                <button onClick={() => removeTag(secIdx, ruleIdx, tagId)} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button>
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>

                                                                <div className="relative">
                                                                    <div className="flex items-center border rounded bg-white mt-1">
                                                                        <Search className="w-4 h-4 ml-2 text-gray-400" />
                                                                        <input
                                                                            type="text"
                                                                            value={searchTagTerm[`${secIdx}-${ruleIdx}`] !== undefined ? searchTagTerm[`${secIdx}-${ruleIdx}`] : ''}
                                                                            onChange={e => {
                                                                                setSearchTagTerm({ ...searchTagTerm, [`${secIdx}-${ruleIdx}`]: e.target.value });
                                                                                setShowTagDropdown({ ...showTagDropdown, [`${secIdx}-${ruleIdx}`]: true });
                                                                            }}
                                                                            onFocus={() => setShowTagDropdown({ ...showTagDropdown, [`${secIdx}-${ruleIdx}`]: true })}
                                                                            className="w-full p-2 text-sm outline-none"
                                                                            placeholder="Search Tag..."
                                                                        />
                                                                    </div>
                                                                    {showTagDropdown[`${secIdx}-${ruleIdx}`] && (
                                                                        <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                                                            {tags.filter(t => t.name.toLowerCase().includes((searchTagTerm[`${secIdx}-${ruleIdx}`] || '').toLowerCase())).map(t => (
                                                                                <div
                                                                                    key={t.id}
                                                                                    className={`px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer ${rule.topicTags?.includes(t.id) ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}
                                                                                    onClick={() => selectTag(secIdx, ruleIdx, t.id, t.name)}
                                                                                >
                                                                                    {t.name} {rule.topicTags?.includes(t.id) && '✓'}
                                                                                </div>
                                                                            ))}
                                                                            {tags.filter(t => t.name.toLowerCase().includes((searchTagTerm[`${secIdx}-${ruleIdx}`] || '').toLowerCase())).length === 0 && (
                                                                                <div className="px-3 py-2 text-sm text-gray-500">No tags found</div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="w-36">
                                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Question Type</label>
                                                                <select
                                                                    value={rule.questionType}
                                                                    onChange={e => updateRule(secIdx, ruleIdx, 'questionType', e.target.value)}
                                                                    className="w-full border rounded p-2 text-sm bg-white"
                                                                >
                                                                    <option value="mcq_single">MCQ Single</option>
                                                                    <option value="mcq_multiple">MCQ Multiple</option>
                                                                    <option value="fill_blank">Fill in the Blank</option>
                                                                    <option value="numerical">Numerical</option>
                                                                    <option value="true_false">True / False</option>
                                                                    <option value="short_answer">Short Answer</option>
                                                                    <option value="long_answer">Long Answer</option>
                                                                </select>
                                                            </div>

                                                            <div className="w-20">
                                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Count</label>
                                                                <input
                                                                    type="number"
                                                                    value={rule.numberOfQuestions}
                                                                    onChange={e => updateRule(secIdx, ruleIdx, 'numberOfQuestions', e.target.value)}
                                                                    className="w-full border rounded p-2 text-sm"
                                                                    min="1"
                                                                />
                                                            </div>

                                                            <div className="w-24">
                                                                <label className="block text-xs font-semibold text-gray-600 mb-1">+ Marks</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.5"
                                                                    value={rule.marksPerQuestion}
                                                                    onChange={e => updateRule(secIdx, ruleIdx, 'marksPerQuestion', e.target.value)}
                                                                    className="w-full border rounded p-2 text-sm"
                                                                    min="0.5"
                                                                />
                                                            </div>

                                                            <div className="w-24">
                                                                <label className="block text-xs font-semibold text-gray-600 mb-1">- Marks</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={rule.negativeMarks}
                                                                    onChange={e => updateRule(secIdx, ruleIdx, 'negativeMarks', e.target.value)}
                                                                    className="w-full border rounded p-2 text-sm"
                                                                    min="0"
                                                                />
                                                            </div>

                                                            <div className="w-24">
                                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Difficulty</label>
                                                                <input
                                                                    type="number"
                                                                    value={rule.difficulty}
                                                                    onChange={e => updateRule(secIdx, ruleIdx, 'difficulty', e.target.value ? Number(e.target.value) : '')}
                                                                    className="w-full border rounded p-2 text-sm"
                                                                    min="1" max="5" placeholder="1-5"
                                                                />
                                                            </div>

                                                            <div className="absolute right-2 top-2 flex flex-col gap-1">
                                                                <button
                                                                    onClick={() => duplicateRule(secIdx, ruleIdx)}
                                                                    className="text-gray-400 hover:text-blue-500 hover:bg-white rounded p-1 shadow-sm transition"
                                                                    title="Duplicate Rule"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => removeRule(secIdx, ruleIdx)}
                                                                    className="text-red-400 hover:text-red-600 hover:bg-white rounded p-1 shadow-sm transition"
                                                                    title="Remove Rule"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <button onClick={addSection} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-blue-600 font-medium transition flex justify-center items-center gap-2">
                                    <Plus className="w-5 h-5" /> Add Another Section
                                </button>
                            </div>
                        </div>

                        {/* Footer Totals & Save */}
                        <div className="flex justify-between items-center mt-6 pt-4 border-t bg-white">
                            <div className="flex gap-6 text-sm">
                                <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-lg font-bold">
                                    Total Questions: {totalQuestions}
                                </div>
                                <div className="bg-green-50 text-green-800 px-4 py-2 rounded-lg font-bold">
                                    Total Marks: {totalMarks}
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={closeModal} className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50 font-medium">
                                    Cancel
                                </button>
                                <button onClick={handleCreateBlueprint} className="px-4 py-2 bg-blue-600 text-white font-medium flex items-center gap-2 rounded-lg hover:bg-blue-700">
                                    <Save className="w-4 h-4" /> {editingBpId ? 'Save Changes' : 'Save Blueprint'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Blueprint Modal */}
            {viewingBp && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    {viewingBp.name}
                                    {viewingBp.generationMethod === 'generate_novel' && (
                                        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                            ✨ AI Native
                                        </span>
                                    )}
                                </h3>
                                {viewingBp.description && <p className="text-sm text-gray-500 mt-1">{viewingBp.description}</p>}
                            </div>
                            <button onClick={closeViewModal} className="text-gray-400 hover:bg-gray-100 hover:text-gray-600 p-2 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-y-auto px-6 py-6 flex-1 bg-gray-50">
                            <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><div className="w-1.5 h-4 bg-blue-500 rounded-full"></div> Blueprint Structure</h4>
                            {viewingBp.sections?.length > 0 ? (
                                <div className="space-y-6">
                                    {viewingBp.sections.map((section: any, idx: number) => {
                                        let secQ = 0; let secM = 0;
                                        section.rules?.forEach((r: any) => { secQ += r.numberOfQuestions; secM += (r.numberOfQuestions * r.marksPerQuestion); });
                                        return (
                                            <div key={section.id} className="bg-white border shadow-sm rounded-xl overflow-hidden">
                                                <div className="bg-gray-50/80 px-4 py-3 border-b flex justify-between items-center">
                                                    <h5 className="font-semibold text-gray-800">{section.name?.en || `Section ${idx + 1}`}</h5>
                                                    <div className="text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full border shadow-sm">
                                                        {secQ} Questions · {secM} Marks
                                                    </div>
                                                </div>
                                                <div className="p-0">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                                                            <tr>
                                                                <th className="px-4 py-3 font-medium">Topic/Tags</th>
                                                                <th className="px-4 py-3 font-medium">Type</th>
                                                                <th className="px-4 py-3 font-medium">Diff</th>
                                                                <th className="px-4 py-3 font-medium text-right">Qs</th>
                                                                <th className="px-4 py-3 font-medium text-right">Marks</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {section.rules?.map((rule: any) => (
                                                                <tr key={rule.id} className="hover:bg-gray-50/50 transition-colors">
                                                                    <td className="px-4 py-3">
                                                                        {rule.topicTags?.length > 0 ? (
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {rule.topicTags.map((tag: any) => (
                                                                                    <span key={tag.id} className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-medium border border-blue-100">
                                                                                        {tag.name}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        ) : <span className="text-gray-400 italic text-xs">Global Pool</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                                                                            {rule.questionType.replace('_', ' ')}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        {rule.difficulty ? (
                                                                            <div className="flex gap-0.5">
                                                                                {Array.from({ length: 5 }).map((_, i) => (
                                                                                    <div key={i} className={`w-1.5 h-3 rounded-sm ${i < rule.difficulty ? 'bg-orange-400' : 'bg-gray-200'}`} />
                                                                                ))}
                                                                            </div>
                                                                        ) : <span className="text-gray-400">-</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-medium text-gray-700">{rule.numberOfQuestions}</td>
                                                                    <td className="px-4 py-3 text-right text-gray-500">
                                                                        <div className="flex flex-col items-end leading-tight">
                                                                            <span className="text-green-600 font-medium">+{rule.marksPerQuestion}</span>
                                                                            {rule.negativeMarks > 0 && <span className="text-red-500 text-[10px]">-{rule.negativeMarks}</span>}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {(!section.rules || section.rules.length === 0) && (
                                                                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No rules defined for this section.</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-white border rounded-xl shadow-sm">
                                    <div className="w-12 h-12 bg-gray-100 text-gray-400 flex items-center justify-center rounded-full mx-auto mb-3">
                                        <Eye className="w-6 h-6" />
                                    </div>
                                    <h5 className="text-gray-900 font-medium">Empty Blueprint</h5>
                                    <p className="text-gray-500 text-sm mt-1">This blueprint has no sections or rules defined.</p>
                                </div>
                            )}
                        </div>
                        <div className="border-t border-gray-100 p-4 bg-white rounded-b-xl flex justify-between items-center">
                            <div className="text-xs text-gray-500">
                                Created By: <span className="font-medium text-gray-700">{viewingBp.createdBy?.name || 'Unknown'}</span>
                            </div>
                            <button onClick={closeViewModal} className="px-5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors text-sm">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
