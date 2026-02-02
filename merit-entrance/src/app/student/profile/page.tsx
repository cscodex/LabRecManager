'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { BookOpen, User, Mail, Phone, School, ArrowLeft, Award, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import PhoneVerification from '@/components/auth/PhoneVerification';

interface ExamResult {
    id: string;
    title: Record<string, string>;
    score: number;
    totalMarks: number;
    submittedAt: string;
}

export default function StudentProfile() {
    const router = useRouter();
    const { user, language, isAuthenticated, _hasHydrated } = useAuthStore();
    const [examResults, setExamResults] = useState<ExamResult[]>([]);
    const [userData, setUserData] = useState<any>(null); // Store fetched user details
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || user?.role !== 'student') {
            router.push('/');
            return;
        }
        loadResults();
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadResults = async () => {
        try {
            const response = await fetch('/api/student/profile');
            const data = await response.json();
            if (data.success) {
                setExamResults(data.examResults || []);
                setUserData(data.student);
            }
        } catch (error) {
            console.error('Failed to load profile data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getText = (obj: Record<string, string>, lang: string) => {
        return obj?.[lang] || obj?.en || '';
    };

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const averageScore = examResults.length > 0
        ? examResults.reduce((acc, r) => acc + (r.score / r.totalMarks) * 100, 0) / examResults.length
        : 0;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3">
                    <button
                        onClick={() => router.push('/student/dashboard')}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-blue-600" />
                        <h1 className="text-lg font-bold text-gray-900">My Profile</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6">
                {/* Profile Card */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        {/* Avatar */}
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-10 h-10 text-blue-600" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 text-center sm:text-left">
                            <h2 className="text-xl font-bold text-gray-900">{user?.name}</h2>
                            <p className="text-blue-600 font-medium">{user?.rollNumber}</p>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                                {user?.email && (
                                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                                        <Mail className="w-4 h-4" />
                                        <span>{user.email}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Phone Verification */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Phone Verification</h3>
                    <PhoneVerification
                        currentPhone={userData?.phone || (user as any)?.phone || ''}
                        isVerified={userData?.phone_verified}
                        onVerificationComplete={(phone) => {
                            setUserData((prev: any) => ({ ...prev, phone, phone_verified: true }));
                            toast.success('Profile updated');
                        }}
                    />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                        <Award className="w-6 h-6 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{examResults.length}</p>
                        <p className="text-sm text-gray-500">Exams Completed</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                        <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{averageScore.toFixed(1)}%</p>
                        <p className="text-sm text-gray-500">Average Score</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-4 text-center col-span-2 sm:col-span-1">
                        <BookOpen className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">
                            {examResults.length > 0 ? Math.max(...examResults.map(r => (r.score / r.totalMarks) * 100)).toFixed(1) : 0}%
                        </p>
                        <p className="text-sm text-gray-500">Best Score</p>
                    </div>
                </div>

                {/* Exam History */}
                <div className="bg-white rounded-xl shadow-sm">
                    <div className="p-4 border-b">
                        <h3 className="font-semibold text-gray-900">Exam History</h3>
                    </div>

                    {examResults.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p>No exams completed yet</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {examResults.map((result) => (
                                <div
                                    key={result.id}
                                    className="p-4 hover:bg-gray-50 cursor-pointer"
                                    onClick={() => router.push(`/student/results/${result.id}`)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                {getText(result.title, language)}
                                            </h4>
                                            <p className="text-sm text-gray-500">
                                                {new Date(result.submittedAt).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-lg font-bold ${(result.score / result.totalMarks) >= 0.6 ? 'text-green-600' :
                                                (result.score / result.totalMarks) >= 0.4 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                {result.score}/{result.totalMarks}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {((result.score / result.totalMarks) * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main >
        </div >
    );
}
