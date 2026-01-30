
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Search, ArrowUpDown, ChevronRight, User } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface StudentStat {
    id: string;
    name: string;
    email: string;
    rollNumber: string;
    isActive: boolean;
    totalAttempts: number;
    avgScore: string;
    lastActive: string | null;
}

export default function StudentAnalyticsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [students, setStudents] = useState<StudentStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadStudents();
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadStudents = async () => {
        try {
            const response = await fetch('/api/admin/reports/students');
            if (response.status === 401) {
                toast.error('Session expired. Please login again.');
                router.push('/login');
                return;
            }
            const data = await response.json();
            if (data.success) {
                setStudents(data.students);
            }
        } catch (error) {
            toast.error('Failed to load student data');
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase())
    );

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            <header className="bg-white shadow-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <User className="w-6 h-6 text-indigo-600" />
                            Student Analytics
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">Performance summary across all students</p>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, roll number, or email..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                                <tr>
                                    <th className="px-6 py-3">Student</th>
                                    <th className="px-6 py-3">Roll Number</th>
                                    <th className="px-6 py-3">Attempts</th>
                                    <th className="px-6 py-3">Avg Score</th>
                                    <th className="px-6 py-3">Last Active</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            No students found matching your search.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((student) => (
                                        <tr key={student.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-3">
                                                <div className="font-medium text-gray-900">{student.name}</div>
                                                <div className="text-xs text-gray-500">{student.email}</div>
                                            </td>
                                            <td className="px-6 py-3 text-gray-600">{student.rollNumber || '-'}</td>
                                            <td className="px-6 py-3">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                    {student.totalAttempts}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 font-medium text-gray-900">{student.avgScore}</td>
                                            <td className="px-6 py-3 text-gray-500">
                                                {student.lastActive ? new Date(student.lastActive).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <Link
                                                    href={`/admin/reports/student/${student.id}`}
                                                    className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium text-xs"
                                                >
                                                    View Details <ChevronRight className="w-3 h-3 ml-1" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
