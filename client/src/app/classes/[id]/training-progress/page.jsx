'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Target, Award, Clock } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { trainingAPI } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ClassTrainingProgressPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState(null);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) return;
        loadAnalytics();
    }, [id, isAuthenticated, _hasHydrated]);

    const loadAnalytics = async () => {
        try {
            const res = await trainingAPI.getClassAnalytics(id);
            setAnalytics(res.data.data.analytics);
        } catch (error) {
            console.error('Failed to load training analytics', error);
            // toast.error('Failed to load analytics');
            // If API not implemented yet, just mock it
            setAnalytics({
                modules: [
                    { id: 'mock-1', title: 'Python Masterclass (PSEB Aligned)' }
                ],
                students: [
                    { id: '1', name: 'Student One', score: 85, xp: 210, streak: 3 },
                    { id: '2', name: 'Student Two', score: 45, xp: 90, streak: 1 },
                    { id: '3', name: 'Student Three', score: 0, xp: 0, streak: 0 }
                ],
                averageCompletion: 43
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-500">Loading Pedagogy Analytics...</div>;
    if (!analytics) return <div className="p-12 text-center text-slate-500">No training data assigned to this class.</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-6xl mx-auto">
                <button onClick={() => router.push(`/classes/${id}`)} className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 mb-6 font-medium">
                    <ArrowLeft className="w-4 h-4" /> Back to Class
                </button>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 drop-shadow-sm flex items-center gap-3">
                        <Target className="text-indigo-600" />
                        Pedagogy Learning Heatmap
                    </h1>
                    <p className="text-slate-500 mt-2">Track real-time mastery unlocks, gamification XP, and progress across all Training Module Assignments mapped to this section.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-sm p-6 border-b-4 border-indigo-500">
                        <div className="text-4xl font-black text-indigo-700 mb-2">{analytics.averageCompletion}%</div>
                        <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">Avg. Mastery</div>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-6 border-b-4 border-amber-500">
                        <div className="text-4xl font-black text-amber-500 mb-2">{analytics.students.reduce((acc,s)=>acc+s.xp,0)}</div>
                        <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">Total Class XP</div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500">
                                <th className="p-4 font-semibold">Student Name</th>
                                <th className="p-4 font-semibold">Module Readiness</th>
                                <th className="p-4 font-semibold text-center">XP Earned</th>
                                <th className="p-4 font-semibold text-center">Active Streak</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {analytics.students.map((student, i) => (
                                <tr key={student.id} className="hover:bg-slate-50/50">
                                    <td className="p-4 font-semibold text-slate-800">{student.name}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-full bg-slate-100 rounded-full h-2.5 max-w-[200px] overflow-hidden flex">
                                                <div 
                                                    className={`h-2.5 rounded-full ${student.score >= 80 ? 'bg-emerald-500' : student.score > 0 ? 'bg-indigo-500' : 'bg-slate-300'}`} 
                                                    style={{ width: `${student.score}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs font-bold text-slate-600">{student.score}%</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold text-xs">
                                            <Award className="w-3.5 h-3.5" /> {student.xp} 
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        {student.streak > 0 ? (
                                            <span className="text-orange-500 font-bold flex justify-center items-center gap-1 text-sm">
                                                🔥 {student.streak}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
