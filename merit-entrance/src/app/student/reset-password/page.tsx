'use client';

import { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Lock, Eye, EyeOff, Check, X, CheckCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

// Password strength validation rules
const passwordRules = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { label: 'One number', test: (p: string) => /\d/.test(p) },
    { label: 'One special character (!@#$%^&*)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [resetComplete, setResetComplete] = useState(false);

    // Password strength calculation
    const passwordStrength = useMemo(() => {
        const passedRules = passwordRules.filter(rule => rule.test(password));
        return {
            score: passedRules.length,
            total: passwordRules.length,
            percentage: (passedRules.length / passwordRules.length) * 100,
            rules: passwordRules.map(rule => ({
                ...rule,
                passed: rule.test(password)
            }))
        };
    }, [password]);

    const getStrengthColor = (percentage: number) => {
        if (percentage < 40) return 'bg-red-500';
        if (percentage < 60) return 'bg-orange-500';
        if (percentage < 80) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getStrengthLabel = (percentage: number) => {
        if (percentage < 40) return 'Weak';
        if (percentage < 60) return 'Fair';
        if (percentage < 80) return 'Good';
        return 'Strong';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            toast.error('Invalid reset link');
            return;
        }

        if (passwordStrength.score < passwordRules.length) {
            toast.error('Password does not meet all requirements');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await response.json();

            if (response.ok) {
                setResetComplete(true);
            } else {
                toast.error(data.error || 'Password reset failed');
            }
        } catch (error) {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                        <X className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
                    <p className="text-gray-600 mb-6">
                        This password reset link is invalid or has expired.
                    </p>
                    <Link
                        href="/student/forgot-password"
                        className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                    >
                        Request New Link
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
                        <BookOpen className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Reset Password</h1>
                    <p className="text-blue-200 mt-2">Create a new password</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden p-6 md:p-8">
                    {!resetComplete ? (
                        <>
                            <div className="mb-6 text-center">
                                <h2 className="text-xl font-bold text-gray-900">Create New Password</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Make sure it&apos;s a strong password you haven&apos;t used before.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Password */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Create a strong password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>

                                    {/* Password Strength Indicator */}
                                    {password && (
                                        <div className="mt-2 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full transition-all ${getStrengthColor(passwordStrength.percentage)}`}
                                                        style={{ width: `${passwordStrength.percentage}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-medium ${passwordStrength.percentage < 40 ? 'text-red-600' :
                                                        passwordStrength.percentage < 60 ? 'text-orange-600' :
                                                            passwordStrength.percentage < 80 ? 'text-yellow-600' : 'text-green-600'
                                                    }`}>
                                                    {getStrengthLabel(passwordStrength.percentage)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 gap-1">
                                                {passwordStrength.rules.map((rule, index) => (
                                                    <div key={index} className="flex items-center gap-2 text-xs">
                                                        {rule.passed ? (
                                                            <Check className="w-3 h-3 text-green-500" />
                                                        ) : (
                                                            <X className="w-3 h-3 text-gray-300" />
                                                        )}
                                                        <span className={rule.passed ? 'text-green-600' : 'text-gray-500'}>
                                                            {rule.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${confirmPassword && password !== confirmPassword
                                                    ? 'border-red-300 bg-red-50'
                                                    : confirmPassword && password === confirmPassword
                                                        ? 'border-green-300 bg-green-50'
                                                        : 'border-gray-300'
                                                }`}
                                            placeholder="Confirm your password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                    {confirmPassword && password !== confirmPassword && (
                                        <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                                    )}
                                    {confirmPassword && password === confirmPassword && (
                                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Passwords match
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading || passwordStrength.score < passwordRules.length || password !== confirmPassword}
                                    className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Resetting...
                                        </span>
                                    ) : (
                                        'Reset Password'
                                    )}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center py-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Password Reset Complete</h2>
                            <p className="text-gray-600 mb-6">
                                Your password has been successfully reset. You can now login with your new password.
                            </p>
                            <button
                                onClick={() => router.push('/')}
                                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all"
                            >
                                Go to Login
                            </button>
                        </div>
                    )}

                    {!resetComplete && (
                        <div className="mt-8 text-center">
                            <Link
                                href="/"
                                className="inline-flex items-center gap-2 text-blue-600 font-medium hover:underline"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Login
                            </Link>
                        </div>
                    )}
                </div>

                {/* Bottom Info */}
                <p className="text-center text-blue-200 text-sm mt-6">
                    © 2026 Merit Entrance
                </p>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}
