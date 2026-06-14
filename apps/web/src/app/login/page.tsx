"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch } from '../../lib/api';
import { setAuthTokens } from '../../lib/auth';
import { ThemeToggle } from '../../components/ThemeToggle';
import PasswordInput from '../../components/PasswordInput';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const verified = params.get('verified');
        if (verified === '1') setInfo('Email verified. You can now log in.');
        if (verified === '0') setInfo('Verification link is invalid or expired.');
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await apiFetch('auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                setAuthTokens({
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken
                }, data.user);
                
                // Handle both ADMIN and SUPER_ADMIN redirection
                if (data.user.role === 'ADMIN' || data.user.role === 'SUPER_ADMIN') {
                    router.push('/admin/dashboard');
                } else {
                    router.push('/dashboard');
                }
            } else {
                // Handle unverified user redirect
                if (data?.isUnverified) {
                    router.push(`/verify-otp?email=${encodeURIComponent(data.email)}`);
                    return;
                }

                setError(data?.message || data?.error || 'Login failed');
                setIsLoading(false);
            }
        } catch (err) {
            setError('Login failed');
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-6 transition-colors duration-200">
            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-100 dark:border-slate-700 animate-slide-up">
                <div className="text-center mb-8">
                    <Image
                        src="/favicon.png"
                        alt="RA Logo"
                        width={64}
                        height={64}
                        className="w-16 h-16 mx-auto mb-4 rounded-lg"
                    />
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">Welcome Back</h2>
                    <p className="text-slate-500 dark:text-slate-400">Please enter your credentials to access the exams portal.</p>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl mb-6 text-sm font-medium border border-red-100 dark:border-red-900/50">
                        {error}
                    </div>
                )}

                {info && !error && (
                    <div className="bg-green-50 dark:bg-emerald-900/20 text-green-700 dark:text-emerald-400 p-4 rounded-2xl mb-6 text-sm font-medium border border-green-100 dark:border-emerald-900/50">
                        {info}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 dark:text-slate-50 font-medium"
                            placeholder="e.g. john@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Password</label>
                            <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                                Forgot password?
                            </Link>
                        </div>
                        <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-primary/90 text-white py-5 rounded-2xl font-bold shadow-lg shadow-primary/20 transform transition-all hover:-translate-y-1 active:scale-95 mt-4 disabled:opacity-50"
                    >
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                {/* Prominent Registration Section */}
                <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-2">New Candidate?</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">Create your account to take Exam</p>
                        <Link 
                            href="/register"
                            className="inline-block w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 px-6 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transform transition-all hover:-translate-y-1 active:scale-95 text-center"
                        >
                            Create New Account
                        </Link>
                    </div>
                </div>

                <p className="mt-6 text-center text-slate-500 dark:text-slate-400 text-sm">
                    Are you an admin? <span className="text-primary font-bold">Log in with your credentials above</span>
                </p>
            </div>
        </main>
    );
}
