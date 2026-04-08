'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { trainingAPI } from '@/lib/api';
import PageHeader from '@/components/PageHeader';
import { GraduationCap, Clock, Award, ChevronRight, BookOpen, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function TrainingModulesPage() {
    const { user } = useAuthStore();
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progressMap, setProgressMap] = useState({});

    // Fetch modules. For a student, the backend returns everything for their school right now.
    // In the future, this is scoped by class.
    useEffect(() => {
        const fetchModules = async () => {
            try {
                // If API allows, we can fetch progress separately.
                // Currently, GET /api/training/modules just returns modules array.
                const res = await trainingAPI.getModules();
                
                if (res.data.success) {
                    setModules(res.data.data.modules);
                    // For student progress, we'd have to ping another route if it existed for bulk progress,
                    // but since the current backend returns `modules`, we will just display them.
                }
            } catch (error) {
                console.error('Error fetching training modules:', error);
                toast.error('Failed to load training modules');
            } finally {
                setLoading(false);
            }
        };

        fetchModules();
    }, []);

    // Helper to calculate completion percentage for display (mock for now for student scope until bulk progress route exists)
    const getModuleProgress = (moduleId) => {
        // Return 0 for now since we don't have bulk progress API
        return 0;
    };

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            <PageHeader 
                title="Training Modules" 
                description="Self-paced learning and programming modules"
                icon={GraduationCap}
            />

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
                </div>
            ) : modules.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-lg">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Training Modules Available</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        There are currently no published training modules for your school. Please check back later.
                    </p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modules.map((mod) => (
                        <Link key={mod.id} href={`/training/${mod.id}`}>
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col h-full">
                                <div className="h-4 bg-gradient-to-r from-primary-500 to-primary-600" />
                                
                                <div className="p-6 flex flex-col flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <BookOpen className="w-6 h-6" />
                                        </div>
                                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-full capitalize">
                                            {mod.language}
                                        </span>
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
                                        {mod.title}
                                    </h3>
                                    
                                    {mod.description && (
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-3 flex-1">
                                            {mod.description}
                                        </p>
                                    )}

                                    <div className="mt-auto space-y-4">
                                        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                                            <div className="flex items-center gap-1.5">
                                                <BookOpen className="w-4 h-4" />
                                                <span>{mod.totalUnits || mod._count?.units || 0} Units</span>
                                            </div>
                                        </div>

                                        {user?.role === 'student' && (
                                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center justify-between text-sm mb-2">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">Progress</span>
                                                    <span className="text-primary-600 dark:text-primary-400 font-bold">{getModuleProgress(mod.id)}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-primary-500 rounded-full transition-all duration-1000"
                                                        style={{ width: `${getModuleProgress(mod.id)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                            <span className="text-primary-600 dark:text-primary-400 font-semibold group-hover:underline">
                                                {user?.role === 'student' ? 'Continue Learning' : 'View Module'}
                                            </span>
                                            <ChevronRight className="w-5 h-5 text-primary-500 transform group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
