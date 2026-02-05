
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Search, ChevronRight, User, TrendingUp, TrendingDown, MapPin, Award } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

// Helper for multilingual text
const getText = (text: any, lang: 'en' | 'pa') => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[lang] || text['en'] || '';
};

interface ExamInfo {
    title: Record<string, string>;
    percentage: string;
}

interface StudentStat {
    id: string;
    name: string;
    email: string;
    rollNumber: string;
    phone: string;
    class: string;
    school: string;
    state: string;
    district: string;
    isActive: boolean;
    createdAt: string;
    totalAttempts: number;
    avgScore: string;
    lastActive: string | null;
    bestExam: ExamInfo | null;
    worstExam: ExamInfo | null;
}

export default function StudentAnalyticsPage() {
    const router = useRouter();
    const { user, isAuthenticated, language, _hasHydrated } = useAuthStore();
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
        s.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.state?.toLowerCase().includes(search.toLowerCase()) ||
        s.district?.toLowerCase().includes(search.toLowerCase())
    );

    // Summary stats
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.totalAttempts > 0).length;
    const avgAttempts = students.length > 0
        ? (students.reduce((sum, s) => sum + s.totalAttempts, 0) / students.length).toFixed(1)
        : '0';

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

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                            <User className="w-4 h-4" /> Total Students
                        </p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">{totalStudents}</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                            <Award className="w-4 h-4" /> Active Participants
                        </p>
                        <p className="text-3xl font-bold text-green-600 mt-1">{activeStudents}</p>
                        <p className="text-xs text-gray-400">Students who have attempted at least one exam</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" /> Avg Attempts/Student
                        </p>
                        <p className="text-3xl font-bold text-blue-600 mt-1">{avgAttempts}</p>
                    </div>
                </div>

                {/* Student Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, roll number, email, state, or district..."
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
                                    <th className="px-4 py-3">Student</th>
                                    <th className="px-4 py-3">Location</th>
                                    <th className="px-4 py-3 text-center">Attempts</th>
                                    <th className="px-4 py-3 text-center">Avg Score</th>
                                    <th className="px-4 py-3">Best Exam</th>
                                    <th className="px-4 py-3">Worst Exam</th>
                                    <th className="px-4 py-3">Last Active</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                            No students found matching your search.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((student) => (
                                        <tr key={student.id} className="hover:bg-gray-50 transition">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{student.name}</div>
                                                <div className="text-xs text-gray-500">{student.email}</div>
                                                <div className="text-xs text-gray-400">{student.rollNumber || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {student.state || student.district ? (
                                                    <div className="flex items-start gap-1">
                                                        <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <div className="text-gray-700">{student.district || '-'}</div>
                                                            <div className="text-xs text-gray-400">{student.state || '-'}</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                    {student.totalAttempts}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center font-medium text-gray-900">
                                                {student.avgScore}
                                            </td>
                                            <td className="px-4 py-3">
                                                {student.bestExam ? (
                                                    <div className="flex items-start gap-1.5">
                                                        <TrendingUp className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <div className="text-gray-700 text-xs max-w-[120px] truncate">
                                                                {getText(student.bestExam.title, language)}
                                                            </div>
                                                            <div className="text-green-600 font-semibold text-xs">
                                                                {student.bestExam.percentage}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">No attempts</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {student.worstExam ? (
                                                    <div className="flex items-start gap-1.5">
                                                        <TrendingDown className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                                                        <div>
                                                            <div className="text-gray-700 text-xs max-w-[120px] truncate">
                                                                {getText(student.worstExam.title, language)}
                                                            </div>
                                                            <div className="text-red-500 font-semibold text-xs">
                                                                {student.worstExam.percentage}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-xs">No attempts</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-xs">
                                                {student.lastActive ? new Date(student.lastActive).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Link
                                                    href={`/admin/reports/student/${student.id}`}
                                                    className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium text-xs"
                                                >
                                                    View <ChevronRight className="w-3 h-3 ml-1" />
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

