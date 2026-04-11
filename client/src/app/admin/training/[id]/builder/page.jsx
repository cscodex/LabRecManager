'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft, Plus, ChevronDown, ChevronUp, Save, EyeOff,
    BookOpen, Layers, Target, Unlock, ShieldAlert, Award,
    Lightbulb, Trash2, Edit3, Lock, Trophy, CheckCircle,
    AlertTriangle, XCircle, Sparkles, FlaskConical, Eye,
    GripVertical, Send, Users, Calendar, Globe
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { trainingAPI, classesAPI } from '@/lib/api';
import toast from 'react-hot-toast';

// --- Pedagogy Score Engine ---
function computePedagogyScore(moduleData) {
    if (!moduleData?.units?.length) return { score: 0, checks: [], warnings: [], errors: [] };

    const checks = [];
    const warnings = [];
    const errors = [];
    let score = 0;

    const allExercises = moduleData.units.flatMap(u => u.exercises || []);
    const scaffoldLevels = allExercises.map(e => e.scaffoldLevel);
    const difficulties = allExercises.map(e => e.difficulty);
    const xpValues = allExercises.map(e => e.xpReward);
    const hasReview = allExercises.some(e => e.isReviewExercise);
    const hasProject = scaffoldLevels.includes('project');
    const hasHiddenTests = allExercises.some(e => {
        try { return JSON.parse(e.testCases || '[]').some(t => t.isHidden); } catch { return false; }
    });
    const uniqueScaffolds = [...new Set(scaffoldLevels)];
    const uniqueDifficulties = [...new Set(difficulties)];
    const uniqueXP = [...new Set(xpValues)];

    // Scaffold progression
    if (uniqueScaffolds.length >= 2) {
        checks.push('Scaffold progression present');
        score += 20;
    } else {
        warnings.push('Add varied scaffold levels (Guided → Independent)');
    }

    // Mastery gates
    const allGated = moduleData.units.every(u => u.unlockThreshold > 0);
    if (allGated) {
        checks.push('Mastery gates configured on all units');
        score += 15;
    } else {
        warnings.push('Configure mastery unlock thresholds on all units');
    }

    // Spaced repetition
    if (hasReview) {
        checks.push('Spaced repetition exercises included');
        score += 15;
    } else {
        warnings.push('Add review exercises for spaced repetition');
    }

    // Project/Capstone
    if (hasProject) {
        checks.push('Capstone project exercise exists');
        score += 15;
    } else {
        errors.push('No capstone/project exercise — add one for PBL');
    }

    // Hidden test cases (TDD awareness)
    if (hasHiddenTests) {
        checks.push('Hidden test cases for TDD awareness');
        score += 15;
    } else {
        errors.push('No hidden test cases — students won\'t learn edge-case thinking');
    }

    // XP variety
    if (uniqueXP.length >= 3) {
        checks.push('XP rewards are varied for engagement');
        score += 10;
    } else {
        warnings.push('Vary XP rewards (10→15→25→50) for engagement');
    }

    // Difficulty variety
    if (uniqueDifficulties.length >= 2) {
        checks.push('Difficulty levels are varied');
        score += 10;
    } else {
        warnings.push('Mix difficulty levels to maintain engagement');
    }

    return { score: Math.min(score, 100), checks, warnings, errors };
}

// --- Design Coach Tips ---
function getDesignTips(moduleData, activeUnit) {
    const tips = [];
    if (!moduleData?.units?.length) {
        tips.push({ icon: '🎯', text: 'Start by creating your first unit. Each unit should cover one topic or concept.' });
        return tips;
    }

    if (activeUnit) {
        const exercises = activeUnit.exercises || [];
        if (exercises.length === 0) {
            tips.push({ icon: '🎯', text: 'Start with a Guided exercise so students see the pattern before trying independently.' });
        }
        if (exercises.length > 0 && !exercises.some(e => e.isReviewExercise)) {
            tips.push({ icon: '🔄', text: 'Consider adding a Spaced Repetition exercise that revisits concepts from a previous unit.' });
        }
        const allSameDifficulty = exercises.length > 1 && new Set(exercises.map(e => e.difficulty)).size === 1;
        if (allSameDifficulty) {
            tips.push({ icon: '📈', text: 'Vary difficulty: start Beginner, end Advanced. This maintains engagement through progressive challenge.' });
        }
        const allFlatXP = exercises.length > 1 && new Set(exercises.map(e => e.xpReward)).size === 1;
        if (allFlatXP) {
            tips.push({ icon: '⚡', text: 'Increase XP for harder exercises. 10→15→25→50 is a good progression curve.' });
        }
    }

    if (!moduleData.units.flatMap(u => u.exercises || []).some(e => e.scaffoldLevel === 'project')) {
        tips.push({ icon: '🏗️', text: 'Every module benefits from a Capstone Project exercise — it\'s where real learning consolidation happens.' });
    }

    if (tips.length === 0) {
        tips.push({ icon: '✨', text: 'Looking good! Your course design follows strong pedagogical principles.' });
    }

    return tips;
}

// Scaffold level styling
const SCAFFOLD_STYLES = {
    guided: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', label: 'Guided' },
    semi_guided: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500', label: 'Semi-Guided' },
    independent: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', label: 'Independent' },
    project: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500', label: 'Capstone Project' },
};

const DIFFICULTY_STYLES = {
    beginner: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    intermediate: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    advanced: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
};


export default function PedagogyBuilderPage() {
    const router = useRouter();
    const { id } = useParams();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();

    const [moduleData, setModuleData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeUnitId, setActiveUnitId] = useState(null);

    // Modals
    const [showUnitModal, setShowUnitModal] = useState(false);
    const [unitForm, setUnitForm] = useState({ title: '', description: '', expectedHours: 5, unlockThreshold: 80, unitNumber: 1 });

    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [exerciseForm, setExerciseForm] = useState({
        title: '', description: '', theory: '', difficulty: 'beginner', scaffoldLevel: 'guided',
        isReviewExercise: false, timeLimit: 5, xpReward: 10, starterCode: '', solutionCode: '',
        testCases: [], hints: []
    });

    // Assign modal
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [classes, setClasses] = useState([]);
    const [selectedClasses, setSelectedClasses] = useState([]);
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [assignDeadline, setAssignDeadline] = useState('');
    const [assignNotes, setAssignNotes] = useState('');
    const [existingAssignments, setExistingAssignments] = useState([]);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) return;
        loadData();
    }, [isAuthenticated, _hasHydrated, id]);

    const loadData = async () => {
        try {
            const [modRes, classesRes] = await Promise.all([
                trainingAPI.getModuleDetails(id),
                classesAPI.getAll().catch(() => ({ data: { data: { classes: [] } } }))
            ]);
            const mod = modRes.data.data.module;
            setModuleData(mod);
            setClasses(classesRes.data?.data?.classes || []);
            setUnitForm(f => ({ ...f, unitNumber: (mod.units?.length || 0) + 1 }));
            if (!activeUnitId && mod.units?.length > 0) {
                setActiveUnitId(mod.units[0].id);
            }
            // Load existing assignments
            try {
                const assignRes = await trainingAPI.getModuleAssignments(id);
                setExistingAssignments(assignRes.data?.data?.assignments || []);
            } catch {}
        } catch (error) {
            toast.error('Failed to load builder data');
            router.push('/admin/training');
        } finally {
            setLoading(false);
        }
    };

    const activeUnit = useMemo(() => moduleData?.units?.find(u => u.id === activeUnitId), [moduleData, activeUnitId]);
    const pedagogyScore = useMemo(() => computePedagogyScore(moduleData), [moduleData]);
    const designTips = useMemo(() => getDesignTips(moduleData, activeUnit), [moduleData, activeUnit]);

    const handleCreateUnit = async () => {
        try {
            await trainingAPI.createUnit(id, unitForm);
            toast.success('Unit created with mastery gate');
            setShowUnitModal(false);
            setUnitForm({ title: '', description: '', expectedHours: 5, unlockThreshold: 80, unitNumber: (moduleData?.units?.length || 0) + 2 });
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error creating unit');
        }
    };

    const handleCreateExercise = async () => {
        if (!activeUnitId) return;
        try {
            // Merge theory into description if provided
            const fullDescription = exerciseForm.theory
                ? `## 📖 Learning Content\n\n${exerciseForm.theory}\n\n---\n\n## 🎯 Problem Statement\n\n${exerciseForm.description}`
                : exerciseForm.description;

            const payload = {
                ...exerciseForm,
                description: fullDescription,
                testCases: JSON.stringify(exerciseForm.testCases),
                hints: JSON.stringify(exerciseForm.hints),
            };
            delete payload.theory;
            await trainingAPI.createExercise(activeUnitId, payload);
            toast.success('Exercise deployed with pedagogy rules');
            setShowExerciseModal(false);
            setExerciseForm({
                title: '', description: '', theory: '', difficulty: 'beginner', scaffoldLevel: 'guided',
                isReviewExercise: false, timeLimit: 5, xpReward: 10, starterCode: '', solutionCode: '',
                testCases: [], hints: []
            });
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error adding exercise');
        }
    };

    // Test case helpers
    const addTestCase = () => setExerciseForm(f => ({ ...f, testCases: [...f.testCases, { input: '', expectedOutput: '', isHidden: false }] }));
    const removeTestCase = (idx) => setExerciseForm(f => ({ ...f, testCases: f.testCases.filter((_, i) => i !== idx) }));
    const updateTestCase = (idx, field, value) => setExerciseForm(f => ({
        ...f, testCases: f.testCases.map((tc, i) => i === idx ? { ...tc, [field]: value } : tc)
    }));

    // Hint helpers
    const addHint = () => setExerciseForm(f => ({ ...f, hints: [...f.hints, ''] }));
    const removeHint = (idx) => setExerciseForm(f => ({ ...f, hints: f.hints.filter((_, i) => i !== idx) }));
    const updateHint = (idx, value) => setExerciseForm(f => ({ ...f, hints: f.hints.map((h, i) => i === idx ? value : h) }));

    if (loading || !moduleData) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
        </div>
    );

    // --- Circular Score Gauge ---
    const ScoreGauge = ({ score }) => {
        const circumference = 2 * Math.PI * 40;
        const strokeDashoffset = circumference - (score / 100) * circumference;
        const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
        return (
            <div className="relative w-28 h-28 mx-auto">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                        style={{ transition: 'stroke-dashoffset 1s ease' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{score}</span>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">/100</span>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Top Bar */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push('/admin/training')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition">
                                <ArrowLeft className="w-5 h-5 text-slate-500" />
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">{moduleData.title}</h1>
                                    <span className={`badge text-[10px] ${moduleData.isPublished ? 'badge-success' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                        {moduleData.isPublished ? 'Published' : 'Draft'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Pedagogy Builder • {moduleData.language} • {moduleData.boardAligned || 'Custom'} Class {moduleData.classLevel || '—'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={async () => {
                                    try {
                                        await trainingAPI.togglePublish(id);
                                        toast.success(moduleData.isPublished ? 'Module unpublished' : 'Module published');
                                        loadData();
                                    } catch { toast.error('Failed to toggle publish'); }
                                }}
                                className={`btn text-sm ${moduleData.isPublished ? 'btn-secondary' : 'bg-emerald-600 hover:bg-emerald-500 text-white border-none'}`}
                            >
                                <Globe className="w-4 h-4" /> {moduleData.isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                            <button onClick={() => setShowAssignModal(true)} className="btn bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25 hover:shadow-xl text-sm">
                                <Send className="w-4 h-4" /> Assign to Class
                            </button>
                            <button onClick={() => setShowUnitModal(true)} className="btn btn-primary text-sm">
                                <Plus className="w-4 h-4" /> Add Unit
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3-Column Layout */}
            <div className="max-w-[1600px] mx-auto flex" style={{ height: 'calc(100vh - 65px)' }}>

                {/* Column 1: Course Flow Timeline */}
                <div className="w-[260px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-4">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Course Flow</h3>

                    {moduleData.units?.length === 0 ? (
                        <div className="text-center py-8">
                            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">No units yet</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {moduleData.units?.map((unit, idx) => {
                                const exerciseScaffolds = unit.exercises?.map(e => e.scaffoldLevel) || [];
                                const dominantScaffold = exerciseScaffolds[0] || 'guided';
                                const style = SCAFFOLD_STYLES[dominantScaffold] || SCAFFOLD_STYLES.guided;
                                const isActive = activeUnitId === unit.id;

                                return (
                                    <div key={unit.id}>
                                        {/* Mastery Gate */}
                                        {idx > 0 && (
                                            <div className="flex items-center justify-center py-1.5">
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                                    <Lock className="w-3 h-3" />
                                                    <span>≥ {unit.unlockThreshold}% mastery</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Unit Node */}
                                        <button
                                            onClick={() => setActiveUnitId(unit.id)}
                                            className={`w-full text-left p-3 rounded-xl transition-all ${
                                                isActive
                                                    ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 shadow-sm'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-7 h-7 rounded-lg ${style.bg} flex items-center justify-center shrink-0`}>
                                                    <span className={`text-xs font-bold ${style.text}`}>{unit.unitNumber}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-semibold truncate ${isActive ? 'text-primary-700 dark:text-primary-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                                        {unit.title}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                        {unit.exercises?.length || 0} exercises • {unit.expectedHours || '—'}h
                                                    </p>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Connector line */}
                                        {idx < moduleData.units.length - 1 && (
                                            <div className="flex justify-center">
                                                <div className="w-0.5 h-2 bg-slate-200 dark:bg-slate-700" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Certification milestone */}
                            <div className="flex items-center justify-center pt-2">
                                <div className="w-0.5 h-3 bg-slate-200 dark:bg-slate-700" />
                            </div>
                            <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                <Trophy className="w-4 h-4" />
                                <span>Certification</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setShowUnitModal(true)}
                        className="w-full mt-4 py-2.5 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-500 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                        + Add Unit
                    </button>
                </div>

                {/* Column 2: Exercise List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeUnit ? (
                        <>
                            {/* Unit Header */}
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{activeUnit.title}</h2>
                                <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
                                    <span>Unit {activeUnit.unitNumber}</span>
                                    <span>•</span>
                                    <span>{activeUnit.exercises?.length || 0} Exercises</span>
                                    <span>•</span>
                                    <span>{activeUnit.expectedHours || '—'} Hours</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                        <Unlock className="w-3.5 h-3.5" /> ≥ {activeUnit.unlockThreshold}% to unlock
                                    </span>
                                </div>
                            </div>

                            {/* Exercise Cards */}
                            <div className="space-y-3">
                                {activeUnit.exercises?.map((ex, i) => {
                                    const scaffoldStyle = SCAFFOLD_STYLES[ex.scaffoldLevel] || SCAFFOLD_STYLES.guided;
                                    const diffStyle = DIFFICULTY_STYLES[ex.difficulty] || DIFFICULTY_STYLES.beginner;
                                    let testCount = 0, hiddenCount = 0;
                                    try {
                                        const tests = JSON.parse(ex.testCases || '[]');
                                        testCount = tests.length;
                                        hiddenCount = tests.filter(t => t.isHidden).length;
                                    } catch {}
                                    let hintCount = 0;
                                    try { hintCount = JSON.parse(ex.hints || '[]').length; } catch {}

                                    return (
                                        <div key={ex.id} className="card p-4 group hover:border-primary-200 dark:hover:border-primary-800 transition-all">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-sm font-bold shrink-0">
                                                        {i + 1}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="font-semibold text-slate-900 dark:text-white truncate">{ex.title}</h4>
                                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${scaffoldStyle.bg} ${scaffoldStyle.text}`}>
                                                                {scaffoldStyle.label}
                                                            </span>
                                                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded border capitalize ${diffStyle}`}>
                                                                {ex.difficulty}
                                                            </span>
                                                            {ex.isReviewExercise && (
                                                                <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded font-bold">
                                                                    🔄 Spaced Repetition
                                                                </span>
                                                            )}
                                                        </div>
                                                        {/* Metadata row */}
                                                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                                                            {testCount > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <FlaskConical className="w-3 h-3" /> {testCount} tests
                                                                </span>
                                                            )}
                                                            {hiddenCount > 0 && (
                                                                <span className="flex items-center gap-1 text-amber-500">
                                                                    <EyeOff className="w-3 h-3" /> {hiddenCount} hidden
                                                                </span>
                                                            )}
                                                            {hintCount > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <Lightbulb className="w-3 h-3" /> {hintCount} hints
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                                                        <Award className="w-3.5 h-3.5" /> +{ex.xpReward} XP
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Add Exercise Button */}
                            <button
                                onClick={() => setShowExerciseModal(true)}
                                className="w-full mt-4 py-4 border-2 border-dashed border-primary-200 dark:border-primary-800 rounded-2xl text-primary-600 dark:text-primary-400 font-medium hover:bg-primary-50 dark:hover:bg-primary-900/20 transition text-sm"
                            >
                                + Add Pedagogy Exercise
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <Layers className="w-16 h-16 text-slate-200 dark:text-slate-700 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Select a Unit</h3>
                            <p className="text-slate-500 mt-1 max-w-sm">Click on a unit from the course flow timeline to view and manage its exercises.</p>
                        </div>
                    )}
                </div>

                {/* Column 3: Design Coach Sidebar */}
                <div className="w-[280px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-4 space-y-5">
                    {/* Pedagogy Score */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5" /> Pedagogy Score
                        </h3>
                        <ScoreGauge score={pedagogyScore.score} />
                    </div>

                    {/* Checklist */}
                    <div className="space-y-2">
                        {pedagogyScore.checks.map((c, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                <span className="text-slate-600 dark:text-slate-400">{c}</span>
                            </div>
                        ))}
                        {pedagogyScore.warnings.map((w, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                <span className="text-slate-600 dark:text-slate-400">{w}</span>
                            </div>
                        ))}
                        {pedagogyScore.errors.map((e, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                                <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                                <span className="text-slate-600 dark:text-slate-400">{e}</span>
                            </div>
                        ))}
                    </div>

                    {/* Design Tips */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5" /> Design Coach
                        </h3>
                        <div className="space-y-2.5">
                            {designTips.map((tip, i) => (
                                <div key={i} className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 text-xs text-primary-800 dark:text-primary-300 leading-relaxed">
                                    <span className="mr-1">{tip.icon}</span> {tip.text}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ====== EXERCISE BUILDER MODAL ====== */}
            {showExerciseModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Exercise Architecture</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Design a pedagogically sound exercise with scaffolding, hints, and test cases</p>
                        </div>

                        {/* Body */}
                        <div className="p-5 overflow-y-auto space-y-5">
                            {/* Section 1: Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Problem Title *</label>
                                    <input type="text" className="input" value={exerciseForm.title}
                                        onChange={e => setExerciseForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="e.g., Build a Calculator" />
                                </div>
                                <div>
                                    <label className="label">XP Reward</label>
                                    <div className="relative">
                                        <Award className="w-4 h-4 absolute left-3 top-3.5 text-amber-500" />
                                        <input type="number" className="input pl-9" value={exerciseForm.xpReward}
                                            onChange={e => setExerciseForm(f => ({ ...f, xpReward: parseInt(e.target.value) || 10 }))} />
                                    </div>
                                </div>
                            </div>
                            {/* Learning Content (Theory / Teaching Material) */}
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-4">
                                <label className="label flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
                                    <BookOpen className="w-4 h-4" /> Learning Content (Theory)
                                </label>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-2">Explain the concept before the student attempts. This is shown as the teaching portion.</p>
                                <textarea className="input h-24 font-mono text-sm border-white dark:border-slate-700" value={exerciseForm.theory}
                                    onChange={e => setExerciseForm(f => ({ ...f, theory: e.target.value }))}
                                    placeholder="e.g., An if-else statement lets you run different code based on a condition. Syntax:\n\nif condition:\n    # do something\nelse:\n    # do something else" />
                            </div>
                            <div>
                                <label className="label">Problem Statement (What students must solve)</label>
                                <textarea className="input h-20 font-mono text-sm" value={exerciseForm.description}
                                    onChange={e => setExerciseForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Write exercise instructions..." />
                            </div>

                            {/* Section 2: Pedagogy Layer */}
                            <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-primary-700 dark:text-primary-400" />
                                    <h4 className="font-bold text-sm text-primary-900 dark:text-primary-300">Pedagogy Design Layer</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-primary-800 dark:text-primary-400 mb-1 block">Scaffold Level</label>
                                        <select className="input border-white dark:border-slate-700" value={exerciseForm.scaffoldLevel}
                                            onChange={e => setExerciseForm(f => ({ ...f, scaffoldLevel: e.target.value }))}>
                                            <option value="guided">🟢 Guided (Heavy boilerplate)</option>
                                            <option value="semi_guided">🔵 Semi-Guided (Skeleton code)</option>
                                            <option value="independent">🟠 Independent (Blank canvas)</option>
                                            <option value="project">🟣 Capstone Project (Complex)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wider text-primary-800 dark:text-primary-400 mb-1 block">Spaced Repetition</label>
                                        <select className="input border-white dark:border-slate-700"
                                            value={exerciseForm.isReviewExercise ? 'true' : 'false'}
                                            onChange={e => setExerciseForm(f => ({ ...f, isReviewExercise: e.target.value === 'true' }))}>
                                            <option value="false">Standard Novel Exercise</option>
                                            <option value="true">🔄 Review / Spaced Repetition</option>
                                        </select>
                                    </div>
                                </div>
                                {/* Difficulty pills */}
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-primary-800 dark:text-primary-400 mb-2 block">Difficulty</label>
                                    <div className="flex gap-2">
                                        {['beginner', 'intermediate', 'advanced'].map(d => (
                                            <button key={d}
                                                onClick={() => setExerciseForm(f => ({ ...f, difficulty: d }))}
                                                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition capitalize ${
                                                    exerciseForm.difficulty === d
                                                        ? d === 'beginner' ? 'bg-emerald-500 text-white border-emerald-500'
                                                        : d === 'intermediate' ? 'bg-amber-500 text-white border-amber-500'
                                                        : 'bg-red-500 text-white border-red-500'
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                                }`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Code Editors */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Starter Code</label>
                                    <textarea className="w-full h-28 bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                        value={exerciseForm.starterCode}
                                        onChange={e => setExerciseForm(f => ({ ...f, starterCode: e.target.value }))}
                                        placeholder="# Starter code for students..." />
                                </div>
                                <div>
                                    <label className="label">Solution Code</label>
                                    <textarea className="w-full h-28 bg-slate-900 text-blue-400 font-mono text-xs p-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                                        value={exerciseForm.solutionCode}
                                        onChange={e => setExerciseForm(f => ({ ...f, solutionCode: e.target.value }))}
                                        placeholder="# Solution code (hidden from students)..." />
                                </div>
                            </div>

                            {/* Section 4: Visual Test Case Builder */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="label flex items-center gap-2 mb-0">
                                        <ShieldAlert className="w-4 h-4 text-primary-500" /> Test Cases
                                    </label>
                                    <span className="text-[10px] text-slate-400">Hidden tests teach edge-case thinking</span>
                                </div>
                                <div className="space-y-2">
                                    {exerciseForm.testCases.map((tc, idx) => (
                                        <div key={idx} className={`flex items-center gap-2 p-2 rounded-lg border ${tc.isHidden ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
                                            <input type="text" placeholder="Input" className="input py-2 text-xs flex-1"
                                                value={tc.input} onChange={e => updateTestCase(idx, 'input', e.target.value)} />
                                            <span className="text-slate-400 text-xs">→</span>
                                            <input type="text" placeholder="Expected Output" className="input py-2 text-xs flex-1"
                                                value={tc.expectedOutput} onChange={e => updateTestCase(idx, 'expectedOutput', e.target.value)} />
                                            <button
                                                onClick={() => updateTestCase(idx, 'isHidden', !tc.isHidden)}
                                                className={`px-2 py-1 rounded text-[10px] font-bold border transition ${
                                                    tc.isHidden
                                                        ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700'
                                                        : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
                                                }`}
                                                title={tc.isHidden ? 'Hidden from student' : 'Visible to student'}
                                            >
                                                {tc.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                            <button onClick={() => removeTestCase(idx)} className="p-1 text-slate-400 hover:text-red-500 transition">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={addTestCase} className="mt-2 text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline">
                                    + Add Test Case
                                </button>
                            </div>

                            {/* Section 5: Hint Chain */}
                            <div>
                                <label className="label flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-amber-500" /> Progressive Hints
                                </label>
                                <div className="space-y-2">
                                    {exerciseForm.hints.map((hint, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 w-6 text-center">{idx + 1}</span>
                                            <input type="text" className="input py-2 text-xs flex-1" placeholder={`Hint ${idx + 1}...`}
                                                value={hint} onChange={e => updateHint(idx, e.target.value)} />
                                            <button onClick={() => removeHint(idx)} className="p-1 text-slate-400 hover:text-red-500 transition">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={addHint} className="mt-2 text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline">
                                    + Add Hint
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex gap-3 shrink-0">
                            <button onClick={() => setShowExerciseModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                            <button onClick={handleCreateExercise} className="btn btn-primary flex-1">Deploy Exercise</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ====== UNIT MODAL ====== */}
            {showUnitModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full shadow-xl border border-slate-200 dark:border-slate-800">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Course Unit Block</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Each unit represents a topic or concept in the learning path</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="label">Title</label>
                                <input type="text" className="input" value={unitForm.title} onChange={e => setUnitForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Control Flow" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Sequence #</label>
                                    <input type="number" className="input" value={unitForm.unitNumber} disabled />
                                </div>
                                <div>
                                    <label className="label">Time (Hrs)</label>
                                    <input type="number" className="input" value={unitForm.expectedHours} onChange={e => setUnitForm(f => ({ ...f, expectedHours: parseInt(e.target.value) || 5 }))} />
                                </div>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                <label className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 mb-1 block flex items-center gap-1">
                                    <Unlock className="w-3 h-3" /> Mastery Unlock %
                                </label>
                                <input type="number" className="input border-white dark:border-slate-700" value={unitForm.unlockThreshold}
                                    onChange={e => setUnitForm(f => ({ ...f, unlockThreshold: parseInt(e.target.value) || 80 }))} />
                                <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 leading-tight">
                                    💡 Research shows 80% is optimal — too low lets weak students skip ahead, too high causes frustration.
                                </p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                            <button onClick={() => setShowUnitModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                            <button onClick={handleCreateUnit} className="btn btn-primary flex-1">Save Block</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ====== ASSIGN TO CLASS/GROUP MODAL ====== */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Send className="w-5 h-5 text-primary-500" /> Assign Training to Students
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Select classes or groups to assign this training module. A deadline can be set to track completion.</p>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto">
                            {/* Select Classes */}
                            <div>
                                <label className="label flex items-center gap-2">
                                    <Users className="w-4 h-4 text-primary-500" /> Assign to Classes
                                </label>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                    {classes.length === 0 ? (
                                        <p className="text-xs text-slate-400">No classes found. Create classes first.</p>
                                    ) : classes.map(cls => (
                                        <label key={cls.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition">
                                            <input type="checkbox" className="rounded border-slate-300"
                                                checked={selectedClasses.includes(cls.id)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedClasses(p => [...p, cls.id]);
                                                    else setSelectedClasses(p => p.filter(c => c !== cls.id));
                                                }} />
                                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{cls.name}</span>
                                            {cls._count?.enrollments != null && (
                                                <span className="text-[10px] text-slate-400 ml-auto">{cls._count.enrollments} students</span>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Deadline */}
                            <div>
                                <label className="label flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-amber-500" /> Deadline (Optional)
                                </label>
                                <input type="datetime-local" className="input"
                                    value={assignDeadline}
                                    onChange={e => setAssignDeadline(e.target.value)} />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="label">Instructor Notes</label>
                                <textarea className="input h-16 text-sm" value={assignNotes}
                                    onChange={e => setAssignNotes(e.target.value)}
                                    placeholder="Optional: special instructions for students..." />
                            </div>

                            {/* Existing Assignments */}
                            {existingAssignments.length > 0 && (
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Already Assigned To</h4>
                                    <div className="space-y-1.5">
                                        {existingAssignments.map(a => (
                                            <div key={a.id} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {a.targets?.map((t, i) => (
                                                        <span key={i} className={`badge ${t.targetType === 'class' ? 'badge-primary' : 'badge-warning'}`}>
                                                            {t.className || t.groupName || t.targetType}
                                                        </span>
                                                    ))}
                                                </div>
                                                <span className="text-slate-400 shrink-0 ml-2">
                                                    {a.due_date ? `Due: ${new Date(a.due_date).toLocaleDateString()}` : 'No deadline'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex gap-3 shrink-0">
                            <button onClick={() => setShowAssignModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                            <button
                                onClick={async () => {
                                    if (selectedClasses.length === 0 && selectedGroups.length === 0) {
                                        toast.error('Select at least one class or group');
                                        return;
                                    }
                                    try {
                                        await trainingAPI.assignModule(id, {
                                            classIds: selectedClasses,
                                            groupIds: selectedGroups,
                                            deadline: assignDeadline || undefined,
                                            notes: assignNotes || undefined,
                                        });
                                        toast.success('Module assigned to selected classes!');
                                        setShowAssignModal(false);
                                        setSelectedClasses([]);
                                        setSelectedGroups([]);
                                        setAssignDeadline('');
                                        setAssignNotes('');
                                        loadData();
                                    } catch (err) {
                                        toast.error(err.response?.data?.message || 'Failed to assign');
                                    }
                                }}
                                className="btn btn-primary flex-1"
                            >
                                <Send className="w-4 h-4" /> Assign Module
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
