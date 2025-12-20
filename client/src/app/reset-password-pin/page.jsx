'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ResetPasswordPinPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: '',
        pin: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.newPassword !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (formData.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        if (formData.pin.length !== 6) {
            toast.error('PIN must be 6 digits');
            return;
        }

        try {
            setLoading(true);
            const response = await api.post('/pin/reset-with-pin', {
                email: formData.email,
                pin: formData.pin,
                newPassword: formData.newPassword
            });

            toast.success(response.data.message);
            router.push('/login');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Back to login */}
                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Login</span>
                </Link>

                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <KeyRound className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
                        <p className="text-slate-600 mt-2">
                            Enter your email, the PIN provided by your administrator, and your new password
                        </p>
                        <p className="text-slate-500 text-sm mt-1">
                            अपना ईमेल, व्यवस्थापक द्वारा दिया गया पिन और नया पासवर्ड दर्ज करें
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Email / ईमेल
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="Enter your email"
                                    className="input pl-10"
                                />
                            </div>
                        </div>

                        {/* PIN */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                6-Digit PIN / 6-अंकीय पिन
                            </label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    name="pin"
                                    value={formData.pin}
                                    onChange={handleChange}
                                    required
                                    maxLength={6}
                                    placeholder="Enter 6-digit PIN"
                                    className="input pl-10 tracking-widest text-center font-mono text-lg"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                Get this PIN from your teacher or administrator
                            </p>
                        </div>

                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                New Password / नया पासवर्ड
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="newPassword"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                    placeholder="Enter new password"
                                    className="input pl-10 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Confirm Password / पासवर्ड की पुष्टि करें
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                    placeholder="Confirm new password"
                                    className="input pl-10"
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full py-3"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                    Resetting...
                                </span>
                            ) : (
                                'Reset Password'
                            )}
                        </button>
                    </form>

                    {/* Help text */}
                    <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-sm text-amber-800">
                            <strong>Need a PIN?</strong> Contact your class teacher or school administrator to generate a password reset PIN for your account.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
