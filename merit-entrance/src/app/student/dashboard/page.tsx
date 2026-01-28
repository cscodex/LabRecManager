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
    sectionCount: number;
    questionCount: number;
    schedule: {
        startTime: string;
        endTime: string;
    };
    maxAttempts: number;
    attemptCount: number;
    canAttempt: boolean;
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
        const now = new Date();
        const start = new Date(exam.schedule.startTime);
        const end = new Date(exam.schedule.endTime);

        const isExpired = now > end;
        const isActive = now >= start && now <= end;
        const attemptsExhausted = exam.attemptCount >= exam.maxAttempts;

        if (attemptsExhausted) {
            return { status: 'completed', label: 'Completed', color: 'bg-gray-100 text-gray-700 border border-gray-300' };
        }
        if (isExpired) {
            return { status: 'expired', label: 'Expired', color: 'bg-red-50 text-red-600 border border-red-200' };
        }
        if (isActive) {
            return { status: 'active', label: 'Active Now', color: 'bg-green-50 text-green-700 border border-green-200 ring-1 ring-green-100' };
        }
        return { status: 'upcoming', label: 'Upcoming', color: 'bg-blue-50 text-blue-700 border border-blue-200' };
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
            {/* Main Content - Mobile Optimized */}
            <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-20">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Assigned Exams</h2>
                </div>

                {exams.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 sm:p-12 text-center border border-gray-100 shadow-sm">
                        <BookOpen className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No exams assigned to you yet.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:gap-6">
                        {exams.map((exam) => {
                            const { status, label, color } = getExamStatus(exam);
                            return (
                                <div
                                    key={exam.assignmentId}
                                    className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 hover:shadow-md transition-shadow relative overflow-hidden"
                                >
                                    {/* Status Badge - Absolute on Desktop, Relative on Mobile */}
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                                                    {getText(exam.title, language)}
                                                </h3>
                                                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full uppercase tracking-wide ${color}`}>
                                                    {label}
                                                </span>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 mt-3 text-sm text-gray-600">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                    <span>{exam.duration} mins</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <BookOpen className="w-4 h-4 text-gray-400" />
                                                    <span>{exam.questionCount} Questions</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 col-span-2 sm:col-span-2">
                                                    <Calendar className="w-4 h-4 text-gray-400" />
                                                    <span className="truncate">
                                                        {formatDateTimeIST(exam.schedule.startTime)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Attempts Info */}
                                            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 text-sm">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-gray-500">Attempts:</span>
                                                    <span className="font-medium text-gray-900">{exam.attemptCount} / {exam.maxAttempts}</span>
                                                </div>
                                                {exam.hasAttempted && (
                                                    <span className="text-blue-600 font-medium text-xs bg-blue-50 px-2 py-0.5 rounded">
                                                        Last Attempt Recorded
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        <div className="flex flex-col gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                            {status === 'active' && exam.canAttempt && (
                                                <button
                                                    onClick={() => handleStartExam(exam.id, exam.assignmentId)}
                                                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition shadow-sm"
                                                >
                                                    {exam.attemptCount > 0 ? 'Retake Exam' : 'Start Exam'}
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            )}

                                            {exam.attemptCount > 0 && (
                                                <button
                                                    onClick={() => router.push(`/student/history`)}
                                                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                                                >
                                                    View History
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
