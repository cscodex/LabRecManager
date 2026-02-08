'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { BookOpen, User, Mail, Phone, ArrowLeft, Award, Clock, Globe, TrendingUp, TrendingDown, School as SchoolIcon, Calendar, GraduationCap, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import PhoneVerification from '@/components/auth/PhoneVerification';

interface StudentData {
    id: string;
    rollNumber: string;
    name: string;
    nameRegional?: string;
    email?: string;
    phone?: string;
    photoUrl?: string;
    class?: string;
    school?: string;
    isActive: boolean;
    createdAt: string;
    phoneVerified?: boolean;
    preferredLanguage?: string;
}

interface ExamStats {
    totalExams: number;
    averagePercentage: number;
    bestPercentage: number;
}

interface SectionPerformance {
    sectionName: string | Record<string, string>;
    questionsAttempted: number;
    correctAnswers: number;
    marksEarned: number;
    totalPossibleMarks: number;
    percentage: number;
}

export default function StudentProfile() {
    const router = useRouter();
    const { user, language, isAuthenticated, _hasHydrated, setLanguage } = useAuthStore();
    const [studentData, setStudentData] = useState<StudentData | null>(null);
    const [examStats, setExamStats] = useState<ExamStats>({ totalExams: 0, averagePercentage: 0, bestPercentage: 0 });
    const [sectionPerformance, setSectionPerformance] = useState<SectionPerformance[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || user?.role !== 'student') {
            router.push('/');
            return;
        }
        loadProfile();
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadProfile = async () => {
        try {
            const response = await fetch('/api/student/profile');
            const data = await response.json();
            if (data.success) {
                setStudentData(data.student);
                setExamStats(data.examStats || { totalExams: 0, averagePercentage: 0, bestPercentage: 0 });
                setSectionPerformance(data.sectionPerformance || []);
            }
        } catch (error) {
            console.error('Failed to load profile data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getText = (obj: string | Record<string, string>, lang: string): string => {
        if (typeof obj === 'string') return obj;
        return obj?.[lang] || obj?.en || '';
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
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                            {studentData?.photoUrl ? (
                                <img src={studentData.photoUrl} alt={studentData.name} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-10 h-10 text-blue-600" />
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 text-center sm:text-left">
                            <h2 className="text-xl font-bold text-gray-900">{studentData?.name}</h2>
                            {studentData?.nameRegional && (
                                <p className="text-gray-600 text-sm">{studentData.nameRegional}</p>
                            )}
                            <p className="text-blue-600 font-medium mt-1">Roll: {studentData?.rollNumber}</p>

                            {studentData?.isActive && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full mt-2">
                                    <CheckCircle className="w-3 h-3" />
                                    Active
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Student Details */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Student Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {studentData?.email && (
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <Mail className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-xs text-gray-500">Email</p>
                                    <p className="text-gray-900">{studentData.email}</p>
                                </div>
                            </div>
                        )}

                        {studentData?.phone && (
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <Phone className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-xs text-gray-500">Phone</p>
                                    <p className="text-gray-900">
                                        {studentData.phone}
                                        {studentData.phoneVerified && (
                                            <CheckCircle className="w-4 h-4 text-green-500 inline ml-1" />
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}

                        {studentData?.class && (
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <GraduationCap className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-xs text-gray-500">Class</p>
                                    <p className="text-gray-900">{studentData.class}</p>
                                </div>
                            </div>
                        )}

                        {studentData?.school && (
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <SchoolIcon className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-xs text-gray-500">School</p>
                                    <p className="text-gray-900">{studentData.school}</p>
                                </div>
                            </div>
                        )}

                        {studentData?.createdAt && (
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-xs text-gray-500">Member Since</p>
                                    <p className="text-gray-900">
                                        {new Date(studentData.createdAt).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Phone Verification */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Phone Verification</h3>
                    <PhoneVerification
                        currentPhone={studentData?.phone || ''}
                        isVerified={studentData?.phoneVerified}
                        onVerificationComplete={(phone) => {
                            setStudentData(prev => prev ? { ...prev, phone, phoneVerified: true } : null);
                            toast.success('Phone verified successfully');
                        }}
                    />
                </div>

                {/* Language Settings */}
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-bold text-gray-900">Language Settings</h3>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setLanguage('en')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${language === 'en'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            English
                        </button>
                        <button
                            onClick={() => setLanguage('pa')}
                            className={`px-4 py-2 rounded-lg font-medium transition ${language === 'pa'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            ਪੰਜਾਬੀ (Punjabi)
                        </button>
                    </div>
                </div>

                {/* Section-wise Performance */}
                {sectionPerformance.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            <h3 className="text-lg font-bold text-gray-900">Section-wise Performance</h3>
                            <span className="text-sm text-gray-500">(Strongest to Weakest)</span>
                        </div>
                        <div className="space-y-3">
                            {sectionPerformance.map((section, index) => {
                                const isStrong = section.percentage >= 70;
                                const isWeak = section.percentage < 40;
                                return (
                                    <div key={index} className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isStrong ? 'bg-green-100 text-green-700' :
                                                isWeak ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium text-gray-900">
                                                    {getText(section.sectionName, language)}
                                                </span>
                                                <span className={`font-bold ${isStrong ? 'text-green-600' :
                                                        isWeak ? 'text-red-600' :
                                                            'text-yellow-600'
                                                    }`}>
                                                    {section.percentage.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${isStrong ? 'bg-green-500' :
                                                            isWeak ? 'bg-red-500' :
                                                                'bg-yellow-500'
                                                        }`}
                                                    style={{ width: `${Math.min(section.percentage, 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>{section.correctAnswers}/{section.questionsAttempted} correct</span>
                                                <span>{section.marksEarned.toFixed(1)}/{section.totalPossibleMarks.toFixed(1)} marks</span>
                                            </div>
                                        </div>
                                        {isStrong && <TrendingUp className="w-5 h-5 text-green-500" />}
                                        {isWeak && <TrendingDown className="w-5 h-5 text-red-500" />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Exam Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                        <Award className="w-6 h-6 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{examStats.totalExams}</p>
                        <p className="text-sm text-gray-500">Exams Completed</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                        <Clock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{examStats.averagePercentage.toFixed(1)}%</p>
                        <p className="text-sm text-gray-500">Average Score</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm p-4 text-center col-span-2 sm:col-span-1">
                        <BookOpen className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-gray-900">{examStats.bestPercentage.toFixed(1)}%</p>
                        <p className="text-sm text-gray-500">Best Score</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
