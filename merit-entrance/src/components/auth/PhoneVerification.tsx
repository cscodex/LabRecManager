
'use client';

import { useState, useEffect } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Phone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PhoneVerificationProps {
    currentPhone?: string;
    isVerified?: boolean;
    onVerificationComplete?: (phone: string) => void;
}

export default function PhoneVerification({ currentPhone, isVerified: initialVerified, onVerificationComplete }: PhoneVerificationProps) {
    const [phoneNumber, setPhoneNumber] = useState(currentPhone || '');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'input' | 'otp' | 'verified'>(initialVerified ? 'verified' : 'input');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [isVerified, setIsVerified] = useState(initialVerified);

    useEffect(() => {
        if (!initialVerified && !window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': () => {
                    // reCAPTCHA solved
                }
            });
        }
    }, [initialVerified]);

    const formatPhone = (phone: string) => {
        // Ensure +91 or other code. Defaulting to +91 if missing for India context, or require user to type it.
        // For simplicity, ask user to include country code or prepend +91 if 10 digits
        if (phone.length === 10 && !phone.startsWith('+')) {
            return `+91${phone}`;
        }
        return phone;
    };

    const handleSendOtp = async () => {
        if (!phoneNumber || phoneNumber.length < 10) {
            toast.error('Please enter a valid phone number');
            return;
        }

        setLoading(true);
        const formattedPhone = formatPhone(phoneNumber);

        try {
            const appVerifier = window.recaptchaVerifier;
            const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
            setConfirmationResult(confirmation);
            setStep('otp');
            toast.success('OTP sent to ' + formattedPhone);
        } catch (error: any) {
            console.error('Error sending OTP:', error);
            toast.error(error.message || 'Failed to send OTP');
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.clear(); // Reset reCAPTCHA
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || !confirmationResult) return;

        setLoading(true);
        try {
            const result = await confirmationResult.confirm(otp);
            const user = result.user;
            const idToken = await user.getIdToken();

            // Send to backend
            const response = await fetch('/api/auth/verify-phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            });

            const data = await response.json();
            if (response.ok) {
                toast.success('Phone verified successfully!');
                setIsVerified(true);
                setStep('verified');
                if (onVerificationComplete) onVerificationComplete(data.phone);
            } else {
                toast.error(data.error || 'Verification failed on server');
            }
        } catch (error) {
            console.error('Error verifying OTP:', error);
            toast.error('Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'verified' || isVerified) {
        return (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Phone Verified: {phoneNumber}</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div id="recaptcha-container"></div>

            {step === 'input' && (
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Verify Phone Number</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="+91 98765 43210"
                                className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={handleSendOtp}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 min-w-[100px] flex items-center justify-center"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP'}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">
                        We will send a verification code to this number via SMS (Firebase).
                    </p>
                </div>
            )}

            {step === 'otp' && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-gray-700">Enter OTP</label>
                        <button
                            onClick={() => setStep('input')}
                            className="text-xs text-blue-600 hover:underline"
                        >
                            Change Number?
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="123456"
                            className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-lg"
                            maxLength={6}
                        />
                        <button
                            onClick={handleVerifyOtp}
                            disabled={loading}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 min-w-[100px] flex items-center justify-center"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Global declaration for RecaptchaVerifier
declare global {
    interface Window {
        recaptchaVerifier: any;
    }
}
