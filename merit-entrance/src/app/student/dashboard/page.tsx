'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { formatDateTimeIST, isExamActive, hasExamEnded, getText } from '@/lib/utils';
import { BookOpen, Clock, Calendar, ChevronRight, LogOut, User, Menu, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Exam {
    id: string;
    assignmentId: string;
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
    const [showMenu, setShowMenu] = useState(false);

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

    const handleStartExam = (examId: string, assignmentId: string) => {
        router.push(`/student/exam/${examId}?assignmentId=${assignmentId}`);
    };

    const getExamStatus = (exam: Exam) => {
        if (exam.hasAttempted) {
            return { status: 'completed', label: '✓ Completed', color: 'bg-green-100 text-green-700 border border-green-300' };
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
            {/* Header - Mobile Optimized */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Merit Entrance</h1>
                        </div>

                        {/* Desktop User Info */}
                        <div className="hidden sm:flex items-center gap-4">
                            <button
                                onClick={() => router.push('/student/profile')}
                                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition"
                            >
                                <User className="w-5 h-5" />
                                <span className="font-medium">{user?.name}</span>
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="sm:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            {showMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {showMenu && (
                    <div className="sm:hidden border-t bg-white px-4 py-2 space-y-2">
                        <div className="flex items-center gap-3 p-2 border-b pb-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                {user?.name?.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold">{user?.name}</p>
                                <p className="text-xs text-gray-500">{user?.role}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/student/profile')}
                            className="w-full flex items-center gap-2 p-3 text-gray-700 hover:bg-gray-50 rounded-lg"
                        >
                            <User className="w-5 h-5" />
                            My Profile
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 p-3 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                            <LogOut className="w-5 h-5" />
                            Logout
                        </button>
                    </div>
                )}
            </header>

            {/* Main Content - Mobile Optimized */}
            <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">My Exams</h2>

                {exams.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 sm:p-12 text-center">
                        <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No exams assigned to you yet.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:gap-4">
                        {exams.map((exam) => {
                            const { status, label, color } = getExamStatus(exam);
                            return (
                                <div
                                    key={exam.assignmentId}
                                    className="bg-white rounded-xl shadow-sm p-4 sm:p-6 hover:shadow-md transition"
                                >
                                    {/* Mobile Layout */}
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                                                    {getText(exam.title, language)}
                                                </h3>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${color}`}>
                                                    {label}
                                                </span>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-4 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4 flex-shrink-0" />
                                                    {exam.duration} mins • {exam.totalMarks} marks
                                                </span>
                                                <span className="flex items-center gap-1 text-xs sm:text-sm">
                                                    <Calendar className="w-4 h-4 flex-shrink-0" />
                                                    <span className="truncate">
                                                        {formatDateTimeIST(exam.schedule.startTime)}
                                                    </span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Button - Full Width on Mobile */}
                                        <div className="sm:flex-shrink-0">
                                            {status === 'active' && (
                                                <button
                                                    onClick={() => handleStartExam(exam.id, exam.assignmentId)}
                                                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
                                                >
                                                    Start Exam
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            )}

                                            {status === 'completed' && (
                                                <button
                                                    onClick={() => router.push(`/student/results/${exam.id}`)}
                                                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
                                                >
                                                    View Results
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
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
