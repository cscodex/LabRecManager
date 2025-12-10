'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, GraduationCap, Search, Plus, Eye, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function ClassesPage() {
    const router = useRouter();
    const { user, isAuthenticated, accessToken, _hasHydrated } = useAuthStore();
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
    }, [isAuthenticated, _hasHydrated]);

    const loadClasses = async () => {
        try {
            const res = await axios.get('/api/classes', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setClasses(res.data.data.classes || []);
        } catch (error) {
            toast.error('Failed to load classes');
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
                            ← Back
                        </Link>
                        <h1 className="text-xl font-semibold text-slate-900">Classes</h1>
                    </div>
                    {isAdmin && (
                        <Link href="/classes/create" className="btn btn-primary">
                            <Plus className="w-4 h-4" />
                            Add Class
                        </Link>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Search */}
                <div className="card p-4 mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search classes..."
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
                        <h3 className="text-lg font-medium text-slate-700 mb-2">No classes found</h3>
                        <p className="text-slate-500">
                            {isAdmin ? 'Create your first class to get started.' : 'No classes available.'}
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
                                    <span className="text-sm text-slate-500">{cls.stream || 'General'}</span>
                                </div>

                                <h3 className="text-lg font-semibold text-slate-900 mb-1">{cls.name}</h3>
                                {cls.nameHindi && (
                                    <p className="text-sm text-slate-600 mb-3">{cls.nameHindi}</p>
                                )}

                                <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                                    <span className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        {cls._count?.enrollments || 0} students
                                    </span>
                                </div>

                                {cls.classTeacher && (
                                    <p className="text-sm text-slate-600 mb-4">
                                        Teacher: {cls.classTeacher.firstName} {cls.classTeacher.lastName}
                                    </p>
                                )}

                                <div className="flex gap-2 pt-4 border-t border-slate-100">
                                    <Link
                                        href={`/classes/${cls.id}`}
                                        className="btn btn-ghost flex-1 text-sm"
                                    >
                                        <Eye className="w-4 h-4" />
                                        View
                                    </Link>
                                    {isAdmin && (
                                        <Link
                                            href={`/classes/${cls.id}/students`}
                                            className="btn btn-primary flex-1 text-sm"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                            Students
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
