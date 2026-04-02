"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import PasswordInput from '../../components/PasswordInput';

export default function SetupAdminPage() {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [church, setChurch] = useState('');
    const [role, setRole] = useState<'ADMIN' | 'SUPER_ADMIN'>('ADMIN');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            const response = await apiFetch('auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email, 
                    name, 
                    password, 
                    church,
                    role
                })
            });

            const data = await response.json();

            // Debug logging for development
            if (process.env.NODE_ENV === 'development') {
                console.log('Admin setup result:', {
                    ok: response.ok,
                    status: response.status,
                    data
                });
            }

            // Check for success
            if (response.ok && data) {
                if (data.user) {
                    // New account created successfully
                    const createdRole = data.user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin';
                    setSuccess(`${createdRole} account created successfully! Please check your email for verification code. Redirecting to verification...`);
                    
                    // Redirect to OTP verification page
                    setTimeout(() => {
                        router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
                    }, 2000);
                } else if (data.isUnverified) {
                    // Existing unverified account
                    setSuccess(`Account already exists but needs verification. A new verification code has been sent to ${data.email}. Redirecting to verification...`);
                    
                    // Redirect to OTP verification page
                    setTimeout(() => {
                        router.push(`/verify-otp?email=${encodeURIComponent(data.email || email)}`);
                    }, 2000);
                } else {
                    // Unexpected success response structure
                    setSuccess('Admin account processed successfully! Please check your email for verification code. Redirecting to verification...');
                    
                    setTimeout(() => {
                        router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
                    }, 2000);
                }
            } else {
                // Handle error cases properly
                const errorMessage = data?.message || data?.error || 'Failed to create admin account. Please try again.';
                setError(errorMessage);
                
                // Debug logging for development
                if (process.env.NODE_ENV === 'development') {
                    console.error('Admin setup failed:', {
                        ok: response.ok,
                        error: data?.error || 'Unknown error',
                        data
                    });
                }
            }
        } catch (error) {
            console.error('Admin setup error:', error);
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-100">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Admin Setup</h1>
                    <p className="text-slate-500 text-sm">Create the first administrator account</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-medium border border-red-100">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 text-green-700 p-4 rounded-2xl mb-6 text-sm font-medium border border-green-100">
                        {success}
                    </div>
                )}

                <form onSubmit={handleCreateAdmin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 font-medium"
                            placeholder="admin@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Full Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 font-medium"
                            placeholder="Administrator Name"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as 'ADMIN' | 'SUPER_ADMIN')}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 font-medium appearance-none cursor-pointer bg-no-repeat bg-right pr-12"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                                backgroundPosition: 'right 1rem center',
                                backgroundSize: '1.5em 1.5em'
                            }}
                            required
                        >
                            <option value="ADMIN">Administrator</option>
                            <option value="SUPER_ADMIN">Super Administrator</option>
                        </select>
                        <p className="text-xs text-slate-500 ml-1">
                            Administrator: Can manage quizzes and view results<br/>
                            Super Administrator: Full system access
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                        <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                        <p className="text-xs text-slate-500 ml-1">Must contain uppercase, lowercase, number, and special character</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Church</label>
                        <input
                            type="text"
                            value={church}
                            onChange={(e) => setChurch(e.target.value)}
                            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 font-medium"
                            placeholder="Church Name"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl font-bold shadow-lg shadow-red-600/20 transform transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
                    >
                        {isLoading ? 'Creating Admin...' : `Create ${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}`}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-200">
                    <p className="text-center text-xs text-slate-400">
                        This is a secure setup page. Only create admin accounts for trusted personnel.
                    </p>
                </div>
            </div>
        </main>
    );
}
