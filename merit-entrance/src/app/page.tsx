'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
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
          © 2026 {t('common.appName')}
        </p>
      </div>
    </div>
  );
}
