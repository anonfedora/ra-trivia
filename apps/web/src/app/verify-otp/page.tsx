"use client";

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiJson } from '../../lib/api';

import { ThemeToggle } from '../../components/ThemeToggle';

export const dynamic = 'force-dynamic';

function VerifyOTPContent() {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(60);
    const router = useRouter();
    const searchParams = useSearchParams();
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const isSubmitting = useRef(false);

    // Ensure client-side rendering for search params
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Get email from URL params only on client side
    useEffect(() => {
        if (isClient && searchParams) {
            const emailFromUrl = searchParams.get('email') || '';
            if (emailFromUrl) {
                setEmail(emailFromUrl);
            }
        }
    }, [isClient, searchParams]);

    // Auto-focus first input once client is ready
    useEffect(() => {
        if (isClient) {
            setTimeout(() => {
                inputRefs.current[0]?.focus();
            }, 100);
        }
    }, [isClient]);

    // Resend cooldown countdown
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

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

    const otpString = otp.join('');

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

    const handleVerifyOTP = useCallback(async (e: React.FormEvent) => {
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
    }, [email, isLoading, otpString, router, success]);

    // Auto-submit when all 6 digits are entered
    useEffect(() => {
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
    }, [otpString, success, isLoading, handleVerifyOTP]);

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
                setResendCooldown(60);
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
        <main className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-6 transition-colors duration-200">
            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl p-6 sm:p-8 border border-slate-100 dark:border-slate-700 animate-slide-up">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-3xl mb-6 shadow-lg">
                            <span className="text-white font-bold text-2xl">RA</span>
                        </div>
                        <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-50 mb-3">Verify Email</h1>
                        <p className="text-slate-600 dark:text-slate-400 text-lg">Enter the 6-digit code sent to</p>
                        <p className="text-slate-700 dark:text-slate-300 font-semibold">
                            {isClient ? (email || 'your email') : 'your email'}
                        </p>
                    </div>

                    <form onSubmit={handleVerifyOTP} className="space-y-8">
                        {/* OTP Input Boxes */}
                        <div className="flex justify-center gap-2 sm:gap-3 mb-4 px-2">
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(el) => { inputRefs.current[index] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    value={digit}
                                    onChange={(e) => handleInputChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    onPaste={index === 0 ? handlePaste : undefined}
                                    className="w-10 h-12 sm:w-14 sm:h-14 text-center text-xl sm:text-2xl font-bold bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl sm:rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 dark:text-slate-50"
                                    maxLength={1}
                                    required
                                    placeholder="•"
                                />
                            ))}
                        </div>

                        {error && (
                            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50">
                                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="p-4 rounded-2xl bg-green-50 dark:bg-emerald-900/20 border border-green-100 dark:border-emerald-900/50">
                                <p className="text-green-600 dark:text-emerald-400 text-sm font-medium">{success}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || otpString.length !== 6}
                            className="w-full bg-primary hover:bg-primary/90 text-white py-5 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 transform transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                        >
                            {isLoading ? 'Verifying...' : 'Verify Email'}
                        </button>

                        <div className="text-center space-y-2">
                            <button
                                type="button"
                                onClick={handleResendOTP}
                                disabled={isLoading || !email || !isClient || resendCooldown > 0}
                                className="text-primary hover:underline font-medium text-sm transition-colors disabled:opacity-50"
                            >
                                {resendCooldown > 0
                                    ? `Resend in ${resendCooldown}s`
                                    : "Didn't receive the code? Resend"}
                            </button>
                            <p className="text-slate-500 dark:text-slate-500 text-xs">
                                The code will expire in 10 minutes
                            </p>
                        </div>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            Already verified? <a href="/login" className="text-primary font-bold hover:underline">Sign In</a>
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
            <main className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-6 transition-colors duration-200">
                <div className="absolute top-6 right-6 z-50">
                    <ThemeToggle />
                </div>
                <div className="w-full max-w-md">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 dark:border-slate-700 animate-slide-up">
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-3xl mb-6 shadow-lg">
                                <span className="text-white font-bold text-2xl">RA</span>
                            </div>
                            <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-50 mb-3">Verify Email</h1>
                            <p className="text-slate-600 dark:text-slate-400 text-lg">Loading...</p>
                        </div>
                    </div>
                </div>
            </main>
        }>
            <VerifyOTPContent />
        </Suspense>
    );
}
