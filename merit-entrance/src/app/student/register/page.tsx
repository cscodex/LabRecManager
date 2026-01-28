'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';
import { BookOpen, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentRegisterPage() {
    const router = useRouter();
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);

    const handleGoogleSignUp = () => {
        setIsLoading(true);
        // Redirect to NextAuth Google Sign-in
        window.location.href = '/api/auth/signin/google?callbackUrl=/student/dashboard';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
                        <BookOpen className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Create Account</h1>
                    <p className="text-blue-200 mt-2">Join Merit Entrance today</p>
                </div>

                {/* Register Card */}
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden p-6 md:p-8">
                    <div className="mb-6 text-center">
                        <h2 className="text-xl font-bold text-gray-900">Student Registration</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Sign up with your Google account to get started immediately.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <button
                            type="button"
                            onClick={handleGoogleSignUp}
                            disabled={isLoading}
                            className="w-full py-3 bg-white border-2 border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 focus:ring-4 focus:ring-gray-100 transition-all flex items-center justify-center gap-3 relative"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                            ) : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            )}
                            Sign up with Google
                        </button>

                        <div className="bg-blue-50 rounded-lg p-4 flex gap-3 items-start">
                            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-700">
                                Your account will be created automatically. You can use this account to take exams and track your progress.
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-gray-600 text-sm">
                            Already have an account?{' '}
                            <Link href="/" className="text-blue-600 font-medium hover:underline">
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Bottom Info */}
                <p className="text-center text-blue-200 text-sm mt-6">
                    © 2026 Merit Entrance
                </p>
            </div>
        </div>
    );
}
