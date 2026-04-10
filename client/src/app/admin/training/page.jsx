'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus, BookOpen, GraduationCap, ChevronRight, Edit3, Trash2, 
    BookCheck, AlertCircle, Sparkles, MoveRight
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { trainingAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';

export default function AdminTrainingModules() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [form, setForm] = useState({
        title: '',
        titleHindi: '',
        description: '',
        language: 'python',
        boardAligned: 'PSEB',
        classLevel: 11
    });

    const isAdmin = user?.role === 'admin' || user?.role === 'principal' || user?.role === 'instructor';

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (!isAdmin) { router.push('/dashboard'); return; }
        loadModules();
    }, [isAuthenticated, _hasHydrated, isAdmin]);

    const loadModules = async () => {
        setLoading(true);
        try {
            const res = await trainingAPI.getModules();
            setModules(res.data.data.modules || []);
        } catch (error) {
            console.error('Error loading training modules:', error);
            toast.error('Failed to load training modules');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!form.title || !form.language) {
            toast.error('Title and language are required');
            return;
        }

        try {
            const res = await trainingAPI.createModule(form);
            toast.success('Module created successfully');
            setShowCreateModal(false);
            router.push(`/admin/training/${res.data.data.module.id}/builder`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create module');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <PageHeader title="Training Module Builder" titleHindi="प्रशिक्षण मॉड्यूल निर्माता">
                <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                    <Plus className="w-4 h-4" /> Create New Module
                </button>
            </PageHeader>

            <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6 border-b border-slate-200">
                <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-indigo-900">Pedagogy Design Engine</h3>
                        <p className="text-sm text-indigo-800/80 mt-1">
                            Build industry-standard pedagogy courses utilizing Mastery-based Progression, Scaffolded Learning, Spaced Repetition, and AI Socratic Feedback. Modules created here can be formally assigned to classes in the Assignments tab.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modules.length === 0 && !loading && (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-white border border-slate-200 border-dashed rounded-xl">
                            <GraduationCap className="w-12 h-12 text-slate-300 mb-3" />
                            <h3 className="text-lg font-medium text-slate-900">No Modules Yet</h3>
                            <p className="text-slate-500 max-w-sm mt-1">Create your first pedagogy-aligned training module to get started.</p>
                            <button onClick={() => setShowCreateModal(true)} className="mt-4 btn bg-white border border-slate-300 text-slate-700">
                                Create Module
                            </button>
                        </div>
                    )}
                    
                    {modules.map(mod => (
                        <div key={mod.id} className="card p-5 group flex flex-col hover:border-indigo-300 transition-all cursor-pointer" onClick={() => router.push(`/admin/training/${mod.id}/builder`)}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wider ${
                                    mod.language === 'python' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                }`}>
                                    {mod.language}
                                </div>
                                {!mod.isPublished && (
                                    <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                        <Edit3 className="w-3 h-3" /> Draft
                                    </span>
                                )}
                                {mod.isPublished && (
                                    <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                        <BookCheck className="w-3 h-3" /> Published
                                    </span>
                                )}
                            </div>
                            
                            <h3 className="text-lg font-bold text-slate-900 line-clamp-2">{mod.title}</h3>
                            {mod.boardAligned && (
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    {mod.boardAligned} mapped • Class {mod.classLevel}
                                </p>
                            )}
                            
                            <div className="mt-auto pt-6 flex items-center justify-between">
                                <div className="flex gap-4">
                                    <div className="text-center">
                                        <div className="text-xl font-bold text-slate-700">{mod._count?.units || 0}</div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Units</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xl font-bold text-slate-700">{mod.totalExercises}</div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Exercises</div>
                                    </div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
                                    <MoveRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Create Modal */}
            {showCreateModal && (
                 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                 <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
                     <div className="p-6 border-b border-slate-200">
                         <h3 className="text-xl font-semibold text-slate-900">Create Pedagogy Course</h3>
                     </div>
                     <div className="p-6 space-y-4">
                         <div>
                             <label className="text-sm font-medium text-slate-700 mb-1 block">Course Title *</label>
                             <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className="input w-full" placeholder="e.g., Python Architecture Phase 1" />
                         </div>
                         <div>
                             <label className="text-sm font-medium text-slate-700 mb-1 block">Language Engine *</label>
                             <select value={form.language} onChange={(e) => setForm(f => ({ ...f, language: e.target.value }))} className="input w-full">
                                 <option value="python">Python (Wandbox AI API)</option>
                                 <option value="html">HTML5 (Visual Render)</option>
                                 <option value="javascript">JavaScript (NodeJS)</option>
                             </select>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="text-sm font-medium text-slate-700 mb-1 block">Board Mapping</label>
                                 <input type="text" value={form.boardAligned} onChange={(e) => setForm(f => ({ ...f, boardAligned: e.target.value }))} className="input w-full" placeholder="PSEB" />
                             </div>
                             <div>
                                 <label className="text-sm font-medium text-slate-700 mb-1 block">Class Level</label>
                                 <input type="number" value={form.classLevel} onChange={(e) => setForm(f => ({ ...f, classLevel: e.target.value }))} className="input w-full" />
                             </div>
                         </div>
                     </div>
                     <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3">
                         <button onClick={() => setShowCreateModal(false)} className="btn bg-white border border-slate-300 text-slate-700 flex-1 hover:bg-slate-50">Cancel</button>
                         <button onClick={handleCreate} className="btn bg-indigo-600 text-white flex-1 hover:bg-indigo-700">Create & Enter Builder</button>
                     </div>
                 </div>
             </div>
            )}
        </div>
    );
}
