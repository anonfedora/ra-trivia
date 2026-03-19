"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiJson } from '../../lib/api';
import { ThemeToggle } from '../../components/ThemeToggle';
import PasswordInput from '../../components/PasswordInput';
import UserTypeSelector, { UserType } from '../../components/UserTypeSelector';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [church, setChurch] = useState('');
    const [association, setAssociation] = useState('');
    const [userType, setUserType] = useState<UserType | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        // Validate user type selection
        if (!userType) {
            setError('Please select an examination type');
            setIsLoading(false);
            return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const result = await apiJson<{ user: any; message?: string; isUnverified?: boolean }>(`${apiUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, password, church, association, userType })
        });

        if (result.ok && (result.data?.user || result.data?.isUnverified)) {
            // Redirect to OTP verification page
            router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
            return;
        } else {
            setError('error' in result ? result.error : 'Registration failed');
        }

        setIsLoading(false);
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
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">Create Account</h2>
                    <p className="text-slate-500 dark:text-slate-400">Join the exam portal to.</p>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl mb-6 text-sm font-medium border border-red-100 dark:border-red-900/50">
                        {error}
                    </div>
                )}

                {success && !error && (
                    <div className="bg-green-50 dark:bg-emerald-900/20 text-green-700 dark:text-emerald-400 p-4 rounded-2xl mb-6 text-sm font-medium border border-green-100 dark:border-emerald-900/50">
                        {success}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-6">
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
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Full Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 dark:text-slate-50 font-medium"
                            placeholder="e.g. John Doe"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Church</label>
                        <input
                            type="text"
                            value={church}
                            onChange={(e) => setChurch(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 dark:text-slate-50 font-medium"
                            placeholder="e.g. Gaskiya Baptist Church"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Association</label>
                        <input
                            type="text"
                            value={association}
                            onChange={(e) => setAssociation(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 dark:text-slate-50 font-medium"
                            placeholder="e.g. Narayi Baptist Association"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Examination Type *</label>
                        <UserTypeSelector
                            value={userType}
                            onChange={setUserType}
                            required
                            error={!userType && error === 'Please select an examination type' ? error : undefined}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Password</label>
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
                        {isLoading ? 'Creating Account...' : 'Register Now'}
                    </button>
                </form>

                <p className="mt-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                    Already have an account? <Link href="/login" className="text-primary font-bold hover:underline">Sign In</Link>
                </p>
            </div>
        </main>
    );
}
