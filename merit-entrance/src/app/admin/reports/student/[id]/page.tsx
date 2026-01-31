

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { ChevronLeft, Calendar, Award, Clock, FileText, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

// Helper for multilingual text
const getText = (text: any, lang: 'en' | 'pa') => {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text[lang] || text['en'] || '';
};

export default function StudentDetailsPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const { user, isAuthenticated, language, _hasHydrated } = useAuthStore();
    const [studentData, setStudentData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        if (id) loadStudentDetails();
    }, [_hasHydrated, isAuthenticated, user, router, id]);

    const loadStudentDetails = async () => {
        try {
            const response = await fetch(`/api/admin/reports/students/${id}`);
            if (response.status === 401) {
                router.push('/login');
                return;
            }
            const data = await response.json();
            if (data.success) {
                setStudentData(data.student);
            }
        } catch (error) {
            toast.error('Failed to load details');
        } finally {
            setLoading(false);
        }
    };

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!studentData) return <div className="p-8 text-center">Student not found</div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <Link href="/admin/reports/student" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4">
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back to Students
                    </Link>
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{studentData.name}</h1>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                <span>{studentData.email}</span>
                                <span>•</span>
                                <span>Roll: {studentData.roll_number || 'N/A'}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500">Joined</div>
                            <div className="font-medium">
                                {new Date(studentData.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    Exam History & Performance
                </h2>

                {studentData.attempts.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl shadow-sm text-center text-gray-500">
                        No exam attempts found.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {studentData.attempts.map((attempt: any) => (
                            <div key={attempt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-wrap gap-4 justify-between items-center">
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-lg">
                                            {getText(attempt.title, language)}
                                        </h3>
                                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(attempt.started_at).toLocaleDateString()}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${attempt.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {attempt.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className="text-xs text-gray-500">Score</div>
                                            <div className="text-xl font-bold text-gray-900">
                                                {attempt.total_score || 0} <span className="text-sm font-normal text-gray-400">/ {attempt.total_marks}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section Analysis */}
                                {attempt.sectionStats && attempt.sectionStats.length > 0 && (
                                    <div className="p-4 bg-white">
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                                            <BarChart2 className="w-3 h-3" /> Section Breakdown
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {attempt.sectionStats.map((section: any, idx: number) => {
                                                const percent = section.totalMarks > 0
                                                    ? Math.round((section.marksObtained / section.totalMarks) * 100)
                                                    : 0;
                                                return (
                                                    <div key={idx} className="bg-gray-50 rounded p-3 border border-gray-100">
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span className="font-medium text-gray-700 truncate">{getText(section.name, language)}</span>
                                                            <span className="text-gray-900 font-semibold">{section.marksObtained}/{section.totalMarks}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${percent >= 70 ? 'bg-green-500' :
                                                                    percent >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                                    }`}
                                                                style={{ width: `${percent}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
