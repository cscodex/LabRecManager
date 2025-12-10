'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Eye, EyeOff, GraduationCap, LogIn } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import DatabaseStatus from '@/components/DatabaseStatus';

export default function LoginPage() {
    const router = useRouter();
    const { setAuth } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [language, setLanguage] = useState('en');

    const { register, handleSubmit, formState: { errors } } = useForm();

    const text = {
        en: {
            title: 'Lab Record Manager',
            subtitle: 'School Lab Management System',
            email: 'Email Address',
            password: 'Password',
            login: 'Sign In',
            loading: 'Signing in...',
            welcome: 'Welcome back!',
            demoCredentials: 'Demo Credentials',
        },
        hi: {
            title: 'प्रयोगशाला रिकॉर्ड प्रबंधक',
            subtitle: 'स्कूल लैब प्रबंधन प्रणाली',
            email: 'ईमेल पता',
            password: 'पासवर्ड',
            login: 'साइन इन करें',
            loading: 'साइन इन हो रहा है...',
            welcome: 'वापसी पर स्वागत है!',
            demoCredentials: 'डेमो क्रेडेंशियल्स',
        },
    };

    const t = text[language];

    const onSubmit = async (data) => {
        setIsLoading(true);
        try {
            const response = await authAPI.login(data.email, data.password);
            const { user, accessToken, refreshToken } = response.data.data;
            setAuth(user, accessToken, refreshToken);
            toast.success(t.welcome);
            // Use replace for cleaner navigation and add a small delay
            setTimeout(() => {
                router.replace('/dashboard');
            }, 100);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Section - Gradient Background */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-accent-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
                <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-8">
                        <GraduationCap className="w-12 h-12" />
                    </div>
                    <h1 className="text-4xl font-bold mb-4 text-center">{t.title}</h1>
                    <p className="text-xl text-white/80 text-center max-w-md">
                        {t.subtitle}
                    </p>

                    {/* Features */}
                    <div className="mt-12 grid gap-4 text-sm">
                        {['Multi-language Support', 'Online Viva System', 'Real-time Grading', 'Comprehensive Reports'].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur px-4 py-2 rounded-lg">
                                <span className="w-2 h-2 bg-white rounded-full"></span>
                                {feature}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Decorative circles */}
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/5 rounded-full"></div>
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full"></div>
            </div>

            {/* Right Section - Login Form */}
            <div className="flex-1 flex flex-col justify-center items-center p-8 bg-slate-50">
                {/* Language Toggle & Status */}
                <div className="absolute top-4 right-4 flex items-center gap-4">
                    <DatabaseStatus />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setLanguage('en')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${language === 'en' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            English
                        </button>
                        <button
                            onClick={() => setLanguage('hi')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${language === 'hi' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            हिन्दी
                        </button>
                    </div>
                </div>

                <div className="w-full max-w-md">
                    <div className="lg:hidden text-center mb-8">
                        <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <GraduationCap className="w-8 h-8 text-primary-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>
                    </div>

                    <div className="card p-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">{t.login}</h2>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                            <div>
                                <label className="label">{t.email}</label>
                                <input
                                    type="email"
                                    className="input"
                                    placeholder="you@school.edu"
                                    {...register('email', { required: 'Email is required' })}
                                />
                                {errors.email && (
                                    <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                                )}
                            </div>

                            <div>
                                <label className="label">{t.password}</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="input pr-12"
                                        placeholder="••••••••"
                                        {...register('password', { required: 'Password is required' })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn btn-primary w-full py-3"
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        {t.loading}
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <LogIn className="w-5 h-5" />
                                        {t.login}
                                    </span>
                                )}
                            </button>
                        </form>

                        {/* Demo Credentials */}
                        <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                            <p className="text-sm font-medium text-slate-700 mb-2">{t.demoCredentials}:</p>
                            <div className="space-y-1 text-sm text-slate-600">
                                <p><span className="font-medium">Admin:</span> admin@dps.edu / admin123</p>
                                <p><span className="font-medium">Instructor:</span> instructor@dps.edu / instructor123</p>
                                <p><span className="font-medium">Student:</span> student1@dps.edu / student123</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
