"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiJson } from '../../lib/api';

function VerifyOTPContent() {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const isSubmitting = useRef(false);

    // Get email from URL params if provided
    useEffect(() => {
        const emailParam = searchParams.get('email');
        if (emailParam) {
            setEmail(emailParam);
        }
    }, [searchParams]);

    const handleInputChange = (index: number, value: string) => {
        // Reset submitting flag when user changes OTP
        if (error) {
            isSubmitting.current = false;
        }

        // Only allow numbers
        const numValue = value.replace(/\D/g, '');

        const newOtp = [...otp];
        newOtp[index] = numValue.slice(-1); // Only take last digit
        setOtp(newOtp);

        // Auto-focus next input
        if (numValue && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    // Auto-submit when all 6 digits are entered
    useEffect(() => {
        const otpString = otp.join('');
        // Only trigger if we have 6 digits, we aren't already loading, 
        // we haven't already succeeded, and we aren't already in the middle of a submission timer
        if (otpString.length === 6 && !isLoading && !isSubmitting.current && !success) {
            isSubmitting.current = true;
            const timer = setTimeout(() => {
                handleVerifyOTP({ preventDefault: () => { } } as React.FormEvent);
            }, 500);

            return () => {
                clearTimeout(timer);
            };
        }

        // Reset submitting flag if OTP changes and is not 6 digits
        if (otpString.length !== 6) {
            isSubmitting.current = false;
        }
    }, [otp.join(''), success]); // Removed isLoading from deps to prevent re-triggering after successful verification

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newOtp = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
        setOtp(newOtp);

        // Reset auto-submit flag when pasting to allow auto-submit
        isSubmitting.current = false;

        // Focus the next empty input or the last filled one
        const nextIndex = Math.min(pastedData.length, 5);
        setTimeout(() => {
            inputRefs.current[nextIndex]?.focus();
        }, 0);
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        // Handle backspace
        if (e.key === 'Backspace') {
            if (!otp[index] && index > 0) {
                inputRefs.current[index - 1]?.focus();
            }
        }
        // Handle Tab key to jump to next input
        if (e.key === 'Tab' && index < 5) {
            e.preventDefault();
            inputRefs.current[index + 1]?.focus();
        }
    };

    const otpString = otp.join('');

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prevent multiple submissions if already loading or already successful
        if (isLoading || success) return;

        setError('');
        setSuccess('');
        setIsLoading(true);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

        try {
            const response = await apiJson(`${apiUrl}/auth/verify-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, otp: otpString }),
            });

            if (response.ok && response.data) {
                const data = response.data as any;
                if (data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    setSuccess('Email verified successfully! Redirecting...');

                    setTimeout(() => {
                        router.push('/dashboard');
                    }, 1500);
                }
            } else {
                setError(!response.ok ? (response as any).error : 'Verification failed. Please try again.');
                isSubmitting.current = false; // Reset flag on error
            }
        } catch (err: any) {
            setError('Verification failed. Please try again.');
            isSubmitting.current = false; // Reset flag on error
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setError('');
        setSuccess('');
        setIsLoading(true);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

        try {
            const response = await apiJson(`${apiUrl}/auth/resend-verification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            if (response.ok) {
                setSuccess('New OTP sent to your email!');
                // Clear OTP inputs
                setOtp(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
            } else {
                setError(!response.ok ? (response as any).error : 'Failed to resend OTP.');
            }
        } catch (err: any) {
            setError('Failed to resend OTP.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl shadow-slate-200/50 p-8 border border-white/20">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mb-6 shadow-lg">
                            <span className="text-white font-bold text-2xl">RA</span>
                        </div>
                        <h1 className="text-4xl font-bold text-slate-800 mb-3">Verify Email</h1>
                        <p className="text-slate-600 text-lg">Enter the 6-digit code sent to</p>
                        <p className="text-slate-700 font-semibold">{email || 'your email'}</p>
                    </div>

                    <form onSubmit={handleVerifyOTP} className="space-y-8">
                        {/* OTP Input Boxes */}
                        <div className="flex justify-center gap-3 mb-4">
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => { inputRefs.current[index] = el; }}
                                    type="text"
                                    value={digit}
                                    onChange={(e) => handleInputChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    onPaste={index === 0 ? handlePaste : undefined}
                                    className="w-14 h-14 text-center text-2xl font-bold bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none text-slate-900"
                                    maxLength={1}
                                    required
                                    placeholder="•"
                                />
                            ))}
                        </div>

                        {error && (
                            <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
                                <p className="text-red-600 text-sm font-medium">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="p-4 rounded-2xl bg-green-50 border border-green-100">
                                <p className="text-green-600 text-sm font-medium">{success}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || otpString.length !== 6}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-5 rounded-2xl font-bold text-lg shadow-lg shadow-blue-600/20 transform transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                        >
                            {isLoading ? 'Verifying...' : 'Verify Email'}
                        </button>

                        <div className="text-center space-y-2">
                            <button
                                type="button"
                                onClick={handleResendOTP}
                                disabled={isLoading || !email}
                                className="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors disabled:opacity-50"
                            >
                                Didn&apos;t receive the code? Resend
                            </button>
                            <p className="text-slate-500 text-xs">
                                The code will expire in 10 minutes
                            </p>
                        </div>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-slate-500 text-sm">
                            Already verified? <a href="/login" className="text-blue-600 font-bold hover:underline">Sign In</a>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}

export default function VerifyOTPPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl shadow-slate-200/50 p-8 border border-white/20">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
                                <span className="text-white font-bold text-xl">RA</span>
                            </div>
                            <h1 className="text-3xl font-bold text-slate-800 mb-2">Loading...</h1>
                        </div>
                    </div>
                </div>
            </main>
        }>
            <VerifyOTPContent />
        </Suspense>
    );
}
