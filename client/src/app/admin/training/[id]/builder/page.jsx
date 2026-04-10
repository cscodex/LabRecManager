'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft, Plus, ChevronDown, ChevronUp, Save, EyeOff, 
    BookOpen, Layers, Target, Unlock, ShieldAlert, Award
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { trainingAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function PedagogyBuilderPage() {
    const router = useRouter();
    const { id } = useParams();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    
    const [moduleData, setModuleData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedUnit, setExpandedUnit] = useState(null);

    // Modals
    const [showUnitModal, setShowUnitModal] = useState(false);
    const [unitForm, setUnitForm] = useState({ title: '', description: '', expectedHours: 5, unlockThreshold: 80, unitNumber: 1 });
    
    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [activeUnitId, setActiveUnitId] = useState(null);
    const [exerciseForm, setExerciseForm] = useState({
        title: '', description: '', difficulty: 'beginner', scaffoldLevel: 'guided',
        isReviewExercise: false, timeLimit: 5, xpReward: 10, starterCode: '', testCases: '[]', hints: '[]'
    });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) return;
        loadData();
    }, [isAuthenticated, _hasHydrated, id]);

    const loadData = async () => {
        try {
            const res = await trainingAPI.getModuleDetails(id);
            setModuleData(res.data.data.module);
            setUnitForm(f => ({ ...f, unitNumber: (res.data.data.module.units?.length || 0) + 1 }));
        } catch (error) {
            toast.error('Failed to load builder data');
            router.push('/admin/training');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUnit = async () => {
        try {
            await trainingAPI.createUnit(id, unitForm);
            toast.success('Unit created. Mastery lock engaged.');
            setShowUnitModal(false);
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error creating unit');
        }
    };

    const handleCreateExercise = async () => {
        try {
            await trainingAPI.createExercise(activeUnitId, exerciseForm);
            toast.success('Exercise added with pedagogy rules');
            setShowExerciseModal(false);
            loadData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error adding exercise');
        }
    };

    if (loading || !moduleData) return <div className="p-8 text-center">Loading Engine...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/admin/training')} className="p-2 hover:bg-slate-100 rounded-lg">
                                <ArrowLeft className="w-5 h-5 text-slate-500" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold font-cal bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                    {moduleData.title}
                                </h1>
                                <p className="text-xs font-medium text-slate-500 mt-0.5 uppercase tracking-wider">
                                    Pedagogy Builder • {moduleData.language}
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setShowUnitModal(true)} className="btn bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Plus className="w-4 h-4" /> Add Training Unit
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 mt-8">
                {moduleData.units?.length === 0 ? (
                    <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed">
                        <Layers className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900">Start the Course Path</h3>
                        <p className="text-slate-500 mt-2">Create your first Unit to set up Mastery progressions.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {moduleData.units?.map((unit, uIdx) => (
                            <div key={unit.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div 
                                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                                    onClick={() => setExpandedUnit(expandedUnit === unit.id ? null : unit.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                            {unit.unitNumber}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">{unit.title}</h3>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                                <span className="flex items-center gap-1"><Unlock className="w-3 h-3 text-emerald-500" /> &ge; {unit.unlockThreshold}% Unlock</span>
                                                <span className="flex items-center gap-1"><Target className="w-3 h-3 text-orange-500" /> {unit.expectedHours} Hours</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-medium text-slate-600">{unit.exercises?.length || 0} Exercises</span>
                                        {expandedUnit === unit.id ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
                                    </div>
                                </div>
                                
                                {expandedUnit === unit.id && (
                                    <div className="border-t border-slate-100 p-5 bg-slate-50">
                                        <div className="space-y-3 mb-4">
                                            {unit.exercises?.map((ex, i) => (
                                                <div key={ex.id} className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">{i+1}</div>
                                                        <div className="font-semibold text-slate-800">{ex.title}</div>
                                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                                            ex.scaffoldLevel === 'guided' ? 'bg-green-100 text-green-700' :
                                                            ex.scaffoldLevel === 'project' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                            {ex.scaffoldLevel.replace('_', ' ')}
                                                        </span>
                                                        {ex.isReviewExercise && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">Spaced Repetition</span>}
                                                    </div>
                                                    <div className="text-xs font-bold text-amber-500 flex items-center gap-1">
                                                        <Award className="w-3.5 h-3.5" /> +{ex.xpReward} XP
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button 
                                            onClick={() => { setActiveUnitId(unit.id); setShowExerciseModal(true); }}
                                            className="w-full py-3 border border-indigo-200 border-dashed rounded-xl text-indigo-600 font-medium hover:bg-indigo-50 transition"
                                        >
                                            + Layer New Pedagogy Exercise
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Exercise Builder Modal */}
            {showExerciseModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 shadow-sm flex items-center justify-between bg-white z-10 shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 drop-shadow-sm">Exercise Architecture</h3>
                                <p className="text-xs text-slate-500 font-medium">Define parameters for automated Socratic evaluation</p>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto bg-slate-50/50 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-slate-700">Problem Title *</label>
                                    <input type="text" value={exerciseForm.title} onChange={e => setExerciseForm(f => ({ ...f, title: e.target.value }))} className="input w-full border-slate-300 focus:ring-indigo-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-slate-700">XP Reward / Gamification</label>
                                    <div className="relative">
                                        <Award className="w-4 h-4 absolute left-3 top-3 text-amber-500" />
                                        <input type="number" value={exerciseForm.xpReward} onChange={e => setExerciseForm(f => ({ ...f, xpReward: e.target.value }))} className="input w-full pl-9 border-slate-300" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-700">System Description (Markdown)</label>
                                <textarea value={exerciseForm.description} onChange={e => setExerciseForm(f => ({ ...f, description: e.target.value }))} className="input w-full h-24 font-mono text-sm" placeholder="Write instructions..." />
                            </div>

                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 space-y-4 shadow-inner">
                                <div className="flex items-center gap-2 mb-2">
                                    <BookOpen className="w-5 h-5 text-indigo-700" />
                                    <h4 className="font-bold text-indigo-900">Pedagogy Design Layer</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-indigo-800">Scaffold Level</label>
                                        <select value={exerciseForm.scaffoldLevel} onChange={e => setExerciseForm(f => ({ ...f, scaffoldLevel: e.target.value }))} className="input w-full border-white">
                                            <option value="guided">Guided (Heavy boilerplate & comments)</option>
                                            <option value="semi_guided">Semi-Guided (Skeleton code only)</option>
                                            <option value="independent">Independent (Blank canvas)</option>
                                            <option value="project">Capstone Project (Complex requirements)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-indigo-800">Spaced Repetition Trigger</label>
                                        <select value={exerciseForm.isReviewExercise ? 'true' : 'false'} onChange={e => setExerciseForm(f => ({ ...f, isReviewExercise: e.target.value === 'true' }))} className="input w-full border-white">
                                            <option value="false">Standard Novel Exercise</option>
                                            <option value="true">Act as Review/Spaced Repetition</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                    Test Cases (JSON) <ShieldAlert className="w-4 h-4 text-orange-500" title="Use isHidden: true for TDD Awareness" />
                                </label>
                                <textarea value={exerciseForm.testCases} onChange={e => setExerciseForm(f => ({ ...f, testCases: e.target.value }))} className="input w-full h-32 font-mono text-xs bg-slate-900 text-emerald-400" placeholder='[{"input":"5","expectedOutput":"10\n","isHidden":false}]' />
                                <p className="text-[10.5px] text-slate-500 font-medium">Format: Array of objects with `input`, `expectedOutput`, and `isHidden` bool.</p>
                            </div>

                        </div>
                        <div className="p-4 border-t border-slate-200 bg-slate-100 flex gap-3 shrink-0">
                            <button onClick={() => setShowExerciseModal(false)} className="btn bg-white border border-slate-300 text-slate-700 flex-1 hover:bg-slate-50 shadow-sm">Cancel</button>
                            <button onClick={handleCreateExercise} className="btn bg-indigo-600 text-white flex-1 hover:bg-indigo-700 shadow-md">Deploy Assignment Node</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Unit Modal */}
            {showUnitModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-900">Course Unit Block</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div><label className="text-sm font-medium mb-1 block">Title</label><input type="text" className="input w-full" value={unitForm.title} onChange={e => setUnitForm(f=>({...f, title: e.target.value}))}/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-sm font-medium mb-1 block">Sequence #</label><input type="number" className="input w-full" value={unitForm.unitNumber} disabled/></div>
                                <div><label className="text-sm font-medium mb-1 block">Time (Hrs)</label><input type="number" className="input w-full" value={unitForm.expectedHours} onChange={e => setUnitForm(f=>({...f, expectedHours: e.target.value}))}/></div>
                            </div>
                            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                <label className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1 block flex items-center gap-1"><Unlock className="w-3 h-3"/> Mastery Unlock %</label>
                                <input type="number" className="input w-full border-white" value={unitForm.unlockThreshold} onChange={e => setUnitForm(f=>({...f, unlockThreshold: e.target.value}))} />
                                <p className="text-[10px] font-medium text-emerald-600 mt-1 leading-tight">Students must score &ge; {unitForm.unlockThreshold}% in previous Unit to unlock this.</p>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-200 flex gap-3">
                            <button onClick={() => setShowUnitModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                            <button onClick={handleCreateUnit} className="btn btn-primary flex-1">Save Block</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
