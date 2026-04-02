"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Church, Shield, Calendar, ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { ThemeToggle } from '../../components/ThemeToggle';
import UserTypeSelector, { UserType } from '../../components/UserTypeSelector';
import { getUser, getAccessToken, updateUser, updateAccessToken, updateRefreshToken } from '../../lib/auth';
import { apiFetch } from '../../lib/api';

interface UserProfile {
    id: string;
    email: string;
    name: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'CANDIDATE';
    userType: UserType;
    church?: string;
    association?: string;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
}

export default function ProfilePage() {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        church: '',
        association: '',
        userType: null as UserType | null
    });
    const router = useRouter();

    useEffect(() => {
        const storedUser = getUser();
        const token = getAccessToken();

        if (!storedUser || !token) {
            router.push('/login');
            return;
        }

        const fetchProfile = async () => {
            try {
                const response = await apiFetch('auth/profile');

                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                    setFormData({
                        name: data.user.name,
                        church: data.user.church || '',
                        association: data.user.association || '',
                        userType: data.user.userType
                    });
                } else {
                    setError('Failed to load profile');
                }
            } catch (err) {
                console.error('Failed to fetch profile', err);
                setError('Failed to load profile');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [router]);

    const handleSave = async () => {
        if (!user) return;

        setIsSaving(true);
        setError(null);
        setSuccess(null);

        const token = getAccessToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

        try {
            const response = await apiFetch('auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                setUser(data.user);
                setSuccess('Profile updated successfully!');
                
                // Update utilities with new data
                updateUser(data.user);
                
                // If new tokens were provided (userType changed), update them
                if (data.accessToken) {
                    updateAccessToken(data.accessToken);
                }
                if (data.refreshToken) {
                    updateRefreshToken(data.refreshToken);
                }
            } else {
                setError(data.message || 'Failed to update profile');
            }
        } catch (err) {
            console.error('Failed to update profile', err);
            setError('Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getUserTypeLabel = (userType: UserType) => {
        const labels = {
            'AMBASSADOR_RANK_EXAMS': 'Ambassador Rank Exams',
            'EXTRAORDINARY_RANK_EXAMS': 'Extraordinary Rank Exams',
            'PRE_PLENIPOTENTIARY_EXAMS': 'Pre-Plenipotentiary Exams',
            'PLENIPOTENTIARY_RANK_EXAMS': 'Plenipotentiary Rank Exams'
        };
        return labels[userType];
    };

    const getRoleLabel = (role: string) => {
        const labels = {
            'CANDIDATE': 'Candidate',
            'ADMIN': 'Administrator',
            'SUPER_ADMIN': 'Super Administrator'
        };
        return labels[role as keyof typeof labels] || role;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
                <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">Profile Not Found</h1>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">Unable to load your profile information.</p>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-semibold hover:bg-primary/90 transition-all"
                    >
                        <ArrowLeft size={18} />
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 transition-colors duration-200">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-12 animate-fade-in">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"
                        >
                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                        </Link>
                        <div>
                            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50">Profile Management</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">Manage your account information and examination preferences</p>
                        </div>
                    </div>
                    <ThemeToggle />
                </header>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={18} className="text-red-600 dark:text-red-400" />
                            <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl">
                        <p className="text-green-700 dark:text-green-300 font-medium">{success}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Profile Information Card */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl border border-slate-100 dark:border-slate-700 animate-slide-up">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8 flex items-center gap-2">
                                <User className="text-primary" size={24} />
                                Profile Information
                            </h2>

                            <div className="space-y-6">
                                {/* Name Field */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-primary/10 focus:ring-4 transition-all outline-none text-slate-900 dark:text-slate-50 font-medium"
                                        placeholder="Enter your full name"
                                    />
                                </div>

                                {/* Church Field */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                                        Church (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.church}
                                        onChange={(e) => setFormData({ ...formData, church: e.target.value })}
                                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-primary/10 focus:ring-4 transition-all outline-none text-slate-900 dark:text-slate-50 font-medium"
                                        placeholder="Enter your church name"
                                    />
                                </div>

                                {/* Association Field */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                                        Association (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.association}
                                        onChange={(e) => setFormData({ ...formData, association: e.target.value })}
                                        className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-primary/10 focus:ring-4 transition-all outline-none text-slate-900 dark:text-slate-50 font-medium"
                                        placeholder="Enter your association name"
                                    />
                                </div>

                                {/* User Type Selector */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                                        Examination Type
                                    </label>
                                    <UserTypeSelector
                                        value={formData.userType}
                                        onChange={(userType) => setFormData({ ...formData, userType })}
                                        required
                                    />
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                        Changing your examination type will affect which quizzes you can access.
                                    </p>
                                </div>

                                {/* Save Button */}
                                <div className="pt-4">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
                                    >
                                        {isSaving ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        ) : (
                                            <Save size={18} />
                                        )}
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Account Details Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-xl border border-slate-100 dark:border-slate-700 animate-fade-in">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">Account Details</h3>
                            
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                    <Mail size={18} className="text-slate-400" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</p>
                                        <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{user.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                    <Shield size={18} className="text-slate-400" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</p>
                                        <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{getRoleLabel(user.role)}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                    <Calendar size={18} className="text-slate-400" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Member Since</p>
                                        <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{formatDate(user.createdAt)}</p>
                                    </div>
                                </div>

                                {user.church && (
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                        <Church size={18} className="text-slate-400" />
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Church</p>
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{user.church}</p>
                                        </div>
                                    </div>
                                )}

                                {user.association && (
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                        <Church size={18} className="text-slate-400" />
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Association</p>
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{user.association}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-primary/5 dark:bg-primary/10 rounded-[2.5rem] p-6 border border-primary/20">
                            <h3 className="text-lg font-bold text-primary mb-3">Current Examination Type</h3>
                            <p className="text-primary font-medium">{getUserTypeLabel(user.userType)}</p>
                            <p className="text-sm text-primary/70 mt-2">
                                You can only access quizzes that match your selected examination type.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}