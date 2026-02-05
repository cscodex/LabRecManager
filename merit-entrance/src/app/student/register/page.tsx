'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';
import { BookOpen, AlertCircle, Mail, User, Phone, School, GraduationCap, Lock, Eye, EyeOff, Check, X, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { signIn } from 'next-auth/react';
import { indianStates, getDistrictsByStateName } from '@/lib/indianLocations';

// Password strength validation rules
const passwordRules = [
    { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
    { label: 'One number', test: (p: string) => /\d/.test(p) },
    { label: 'One special character (!@#$%^&*)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

function RegistrationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useTranslation();

    // Check if coming from Google OAuth redirect
    const googleEmail = searchParams.get('email');
    const googleName = searchParams.get('name');
    const googleId = searchParams.get('googleId');
    const needsRegistration = searchParams.get('needsRegistration') === 'true';

    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'choice' | 'form'>(needsRegistration ? 'form' : 'choice');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: googleName || '',
        email: googleEmail || '',
        phone: '',
        class: '',
        school: '',
        state: '',
        district: '',
        password: '',
        confirmPassword: '',
        googleId: googleId || '',
    });

    // Get filtered districts based on selected state
    const availableDistricts = useMemo(() => {
        if (!formData.state) return [];
        return getDistrictsByStateName(formData.state);
    }, [formData.state]);

    useEffect(() => {
        if (needsRegistration && googleEmail) {
            setStep('form');
        }
    }, [needsRegistration, googleEmail]);

    // Password strength calculation
    const passwordStrength = useMemo(() => {
        const passedRules = passwordRules.filter(rule => rule.test(formData.password));
        return {
            score: passedRules.length,
            total: passwordRules.length,
            percentage: (passedRules.length / passwordRules.length) * 100,
            rules: passwordRules.map(rule => ({
                ...rule,
                passed: rule.test(formData.password)
            }))
        };
    }, [formData.password]);

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

    const handleGoogleSignUp = () => {
        setIsLoading(true);
        signIn('google', { callbackUrl: '/student/dashboard' });
    };

    const handleSubmitRegistration = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.email) {
            toast.error('Name and email are required');
            return;
        }

        // Validate password (only if not from Google OAuth)
        if (!googleId) {
            if (!formData.password) {
                toast.error('Password is required');
                return;
            }

            if (passwordStrength.score < passwordRules.length) {
                toast.error('Password does not meet all requirements');
                return;
            }

            if (formData.password !== formData.confirmPassword) {
                toast.error('Passwords do not match');
                return;
            }
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/register-google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    password: formData.password || undefined, // Don't send empty password
                }),
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Registration successful! Please verify your email.');
                router.push(`/student/verify-email?email=${encodeURIComponent(formData.email)}&pending=true`);
            } else {
                toast.error(data.error || 'Registration failed');
            }
        } catch (error) {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
        }
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
                    {step === 'choice' && (
                        <>
                            <div className="mb-6 text-center">
                                <h2 className="text-xl font-bold text-gray-900">Student Registration</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Sign up with your Google account or create an account.
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

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-200" />
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-3 bg-white text-gray-500">or</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setStep('form')}
                                    className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all"
                                >
                                    Register with Email
                                </button>

                                <div className="bg-blue-50 rounded-lg p-4 flex gap-3 items-start">
                                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-blue-700">
                                        A verification email will be sent to confirm your account before you can start taking exams.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {step === 'form' && (
                        <>
                            <div className="mb-6 text-center">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {needsRegistration ? 'Complete Your Profile' : 'Create Account'}
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    {needsRegistration
                                        ? 'This email is not registered. Please complete your profile.'
                                        : 'Fill in your details to create an account'}
                                </p>
                            </div>

                            <form onSubmit={handleSubmitRegistration} className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Enter your full name"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${googleEmail ? 'bg-gray-50' : ''}`}
                                            placeholder="Enter your email"
                                            required
                                            readOnly={!!googleEmail}
                                        />
                                    </div>
                                </div>

                                {/* Password - Only show if not from Google OAuth */}
                                {!googleId && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={formData.password}
                                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                                            {formData.password && (
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
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                <input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    value={formData.confirmPassword}
                                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${formData.confirmPassword && formData.password !== formData.confirmPassword
                                                        ? 'border-red-300 bg-red-50'
                                                        : formData.confirmPassword && formData.password === formData.confirmPassword
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
                                            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                                <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                                            )}
                                            {formData.confirmPassword && formData.password === formData.confirmPassword && (
                                                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Passwords match
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Phone */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Enter your phone number"
                                        />
                                    </div>
                                </div>

                                {/* Class */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                                    <div className="relative">
                                        <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <select
                                            value={formData.class}
                                            onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                                        >
                                            <option value="">Select your class</option>
                                            <option value="5">Class 5</option>
                                            <option value="6">Class 6</option>
                                            <option value="7">Class 7</option>
                                            <option value="8">Class 8</option>
                                            <option value="9">Class 9</option>
                                            <option value="10">Class 10</option>
                                            <option value="11">Class 11</option>
                                            <option value="12">Class 12</option>
                                        </select>
                                    </div>
                                </div>

                                {/* School */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                                    <div className="relative">
                                        <School className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            value={formData.school}
                                            onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Enter your school name"
                                        />
                                    </div>
                                </div>

                                {/* State */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <select
                                            value={formData.state}
                                            onChange={(e) => setFormData({ ...formData, state: e.target.value, district: '' })}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                                        >
                                            <option value="">Select your state</option>
                                            {indianStates.map((state) => (
                                                <option key={state.code} value={state.name}>
                                                    {state.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* District */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <select
                                            value={formData.district}
                                            onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                                            disabled={!formData.state}
                                        >
                                            <option value="">{formData.state ? 'Select your district' : 'Select state first'}</option>
                                            {availableDistricts.map((district) => (
                                                <option key={district.code} value={district.name}>
                                                    {district.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isLoading || (!googleId && (passwordStrength.score < passwordRules.length || formData.password !== formData.confirmPassword))}
                                    className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Creating Account...
                                        </span>
                                    ) : (
                                        'Create Account'
                                    )}
                                </button>

                                {/* Back Button */}
                                {!needsRegistration && (
                                    <button
                                        type="button"
                                        onClick={() => setStep('choice')}
                                        className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all"
                                    >
                                        Back
                                    </button>
                                )}
                            </form>
                        </>
                    )}

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

export default function StudentRegisterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
            </div>
        }>
            <RegistrationContent />
        </Suspense>
    );
}
