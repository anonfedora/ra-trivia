"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiJson } from '../../lib/api';
import PasswordInput from '../../components/PasswordInput';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
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

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const result = await apiJson<{ token: string; user: any; message?: string }>(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (result.ok) {
            localStorage.setItem('token', result.data.token);
            localStorage.setItem('user', JSON.stringify(result.data.user));
            router.push(result.data.user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
        } else {
            setError(('error' in result && result.error) ? result.error : 'Login failed');
        }
    };

    return (
        <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-100 animate-slide-up">
                <div className="text-center mb-8">
                    <img 
                        src="/favicon.png" 
                        alt="RA Logo" 
                        className="w-16 h-16 mx-auto mb-4 rounded-lg"
                    />
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h2>
                    <p className="text-slate-500">Please enter your credentials to access the quiz portal.</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-medium border border-red-100">
                        {error}
                    </div>
                )}

                {info && !error && (
                    <div className="bg-green-50 text-green-700 p-4 rounded-2xl mb-6 text-sm font-medium border border-green-100">
                        {info}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 font-medium"
                            placeholder="e.g. john@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                        <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-primary hover:bg-primary/90 text-white py-5 rounded-2xl font-bold shadow-lg shadow-primary/20 transform transition-all hover:-translate-y-1 active:scale-95 mt-4"
                    >
                        Sign In
                    </button>
                </form>

                <p className="mt-8 text-center text-slate-500 text-sm">
                    Don&apos;t have an account? <Link href="/register" className="text-primary font-bold hover:underline">Register here</Link>
                </p>
                <p className="mt-2 text-center text-slate-500 text-sm">
                    Are you an admin? <span className="text-primary font-bold">Log in with your credentials</span>
                </p>
            </div>
        </main>
    );
}
