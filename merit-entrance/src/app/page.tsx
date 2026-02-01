'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import Link from 'next/link';
import { useTranslation } from '@/lib/useTranslation';
import { LanguageToggle } from '@/components/LanguageToggle';
import { BookOpen, User, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HomePage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const { t, isLoading: isLoadingTranslations } = useTranslation();
  const [loginType, setLoginType] = useState<'student' | 'admin'>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    identifier: '', // rollNumber for student, email for admin
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: loginType,
          identifier: formData.identifier,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        toast.success(t('auth.loginSuccess'));
        router.push(loginType === 'admin' ? '/admin/dashboard' : '/student/dashboard');
      } else {
        toast.error(data.error || t('auth.loginFailed'));
      }
    } catch (error) {
      toast.error(t('auth.somethingWentWrong'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      {/* Language Toggle - Top Right */}
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <BookOpen className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">{t('common.appName')}</h1>
          <p className="text-blue-200 mt-2">{t('common.tagline')}</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Login Type Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setLoginType('student')}
              className={`flex-1 py-4 text-center font-medium transition-colors ${loginType === 'student'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {t('auth.studentLogin')}
            </button>
            <button
              onClick={() => setLoginType('admin')}
              className={`flex-1 py-4 text-center font-medium transition-colors ${loginType === 'admin'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {t('auth.adminLogin')}
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Identifier Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {loginType === 'student' ? t('auth.rollNumber') : t('auth.email')}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={loginType === 'admin' ? 'email' : 'text'}
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                  placeholder={loginType === 'student' ? t('auth.enterRollNumber') : t('auth.enterEmail')}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={t('auth.enterPassword')}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('common.loggingIn')}
                </span>
              ) : (
                t('common.login')
              )}
            </button>

            {/* Register Link - Only for Students */}
            {loginType === 'student' && (
              <div className="text-center mt-2">
                <Link href="/student/register" className="text-sm font-medium text-blue-600 hover:text-blue-500 hover:underline">
                  Don&apos;t have an account? Create one
                </Link>
              </div>
            )}

            {/* Google Sign-In - Only for Students */}
            {loginType === 'student' && (
              <>
                <div className="relative flex items-center gap-4 my-4">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <span className="text-sm text-gray-500">{t('auth.orContinueWith') || 'Or continue with'}</span>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    // NextAuth v5 uses this URL format for direct provider sign-in
                    window.location.href = '/api/auth/signin/google?callbackUrl=/student/dashboard';
                  }}
                  className="w-full py-3 bg-white border-2 border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 focus:ring-4 focus:ring-gray-100 transition-all flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {t('auth.signInWithGoogle') || 'Sign in with Google'}
                </button>
              </>
            )}
          </form>

          {/* Footer Note */}
          <div className="px-6 pb-6">
            <p className="text-center text-sm text-gray-500">
              {loginType === 'student'
                ? t('auth.studentNote')
                : t('auth.adminNote')}
            </p>
          </div>
        </div>

        {/* Bottom Info */}
        <p className="text-center text-blue-200 text-sm mt-6">
          © 2026 {t('common.appName')} <span className="text-blue-300/70">• Build v443</span>
        </p>
      </div>
    </div>
  );
}
