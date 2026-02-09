'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { User, Mail, Phone, ArrowLeft, Globe, Calendar, GraduationCap, CheckCircle, Building2, IdCard } from 'lucide-react';
import Link from 'next/link';

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
}

export default function StudentProfile() {
    const router = useRouter();
    const { user, language, isAuthenticated, _hasHydrated, setLanguage } = useAuthStore();
    const [studentData, setStudentData] = useState<StudentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            console.log('Profile API response:', data);
            if (data.success) {
                setStudentData(data.student);
            } else {
                setError(data.error || 'Failed to load profile');
            }
        } catch (error) {
            console.error('Failed to load profile data:', error);
            setError('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-600 mb-4">{error}</p>
                    <button onClick={() => router.push('/student/dashboard')} className="text-blue-600 hover:underline">
                        Go to Dashboard
                    </button>
                </div>
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
                        <User className="w-6 h-6 text-blue-600" />
                        <h1 className="text-lg font-bold text-gray-900">My Profile</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 space-y-6">
                {/* Profile Header Card */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        {/* Avatar */}
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center overflow-hidden shadow-lg">
                            {studentData?.photoUrl ? (
                                <img src={studentData.photoUrl} alt={studentData.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-4xl font-bold text-white">
                                    {studentData?.name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                            )}
                        </div>

                        {/* Basic Info */}
                        <div className="flex-1 text-center sm:text-left">
                            <h2 className="text-2xl font-bold text-gray-900">{studentData?.name || 'N/A'}</h2>
                            {studentData?.nameRegional && (
                                <p className="text-gray-600">{studentData.nameRegional}</p>
                            )}
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                                    <IdCard className="w-4 h-4" />
                                    {studentData?.rollNumber || 'No Roll Number'}
                                </span>
                                {studentData?.isActive && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                                        <CheckCircle className="w-4 h-4" />
                                        Active
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Student Details Grid */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-400" />
                        Student Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Email */}
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Mail className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
                                <p className="text-gray-900 font-medium truncate">{studentData?.email || 'Not provided'}</p>
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Phone className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</p>
                                <p className="text-gray-900 font-medium">
                                    {studentData?.phone || 'Not provided'}
                                </p>
                            </div>
                        </div>

                        {/* Class */}
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <GraduationCap className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Class</p>
                                <p className="text-gray-900 font-medium">{studentData?.class || 'Not specified'}</p>
                            </div>
                        </div>

                        {/* School */}
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Building2 className="w-5 h-5 text-orange-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">School</p>
                                <p className="text-gray-900 font-medium truncate">{studentData?.school || 'Not specified'}</p>
                            </div>
                        </div>

                        {/* Member Since */}
                        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 sm:col-span-2">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <Calendar className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Member Since</p>
                                <p className="text-gray-900 font-medium">
                                    {studentData?.createdAt
                                        ? new Date(studentData.createdAt).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })
                                        : 'Unknown'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Language Settings */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-bold text-gray-900">Language Preference</h3>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setLanguage('en')}
                            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${language === 'en'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            English
                        </button>
                        <button
                            onClick={() => setLanguage('pa')}
                            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${language === 'pa'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            ਪੰਜਾਬੀ (Punjabi)
                        </button>
                    </div>
                </div>

                {/* Link to Performance Analysis */}
                <Link
                    href="/student/performance"
                    className="block bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white hover:from-blue-600 hover:to-blue-700 transition-all"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold">Performance Analysis</h3>
                            <p className="text-blue-100 text-sm mt-1">View your exam stats, scores, and section-wise performance</p>
                        </div>
                        <div className="text-3xl">📊</div>
                    </div>
                </Link>
            </main>
        </div>
    );
}
