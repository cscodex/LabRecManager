'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { getText, formatDateTimeIST } from '@/lib/utils';
import { Clock, BookOpen, AlertCircle, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface ExamDetails {
    id: string;
    assignmentId?: string;
    title: Record<string, string>;
    description: Record<string, string> | null;
    instructions: Record<string, string> | null;
    duration: number;
    totalMarks: number;
    sectionCount: number;
    questionCount: number;
}

export default function ExamInstructionsPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const examId = params.examId as string;
    const assignmentId = searchParams.get('assignmentId');
    const { user, language, isAuthenticated, _hasHydrated } = useAuthStore();

    const [exam, setExam] = useState<ExamDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [agreed, setAgreed] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || user?.role !== 'student') {
            router.push('/');
            return;
        }
        loadExamDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_hasHydrated, isAuthenticated, user, router, assignmentId]);

    const loadExamDetails = async () => {
        try {
            // Get basic exam info from student exams list
            const response = await fetch('/api/student/exams');
            const data = await response.json();
            if (data.success) {
                let examData;
                if (assignmentId) {
                    examData = data.exams.find((e: any) => e.assignmentId === assignmentId);
                } else {
                    examData = data.exams.find((e: any) => e.id === examId);
                }

                if (examData) {
                    setExam({
                        id: examData.id,
                        assignmentId: examData.assignmentId,
                        title: examData.title,
                        description: null,
                        instructions: examData.instructions,
                        duration: examData.duration,
                        totalMarks: examData.totalMarks,
                        sectionCount: examData.sectionCount || 0,
                        questionCount: examData.questionCount || 0,
                    });
                }
            }
        } catch (error) {
            toast.error('Failed to load exam details');
        } finally {
            setLoading(false);
        }
    };

    const handleStartExam = async () => {
        if (!agreed) {
            toast.error('Please agree to the instructions first');
            return;
        }

        setStarting(true);
        try {
            const response = await fetch(`/api/student/exam/${examId}`, {
                method: 'POST',
            });

            const data = await response.json();
            if (data.success) {
                router.push(`/student/exam/${examId}/attempt`);
            } else {
                toast.error(data.error || 'Failed to start exam');
            }
        } catch (error) {
            toast.error('An error occurred');
        } finally {
            setStarting(false);
        }
    };

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500">Exam not found</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
                    <div className="flex items-center gap-3 mb-2">
                        <BookOpen className="w-8 h-8" />
                        <h1 className="text-2xl font-bold">{getText(exam.title, language)}</h1>
                    </div>
                    <p className="opacity-90">Read the instructions carefully before starting</p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Exam Info */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4 text-center">
                            <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-blue-900">{exam.duration}</p>
                            <p className="text-sm text-blue-600">Minutes</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-green-900">{exam.totalMarks}</p>
                            <p className="text-sm text-green-600">Total Marks</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-purple-900">{exam.questionCount}</p>
                            <p className="text-sm text-purple-600">Questions</p>
                        </div>
                    </div>

                    {/* Custom Exam Instructions */}
                    {exam.instructions && getText(exam.instructions, language) && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-2 mb-3">
                                <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <h3 className="font-semibold text-blue-800">Exam Instructions</h3>
                            </div>
                            <div
                                className="text-sm text-blue-900 prose prose-sm max-w-none break-words whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ __html: getText(exam.instructions, language) }}
                            />
                        </div>
                    )}

                    {/* General Instructions */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <h3 className="font-semibold text-amber-800">General Guidelines</h3>
                        </div>
                        <ul className="text-sm text-amber-900 space-y-2 ml-7">
                            <li>• The exam will start as soon as you click &quot;Start Exam&quot;</li>
                            <li>• Timer will begin immediately and cannot be paused</li>
                            <li>• You can navigate between questions freely</li>
                            <li>• Use &quot;Mark for Review&quot; to flag questions you want to revisit</li>
                            <li>• Your answers are saved automatically</li>
                            <li>• The exam will auto-submit when time runs out</li>
                            <li>• Do not refresh or close the browser window</li>
                            <li>• Ensure stable internet connection throughout</li>
                        </ul>
                    </div>

                    {/* Color Legend */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-3">Question Status Legend</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-gray-300"></span>
                                <span>Not Visited</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-red-500"></span>
                                <span>Not Answered</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-green-500"></span>
                                <span>Answered</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-purple-500"></span>
                                <span>Marked for Review</span>
                            </div>
                        </div>
                    </div>

                    {/* Agreement */}
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="w-5 h-5 mt-0.5 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">
                            I have read and understood all the instructions. I agree to follow fair exam practices.
                        </span>
                    </label>

                    {/* Start Button */}
                    <button
                        onClick={handleStartExam}
                        disabled={!agreed || starting}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {starting ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Starting...
                            </>
                        ) : (
                            <>
                                Start Exam
                                <ChevronRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
