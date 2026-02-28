'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { formatDateTimeIST, getText } from '@/lib/utils';
import { Plus, Trash2, ChevronLeft, Save, X, Search, Edit2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminBlueprintsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated, language } = useAuthStore();
    const [blueprints, setBlueprints] = useState<any[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingBpId, setEditingBpId] = useState<string | null>(null);

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
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadData = async () => {
        try {
            const [bpRes, tagsRes] = await Promise.all([
                fetch('/api/admin/blueprints'),
                fetch('/api/admin/tags')
            ]);

            const bpData = await bpRes.json();
            const tagsData = await tagsRes.json();

            if (bpData.success) setBlueprints(bpData.data);
            if (tagsData.success) setTags(tagsData.tags);
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
                    sections
                })
            });

            const data = await res.json();
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

    const handleGenerateWithAi = async () => {
        if (!aiPrompt.trim()) {
            toast.error('Please enter a description for the AI');
            return;
        }

        setIsGeneratingBlueprint(true);
        const toastId = toast.loading('AI is designing the blueprint...');

        try {
            const res = await fetch('/api/ai/generate-blueprint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt })
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

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingBpId(null);
        setName('');
        setDescription('');
        setGenerationMethod('pull_existing');
        setSections([{ name: { en: 'Main Section', pa: 'ਮੁੱਖ ਭਾਗ' }, rules: [] }]);
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
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus className="w-4 h-4" />
                        Create Blueprint
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {blueprints.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center text-gray-500">
                        No blueprints created yet.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {blueprints.map(bp => {
                            let bpQ = 0; let bpM = 0;
                            bp.sections?.forEach((s: any) => {
                                s.rules?.forEach((r: any) => {
                                    bpQ += Number(r.numberOfQuestions);
                                    bpM += Number(r.numberOfQuestions) * Number(r.marksPerQuestion);
                                });
                            });

                            return (
                                <div key={bp.id} className="bg-white p-6 rounded-xl shadow-sm border relative group">
                                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditModal(bp)} className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-gray-100 transition">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deleteBlueprint(bp.id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 pr-16 flex items-center flex-wrap gap-2">
                                        <span>{bp.name}</span>
                                        {bp.generationMethod === 'generate_novel' && (
                                            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                                <span className="-mt-0.5">✨</span> AI Created
                                            </span>
                                        )}
                                    </h3>
                                    {bp.description && <p className="text-sm text-gray-500 mt-1">{bp.description}</p>}
                                    <div className="mt-4 flex gap-4 text-sm font-semibold text-blue-800">
                                        <span>{bp.sections?.length || 0} Sections</span>
                                        <span>{bpQ} Questions</span>
                                        <span>{bpM} Marks</span>
                                    </div>
                                    <div className="mt-4 pt-4 border-t">
                                        <p className="text-xs font-semibold text-gray-400 mb-2">SECTIONS</p>
                                        <ul className="text-sm text-gray-600 space-y-2">
                                            {bp.sections?.map((s: any) => (
                                                <li key={s.id}>
                                                    <span className="font-semibold text-gray-800">{getText(s.name, language)}:</span>
                                                    <span className="ml-2 text-xs text-gray-500">{s.rules?.length || 0} rules</span>
                                                    <div className="pl-4 mt-1 border-l-2 border-gray-100 text-[11px] text-gray-500 space-y-1">
                                                        {s.rules?.slice(0, 3).map((r: any, rIdx: number) => (
                                                            <div key={rIdx}>
                                                                {r.numberOfQuestions}x {r.questionType}
                                                                {r.topicTags && r.topicTags.length > 0 && (
                                                                    <span className="ml-1 text-blue-600">({r.topicTags.map((t: any) => t.name).join(', ')})</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {s.rules?.length > 3 && <div>...and {s.rules.length - 3} more</div>}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="mt-4 text-xs flex justify-between tracking-wide">
                                        <div className="text-gray-400">Created: {formatDateTimeIST(bp.createdAt)}</div>
                                        <div className="text-gray-400">Updated: {formatDateTimeIST(bp.updatedAt)}</div>
                                    </div>
                                </div>
                            );
                        })}
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
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        className="w-full border rounded-lg p-2"
                                        placeholder="Optional description"
                                        rows={2}
                                    />
                                </div>
                            </div>

                            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                                    <span className="text-xl">✨</span> AI Blueprint Architect
                                </label>
                                <p className="text-xs text-blue-700 mb-3">
                                    Describe your ideal exam (e.g. "Create a 50 question NEET mock for Physics & Chemistry with 3 hard sections"). Provide topic names and the AI will build the entire structure.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleGenerateWithAi()}
                                        className="flex-1 border-blue-200 rounded-lg p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                        placeholder="Type your blueprint instructions here..."
                                        disabled={isGeneratingBlueprint}
                                    />
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
        </div>
    );
}
