'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { formatDateTimeIST, isExamActive, hasExamEnded, getText } from '@/lib/utils';
import { BookOpen, Clock, Calendar, ChevronRight, LogOut, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface Exam {
    id: string;
    title: Record<string, string>;
    duration: number;
    totalMarks: number;
    schedule: {
        startTime: string;
        endTime: string;
    };
    hasAttempted: boolean;
}

export default function StudentDashboard() {
    const router = useRouter();
    const { user, language, isAuthenticated, logout, _hasHydrated } = useAuthStore();
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || user?.role !== 'student') {
            router.push('/');
            return;
        }
        loadExams();
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadExams = async () => {
        try {
            const response = await fetch('/api/student/exams');
            const data = await response.json();
            if (data.success) {
                setExams(data.exams);
            }
        } catch (error) {
            toast.error('Failed to load exams');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        logout();
        router.push('/');
    };

    const handleStartExam = (examId: string) => {
        router.push(`/student/exam/${examId}`);
    };

    const getExamStatus = (exam: Exam) => {
        if (exam.hasAttempted) {
            return { status: 'completed', label: 'Completed', color: 'bg-gray-100 text-gray-600' };
        }
        if (hasExamEnded(exam.schedule.endTime)) {
            return { status: 'expired', label: 'Expired', color: 'bg-red-100 text-red-600' };
        }
        if (isExamActive(exam.schedule.startTime, exam.schedule.endTime)) {
            return { status: 'active', label: 'Available Now', color: 'bg-green-100 text-green-600' };
        }
        return { status: 'upcoming', label: 'Upcoming', color: 'bg-blue-100 text-blue-600' };
    };

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <BookOpen className="w-8 h-8 text-blue-600" />
                        <h1 className="text-xl font-bold text-gray-900">Merit Entrance</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-gray-600">
                            <User className="w-5 h-5" />
                            <span className="font-medium">{user?.name}</span>
                            <span className="text-sm text-gray-400">({user?.rollNumber})</span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 py-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">My Exams</h2>

                {exams.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center">
                        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No exams assigned to you yet.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {exams.map((exam) => {
                            const { status, label, color } = getExamStatus(exam);
                            return (
                                <div
                                    key={exam.id}
                                    className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {getText(exam.title, language)}
                                                </h3>
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>
                                                    {label}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {exam.duration} mins
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-4 h-4" />
                                                    {formatDateTimeIST(exam.schedule.startTime)} - {formatDateTimeIST(exam.schedule.endTime)}
                                                </span>
                                                <span>Total Marks: {exam.totalMarks}</span>
                                            </div>
                                        </div>

                                        {status === 'active' && (
                                            <button
                                                onClick={() => handleStartExam(exam.id)}
                                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
                                            >
                                                Start Exam
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        )}

                                        {status === 'completed' && (
                                            <button
                                                onClick={() => router.push(`/student/results/${exam.id}`)}
                                                className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
                                            >
                                                View Results
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
