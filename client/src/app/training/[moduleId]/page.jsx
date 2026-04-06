'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { trainingAPI } from '@/lib/api';
import PageHeader from '@/components/PageHeader';
import { BookOpen, CheckCircle, Lock, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TrainingModulePage() {
    const { moduleId } = useParams();
    const router = useRouter();
    const { isAuthenticated, user } = useAuthStore();
    
    const [module, setModule] = useState(null);
    const [progress, setProgress] = useState(null);
    const [masteries, setMasteries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated) return;
        
        const fetchModule = async () => {
            try {
                const res = await trainingAPI.getModuleDetails(moduleId);
                setModule(res.data.data.module);
                setProgress(res.data.data.progress);
                setMasteries(res.data.data.unitMasteries || []);
            } catch (err) {
                toast.error('Failed to load training module');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchModule();
    }, [moduleId, isAuthenticated]);

    if (loading) return <div className="p-8 text-center">Loading module...</div>;
    if (!module) return <div className="p-8 text-center text-red-500">Module not found</div>;

    const isMastered = (unitId) => masteries.find(m => m.unitId === unitId)?.status === 'mastered';
    const isUnlocked = (index, unitId) => {
        if (index === 0) return true; // First unit always unlocked
        const prevUnitId = module.units[index - 1].id;
        return isMastered(prevUnitId);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title={module.title} backLink="/assigned-work" />
            
            <main className="max-w-5xl mx-auto px-4 py-8">
                {/* Header Card */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{module.title}</h1>
                            <p className="text-slate-600 mt-2">{module.description}</p>
                            <div className="flex gap-4 mt-4 text-sm text-slate-500">
                                <span>{module.units.length} Units</span>
                                <span>Language: {module.language}</span>
                                {progress?.totalXP !== undefined && (
                                    <span className="text-amber-600 font-bold">{progress.totalXP} XP Earned</span>
                                )}
                            </div>
                        </div>
                        <div className="bg-emerald-50 rounded-full p-4">
                            <BookOpen className="w-8 h-8 text-emerald-600" />
                        </div>
                    </div>
                </div>

                {/* Units List */}
                <div className="space-y-6">
                    {module.units.map((unit, index) => {
                        const unlocked = isUnlocked(index, unit.id);
                        const mastery = masteries.find(m => m.unitId === unit.id);
                        
                        return (
                            <div key={unit.id} className={`bg-white rounded-xl border ${unlocked ? 'border-primary-200 shadow-sm' : 'border-slate-200 opacity-75'}`}>
                                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                                    <div className="flex items-center gap-3">
                                        {!unlocked ? (
                                            <Lock className="w-5 h-5 text-slate-400" />
                                        ) : mastery?.status === 'mastered' ? (
                                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                                        ) : (
                                            <PlayCircle className="w-5 h-5 text-primary-500" />
                                        )}
                                        <h2 className="text-lg font-bold text-slate-800">Unit {unit.unitNumber}: {unit.title}</h2>
                                    </div>
                                    <div className="text-sm">
                                        {mastery ? (
                                            <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full font-medium">
                                                Mastery: {Math.round(mastery.masteryScore)}%
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 text-xs">Unlock Threshold: {unit.unlockThreshold}%</span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="p-5">
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {unit.exercises.map((ex, i) => (
                                            <button
                                                key={ex.id}
                                                disabled={!unlocked}
                                                onClick={() => router.push(`/training/${moduleId}/exercise/${ex.id}`)}
                                                className={`p-4 text-left rounded-lg border ${!unlocked ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-primary-500 hover:shadow-md transition-all cursor-pointer'}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-bold text-slate-400">Exercise {i + 1}</span>
                                                    {ex.isReviewExercise && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Review</span>}
                                                </div>
                                                <h3 className="font-semibold text-slate-800 line-clamp-2">{ex.title}</h3>
                                                <div className="mt-3 flex justify-between text-xs text-slate-500">
                                                    <span className="capitalize">{ex.difficulty}</span>
                                                    <span className="text-amber-600">+{ex.xpReward} XP</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}
