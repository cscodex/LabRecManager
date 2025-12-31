'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import axios from 'axios';
import { Eye, EyeOff, GraduationCap, LogIn, Calendar, KeyRound, Lock, Globe, ChevronDown, Check, Search } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { useAuthStore, useLanguageStore } from '@/lib/store';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import DatabaseStatus from '@/components/DatabaseStatus';

// Login Page Language Selector Component
function LoginLanguageSelector() {
    const { t, i18n } = useTranslation('common');
    const { language, setLanguage } = useLanguageStore();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLanguageChange = (langCode) => {
        setLanguage(langCode);
        i18n.changeLanguage(langCode);
        setIsOpen(false);
        setSearchQuery('');

        const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
        if (selectedLang?.dir === 'rtl') {
            document.documentElement.dir = 'rtl';
        } else {
            document.documentElement.dir = 'ltr';
        }
    };

    const filteredLanguages = SUPPORTED_LANGUAGES.filter(lang =>
        lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const indianLanguages = filteredLanguages.filter(l => l.group === 'indian');
    const internationalLanguages = filteredLanguages.filter(l => l.group === 'international');

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition shadow-sm"
            >
                <Globe className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">{currentLang.nativeName}</span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                    <div className="p-2 border-b border-slate-200">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('common.search') + '...'}
                                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-100 border-none focus:ring-2 focus:ring-primary-500"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                        {internationalLanguages.length > 0 && (
                            <div>
                                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                                    {t('language.internationalLanguages')}
                                </div>
                                {internationalLanguages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => handleLanguageChange(lang.code)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-100 transition ${language === lang.code ? 'bg-primary-50' : ''}`}
                                    >
                                        <span className="flex-1">
                                            <span className="block text-sm font-medium text-slate-900">{lang.nativeName}</span>
                                            <span className="block text-xs text-slate-500">{lang.name}</span>
                                        </span>
                                        {language === lang.code && <Check className="w-4 h-4 text-primary-500" />}
                                    </button>
                                ))}
                            </div>
                        )}

                        {indianLanguages.length > 0 && (
                            <div>
                                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                                    {t('language.indianLanguages')}
                                </div>
                                {indianLanguages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => handleLanguageChange(lang.code)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-100 transition ${language === lang.code ? 'bg-primary-50' : ''}`}
                                    >
                                        <span className="flex-1">
                                            <span className="block text-sm font-medium text-slate-900">{lang.nativeName}</span>
                                            <span className="block text-xs text-slate-500">{lang.name}</span>
                                        </span>
                                        {language === lang.code && <Check className="w-4 h-4 text-primary-500" />}
                                    </button>
                                ))}
                            </div>
                        )}

                        {filteredLanguages.length === 0 && (
                            <div className="px-3 py-4 text-center text-sm text-slate-500">
                                {t('common.noData')}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function LoginPage() {
    const router = useRouter();
    const { t } = useTranslation('common');
    const { setAuth, setSession, setAvailableSessions } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Session selection state
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [loadingYears, setLoadingYears] = useState(true);
    const [schoolInfo, setSchoolInfo] = useState({ name: '', logoUrl: '' });

    // PIN login state
    const [loginMode, setLoginMode] = useState('password');
    const [pinVerified, setPinVerified] = useState(false);
    const [pinEmail, setPinEmail] = useState('');
    const [pinValue, setPinValue] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');

    const { register, handleSubmit, formState: { errors } } = useForm();

    useEffect(() => {
        loadAcademicYears();
    }, []);

    const loadAcademicYears = async () => {
        try {
            const res = await axios.get('/api/schools/academic-years');
            const years = res.data.data?.academicYears || [];
            if (res.data.data?.school) {
                setSchoolInfo(res.data.data.school);
            }
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

    const onSubmit = async (data) => {
        if (!selectedYear) {
            toast.error(t('auth.academicSession'));
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

            toast.success(t('auth.welcome'));
            setTimeout(() => router.replace('/dashboard'), 100);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

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
                toast.success(t('auth.pinVerified'));
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'PIN verification failed');
        } finally {
            setIsLoading(false);
        }
    };

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
            toast.error(t('auth.academicSession'));
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

            toast.success(t('auth.welcome'));
            setTimeout(() => router.replace('/dashboard'), 100);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to set password');
        } finally {
            setIsLoading(false);
        }
    };

    const displayTitle = schoolInfo.name || t('login.title');

    return (
        <div className="min-h-screen flex">
            {/* Left Section - Gradient Background */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-accent-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
                <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-8 overflow-hidden">
                        {schoolInfo.logoUrl ? (
                            <img src={schoolInfo.logoUrl} alt={schoolInfo.name} className="w-full h-full object-contain p-2" />
                        ) : (
                            <GraduationCap className="w-12 h-12" />
                        )}
                    </div>
                    <h1 className="text-4xl font-bold mb-4 text-center">{displayTitle}</h1>
                    <p className="text-xl text-white/80 text-center max-w-md">{t('login.subtitle')}</p>

                    <div className="mt-12 grid gap-4 text-sm">
                        {[
                            t('login.features.multiLanguage'),
                            t('login.features.onlineViva'),
                            t('login.features.realTimeGrading'),
                            t('login.features.comprehensiveReports')
                        ].map((feature, i) => (
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
                    <LoginLanguageSelector />
                </div>

                <div className="w-full max-w-md">
                    <div className="lg:hidden text-center mb-8">
                        <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
                            {schoolInfo.logoUrl ? (
                                <img src={schoolInfo.logoUrl} alt={schoolInfo.name} className="w-full h-full object-contain p-1" />
                            ) : (
                                <GraduationCap className="w-8 h-8 text-primary-600" />
                            )}
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">{displayTitle}</h1>
                    </div>

                    <div className="card p-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">{t('auth.login')}</h2>

                        {/* Mode Toggle */}
                        <div className="flex gap-2 mb-6">
                            <button
                                type="button"
                                onClick={() => { setLoginMode('password'); setPinVerified(false); }}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${loginMode === 'password' ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600'}`}
                            >
                                <Lock className="w-4 h-4 inline mr-1" /> {t('auth.usePassword')}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setLoginMode('pin'); setPinVerified(false); }}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${loginMode === 'pin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}
                            >
                                <KeyRound className="w-4 h-4 inline mr-1" /> {t('auth.firstTimeLogin')}
                            </button>
                        </div>

                        {/* Academic Session */}
                        <div className="mb-5">
                            <label className="label flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary-500" />
                                {t('auth.academicSession')}
                            </label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="input w-full bg-gradient-to-r from-orange-50 to-green-50 border-2 border-primary-200"
                                disabled={loadingYears}
                            >
                                {loadingYears ? (
                                    <option>{t('common.loading')}</option>
                                ) : academicYears.length === 0 ? (
                                    <option value="">{t('auth.noSessions')}</option>
                                ) : (
                                    academicYears.map(year => (
                                        <option key={year.id} value={year.id}>
                                            {year.yearLabel} {year.isCurrent ? `(${t('auth.current')})` : ''}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {/* PASSWORD MODE */}
                        {loginMode === 'password' && (
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                                <div>
                                    <label className="label">{t('auth.email')}</label>
                                    <input type="email" className="input" placeholder="you@school.edu" {...register('email', { required: true })} />
                                </div>
                                <div>
                                    <label className="label">{t('auth.password')}</label>
                                    <div className="relative">
                                        <input type={showPassword ? 'text' : 'password'} className="input pr-12" placeholder="••••••••" {...register('password', { required: true })} />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" disabled={isLoading} className="btn btn-primary w-full py-3">
                                    {isLoading ? t('auth.signingIn') : <><LogIn className="w-5 h-5 inline mr-2" />{t('auth.login')}</>}
                                </button>
                            </form>
                        )}

                        {/* PIN MODE */}
                        {loginMode === 'pin' && !pinVerified && (
                            <div className="space-y-5">
                                <div>
                                    <label className="label">{t('auth.email')}</label>
                                    <input type="email" className="input" placeholder="you@school.edu" value={pinEmail} onChange={(e) => setPinEmail(e.target.value)} />
                                </div>
                                <div>
                                    <label className="label">{t('auth.pin')}</label>
                                    <input type="text" className="input text-center tracking-widest font-mono text-lg" placeholder="000000" maxLength={6} value={pinValue} onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))} />
                                    <p className="text-xs text-slate-500 mt-1">{t('auth.enterPinFromTeacher')}</p>
                                </div>
                                <button type="button" onClick={handlePinVerify} disabled={isLoading} className="btn btn-primary w-full py-3 bg-amber-500 hover:bg-amber-600">
                                    {isLoading ? t('auth.verifying') : <><KeyRound className="w-5 h-5 inline mr-2" />{t('auth.verifyPin')}</>}
                                </button>
                            </div>
                        )}

                        {/* PASSWORD SETUP after PIN verified */}
                        {loginMode === 'pin' && pinVerified && (
                            <div className="space-y-5">
                                <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-green-800">
                                    ✓ {t('auth.pinVerified').replace('!', '')} <strong>{firstName}</strong>
                                </div>
                                <div>
                                    <label className="label">{t('auth.setPassword')}</label>
                                    <div className="relative">
                                        <input type={showPassword ? 'text' : 'password'} className="input pr-12" placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="label">{t('auth.confirmPassword')}</label>
                                    <input type={showPassword ? 'text' : 'password'} className="input" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                </div>
                                <button type="button" onClick={handleSetPassword} disabled={isLoading} className="btn btn-primary w-full py-3">
                                    {isLoading ? t('auth.settingUp') : <><LogIn className="w-5 h-5 inline mr-2" />{t('auth.setPasswordLogin')}</>}
                                </button>
                            </div>
                        )}

                        {/* Demo Credentials */}
                        {loginMode === 'password' && (
                            <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                                <p className="text-sm font-medium text-slate-700 mb-2">{t('auth.demoCredentials')}:</p>
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
