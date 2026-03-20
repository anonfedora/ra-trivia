"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { ThemeToggle } from '../../components/ThemeToggle';
import PasswordInput from '../../components/PasswordInput';
import PasswordStrength from '../../components/PasswordStrength';

function ResetPasswordForm() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [token, setToken] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    useEffect(() => {
        const t = searchParams?.get('token') || '';
        if (!t) {
            setError('Invalid or missing reset token. Please request a new link.');
        }
        setToken(t);
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${apiUrl}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });
            const data = await res.json();
            if (res.ok) {
                setSuccess(true);
                setTimeout(() => router.push('/login'), 3000);
            } else {
                setError(data.message || 'Something went wrong.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-700 animate-slide-up">
            <Link href="/login" className="flex items-center gap-2 text-primary font-bold mb-6 hover:gap-3 transition-all text-sm">
                <ArrowLeft size={16} /> Back to Login
            </Link>

            {success ? (
                <div className="text-center py-4">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={28} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">Password Reset!</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Your password has been updated. Redirecting to login...</p>
                </div>
            ) : (
                <>
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">Set New Password</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Choose a strong password for your account.</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl mb-6 text-sm font-medium border border-red-100 dark:border-red-900/50">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">New Password</label>
                            <PasswordInput
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                            <PasswordStrength password={password} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Confirm Password</label>
                            <PasswordInput
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || !token}
                            className="w-full bg-primary hover:bg-primary/90 text-white py-5 rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 mt-2"
                        >
                            {isLoading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>
                </>
            )}
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <main className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-6 transition-colors duration-200">
            <div className="absolute top-6 right-6 z-50"><ThemeToggle /></div>
            <Suspense fallback={<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />}>
                <ResetPasswordForm />
            </Suspense>
        </main>
    );
}
