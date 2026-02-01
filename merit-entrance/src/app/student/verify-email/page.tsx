'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Mail, Clock, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const email = searchParams.get('email') || '';
    const expired = searchParams.get('expired') === 'true';
    const pending = searchParams.get('pending') === 'true';

    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);
    const [timeRemaining, setTimeRemaining] = useState('');

    useEffect(() => {
        // Set initial expiry (24 hours from now or from stored value)
        const storedExpiry = localStorage.getItem(`verificationExpiry_${email}`);
        if (storedExpiry) {
            setExpiresAt(new Date(storedExpiry));
        } else if (!expired) {
            const newExpiry = new Date();
            newExpiry.setHours(newExpiry.getHours() + 24);
            setExpiresAt(newExpiry);
            localStorage.setItem(`verificationExpiry_${email}`, newExpiry.toISOString());
        }
    }, [email, expired]);

    useEffect(() => {
        if (!expiresAt) return;

        const updateTimer = () => {
            const now = new Date();
            const diff = expiresAt.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeRemaining('Expired');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [expiresAt]);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleResendVerification = async () => {
        if (!email || isResending || resendCooldown > 0) return;

        setIsResending(true);
        try {
            const response = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Verification email sent! Check your inbox.');
                setResendCooldown(60); // 60 second cooldown
                if (data.expiresAt) {
                    const newExpiry = new Date(data.expiresAt);
                    setExpiresAt(newExpiry);
                    localStorage.setItem(`verificationExpiry_${email}`, newExpiry.toISOString());
                }
            } else {
                toast.error(data.error || 'Failed to send verification email');
            }
        } catch (error) {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-8 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                            <Mail className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">Verify Your Email</h1>
                        <p className="text-blue-100 mt-2">Check your inbox to complete registration</p>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {expired && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-red-800 font-medium">Verification link expired</p>
                                    <p className="text-red-600 text-sm mt-1">
                                        Your verification link has expired. Please request a new one.
                                    </p>
                                </div>
                            </div>
                        )}

                        {pending && !expired && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-blue-800 font-medium">Verification email sent</p>
                                    <p className="text-blue-600 text-sm mt-1">
                                        We&apos;ve sent a verification link to <strong>{email}</strong>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Email Display */}
                        <div className="text-center">
                            <p className="text-gray-600 text-sm">Verification email sent to:</p>
                            <p className="text-gray-900 font-medium mt-1">{email || 'your email address'}</p>
                        </div>

                        {/* Timer */}
                        {timeRemaining && timeRemaining !== 'Expired' && (
                            <div className="bg-gray-50 rounded-lg p-4 text-center">
                                <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
                                    <Clock className="w-4 h-4" />
                                    <span className="text-sm">Link expires in:</span>
                                </div>
                                <p className="text-2xl font-bold text-blue-600">{timeRemaining}</p>
                            </div>
                        )}

                        {/* Resend Button */}
                        <button
                            onClick={handleResendVerification}
                            disabled={isResending || resendCooldown > 0}
                            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isResending ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Sending...
                                </>
                            ) : resendCooldown > 0 ? (
                                `Resend in ${resendCooldown}s`
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4" />
                                    Resend Verification Email
                                </>
                            )}
                        </button>

                        {/* Back to Login */}
                        <button
                            onClick={() => router.push('/')}
                            className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all"
                        >
                            Back to Login
                        </button>

                        {/* Help Text */}
                        <p className="text-center text-gray-500 text-sm">
                            Didn&apos;t receive the email? Check your spam folder or click the resend button above.
                        </p>
                    </div>
                </div>

                <p className="text-center text-blue-200 text-sm mt-6">
                    © 2026 Merit Entrance
                </p>
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full" />
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
