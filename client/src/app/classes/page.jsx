'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Users, GraduationCap, Search, Plus, Eye, UserPlus, Calendar, Lock } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ClassesPage() {
    const router = useRouter();
    const { t } = useTranslation('common');
    const { user, isAuthenticated, _hasHydrated, selectedSessionId, selectedSession, isReadOnlyMode } = useAuthStore();
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadClasses();
    }, [isAuthenticated, _hasHydrated, selectedSessionId]);

    const loadClasses = async () => {
        setLoading(true);
        try {
            const res = await api.get('/classes');
            setClasses(res.data.data.classes || []);
        } catch (error) {
            toast.error(t('common.noData'));
        } finally {
            setLoading(false);
        }
    };

    const filteredClasses = classes.filter(c =>
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.nameHindi?.includes(searchQuery)
    );

    const isAdmin = user?.role === 'admin' || user?.role === 'principal';

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">
                            ← {t('common.back')}
                        </Link>
                        <h1 className="text-xl font-semibold text-slate-900">{t('classes.title')}</h1>
                    </div>
                    {isAdmin && (
                        <Link href="/classes/create" className="btn btn-primary">
                            <Plus className="w-4 h-4" />
                            {t('classes.addClass')}
                        </Link>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Session Indicator */}
                {selectedSession && (
                    <div className={`rounded-xl p-4 mb-6 flex items-center justify-between ${isReadOnlyMode
                        ? 'bg-amber-50 border border-amber-200'
                        : 'bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200'
                        }`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isReadOnlyMode ? 'bg-amber-100' : 'bg-primary-100'
                                }`}>
                                <Calendar className={`w-5 h-5 ${isReadOnlyMode ? 'text-amber-600' : 'text-primary-600'}`} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-900">
                                        {selectedSession.yearLabel}
                                    </span>
                                    {selectedSession.isCurrent ? (
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                                            {t('classes.currentSession')}
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium flex items-center gap-1">
                                            <Lock className="w-3 h-3" />
                                            {t('classes.historical')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500">
                                    {new Date(selectedSession.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} - {new Date(selectedSession.endDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500">
                            {t('classes.sessionHint')}
                        </p>
                    </div>
                )}

                {/* Search */}
                <div className="card p-4 mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder={t('classes.searchClasses')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input pl-10"
                        />
                    </div>
                </div>

                {/* Classes Grid */}
                {filteredClasses.length === 0 ? (
                    <div className="card p-12 text-center">
                        <GraduationCap className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-700 mb-2">{t('classes.noClassesFound')}</h3>
                        <p className="text-slate-500">
                            {isAdmin ? t('classes.createFirst') : t('classes.noClassesAvailable')}
                        </p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredClasses.map((cls) => (
                            <div key={cls.id} className="card card-hover p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-lg">
                                        {cls.gradeLevel}
                                        {cls.section && <span className="text-sm ml-0.5">{cls.section}</span>}
                                    </div>
                                    <span className="text-sm text-slate-500">{cls.stream || t('classes.general')}</span>
                                </div>

                                <h3 className="text-lg font-semibold text-slate-900 mb-1">{cls.name}</h3>
                                {cls.nameHindi && (
                                    <p className="text-sm text-slate-600 mb-3">{cls.nameHindi}</p>
                                )}

                                <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                                    <span className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        {cls._count?.enrollments || 0} {t('classes.students')}
                                    </span>
                                </div>

                                {cls.classTeacher && (
                                    <p className="text-sm text-slate-600 mb-4">
                                        {t('classes.teacher')}: {cls.classTeacher.firstName} {cls.classTeacher.lastName}
                                    </p>
                                )}

                                <div className="flex gap-2 pt-4 border-t border-slate-100">
                                    <Link
                                        href={`/classes/${cls.id}`}
                                        className="btn btn-ghost flex-1 text-sm"
                                    >
                                        <Eye className="w-4 h-4" />
                                        {t('classes.view')}
                                    </Link>
                                    {isAdmin && (
                                        <Link
                                            href={`/classes/${cls.id}/students`}
                                            className="btn btn-primary flex-1 text-sm"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                            {t('classes.students')}
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
