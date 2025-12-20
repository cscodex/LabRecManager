'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import axios from 'axios';
import { Eye, EyeOff, GraduationCap, LogIn, Calendar, KeyRound, Lock } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import DatabaseStatus from '@/components/DatabaseStatus';

export default function LoginPage() {
    const router = useRouter();
    const { setAuth, setSession, setAvailableSessions } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [language, setLanguage] = useState('en');

    // Session selection state
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [loadingYears, setLoadingYears] = useState(true);

    // PIN login state
    const [loginMode, setLoginMode] = useState('password'); // 'password' or 'pin'
    const [pinVerified, setPinVerified] = useState(false);
    const [pinEmail, setPinEmail] = useState('');
    const [pinValue, setPinValue] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');

    const { register, handleSubmit, formState: { errors } } = useForm();

    // Load academic years on mount
    useEffect(() => {
        loadAcademicYears();
    }, []);

    const loadAcademicYears = async () => {
        try {
            const res = await axios.get('/api/schools/academic-years');
            const years = res.data.data?.academicYears || [];
            setAcademicYears(years);
            const currentYear = years.find(y => y.isCurrent);
            if (currentYear) {
                setSelectedYear(currentYear.id);
            } else if (years.length > 0) {
                setSelectedYear(years[0].id);
            }
        } catch (error) {
            console.error('Could not load academic years:', error.message);
        } finally {
            setLoadingYears(false);
        }
    };

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
            firstTimeLogin: 'First time? Use PIN',
            usePassword: 'Use Password',
            pin: '6-Digit PIN',
            verifyPin: 'Verify PIN',
            setPassword: 'Set Password',
            confirmPassword: 'Confirm Password',
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
            firstTimeLogin: 'पहली बार? पिन का उपयोग करें',
            usePassword: 'पासवर्ड का उपयोग करें',
            pin: '6-अंकीय पिन',
            verifyPin: 'पिन सत्यापित करें',
            setPassword: 'पासवर्ड सेट करें',
            confirmPassword: 'पासवर्ड की पुष्टि करें',
        },
    };

    const t = text[language];

    // Regular password login
    const onSubmit = async (data) => {
        if (!selectedYear) {
            toast.error('Please select an academic session');
            return;
        }

        setIsLoading(true);
        try {
            const response = await authAPI.login(data.email, data.password);
            const { user, accessToken, refreshToken } = response.data.data;
            setAuth(user, accessToken, refreshToken);

            const selectedSession = academicYears.find(y => y.id === selectedYear);
            if (selectedSession) {
                setAvailableSessions(academicYears);
                setSession(selectedSession);
            }

            toast.success(t.welcome);
            setTimeout(() => router.replace('/dashboard'), 100);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    // PIN verification
    const handlePinVerify = async () => {
        if (!pinEmail || !pinValue) {
            toast.error('Enter email and PIN');
            return;
        }
        if (pinValue.length !== 6) {
            toast.error('PIN must be 6 digits');
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.post('/api/auth/login-with-pin', {
                email: pinEmail,
                pin: pinValue
            });

            if (response.data.requiresPasswordSetup) {
                setPinVerified(true);
                setFirstName(response.data.data.firstName);
                toast.success('PIN verified! Set your password.');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'PIN verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    // Set password after PIN verification
    const handleSetPassword = async () => {
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        if (!selectedYear) {
            toast.error('Please select an academic session');
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.post('/api/auth/login-with-pin', {
                email: pinEmail,
                pin: pinValue,
                newPassword
            });

            const { user, accessToken, refreshToken } = response.data.data;
            setAuth(user, accessToken, refreshToken);

            const selectedSession = academicYears.find(y => y.id === selectedYear);
            if (selectedSession) {
                setAvailableSessions(academicYears);
                setSession(selectedSession);
            }

            toast.success('Password set! Welcome!');
            setTimeout(() => router.replace('/dashboard'), 100);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to set password');
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
                    <p className="text-xl text-white/80 text-center max-w-md">{t.subtitle}</p>

                    <div className="mt-12 grid gap-4 text-sm">
                        {['Multi-language Support', 'Online Viva System', 'Real-time Grading', 'Comprehensive Reports'].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur px-4 py-2 rounded-lg">
                                <span className="w-2 h-2 bg-white rounded-full"></span>
                                {feature}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/5 rounded-full"></div>
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full"></div>
            </div>

            {/* Right Section - Login Form */}
            <div className="flex-1 flex flex-col justify-center items-center p-8 bg-slate-50">
                {/* Language Toggle & Status */}
                <div className="absolute top-4 right-4 flex items-center gap-4">
                    <DatabaseStatus />
                    <div className="flex gap-2">
                        <button onClick={() => setLanguage('en')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${language === 'en' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                            English
                        </button>
                        <button onClick={() => setLanguage('hi')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${language === 'hi' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'}`}>
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

                        {/* Mode Toggle */}
                        <div className="flex gap-2 mb-6">
                            <button
                                type="button"
                                onClick={() => { setLoginMode('password'); setPinVerified(false); }}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${loginMode === 'password' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'}`}
                            >
                                <Lock className="w-4 h-4 inline mr-1" /> {t.usePassword}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setLoginMode('pin'); setPinVerified(false); }}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${loginMode === 'pin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
                            >
                                <KeyRound className="w-4 h-4 inline mr-1" /> {t.firstTimeLogin}
                            </button>
                        </div>

                        {/* Academic Session - Always visible */}
                        <div className="mb-5">
                            <label className="label flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary-500" />
                                {language === 'hi' ? 'शैक्षणिक सत्र' : 'Academic Session'}
                            </label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="input w-full bg-gradient-to-r from-orange-50 to-green-50 border-2 border-primary-200"
                                disabled={loadingYears}
                            >
                                {loadingYears ? (
                                    <option>Loading...</option>
                                ) : academicYears.length === 0 ? (
                                    <option value="">No sessions</option>
                                ) : (
                                    academicYears.map(year => (
                                        <option key={year.id} value={year.id}>
                                            {year.yearLabel} {year.isCurrent ? '(Current)' : ''}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {/* PASSWORD MODE */}
                        {loginMode === 'password' && (
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                <div>
                                    <label className="label">{t.email}</label>
                                    <input type="email" className="input" placeholder="you@school.edu" {...register('email', { required: true })} />
                                </div>
                                <div>
                                    <label className="label">{t.password}</label>
                                    <div className="relative">
                                        <input type={showPassword ? 'text' : 'password'} className="input pr-12" placeholder="••••••••" {...register('password', { required: true })} />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" disabled={isLoading} className="btn btn-primary w-full py-3">
                                    {isLoading ? t.loading : <><LogIn className="w-5 h-5 inline mr-2" />{t.login}</>}
                                </button>
                            </form>
                        )}

                        {/* PIN MODE */}
                        {loginMode === 'pin' && !pinVerified && (
                            <div className="space-y-5">
                                <div>
                                    <label className="label">{t.email}</label>
                                    <input type="email" className="input" placeholder="you@school.edu" value={pinEmail} onChange={(e) => setPinEmail(e.target.value)} />
                                </div>
                                <div>
                                    <label className="label">{t.pin}</label>
                                    <input type="text" className="input text-center tracking-widest font-mono text-lg" placeholder="000000" maxLength={6} value={pinValue} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))} />
                                    <p className="text-xs text-slate-500 mt-1">
                                        {language === 'hi' ? 'शिक्षक से प्राप्त पिन दर्ज करें' : 'Enter PIN from your teacher'}
                                    </p>
                                </div>
                                <button type="button" onClick={handlePinVerify} disabled={isLoading} className="btn btn-primary w-full py-3 bg-amber-500 hover:bg-amber-600">
                                    {isLoading ? 'Verifying...' : <><KeyRound className="w-5 h-5 inline mr-2" />{t.verifyPin}</>}
                                </button>
                            </div>
                        )}

                        {/* PASSWORD SETUP after PIN verified */}
                        {loginMode === 'pin' && pinVerified && (
                            <div className="space-y-5">
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-green-800">
                                    ✓ PIN verified for <strong>{firstName}</strong>. Now set your password.
                                </div>
                                <div>
                                    <label className="label">{t.setPassword}</label>
                                    <div className="relative">
                                        <input type={showPassword ? 'text' : 'password'} className="input pr-12" placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="label">{t.confirmPassword}</label>
                                    <input type={showPassword ? 'text' : 'password'} className="input" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                </div>
                                <button type="button" onClick={handleSetPassword} disabled={isLoading} className="btn btn-primary w-full py-3">
                                    {isLoading ? 'Setting up...' : <><LogIn className="w-5 h-5 inline mr-2" />Set Password & Login</>}
                                </button>
                            </div>
                        )}

                        {/* Demo Credentials */}
                        {loginMode === 'password' && (
                            <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                                <p className="text-sm font-medium text-slate-700 mb-2">{t.demoCredentials}:</p>
                                <div className="space-y-1 text-sm text-slate-600">
                                    <p><span className="font-medium">Admin:</span> admin@dps.edu / admin123</p>
                                    <p><span className="font-medium">Instructor:</span> instructor@dps.edu / instructor123</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
