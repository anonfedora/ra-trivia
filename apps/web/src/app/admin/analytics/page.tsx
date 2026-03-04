"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Users, TrendingUp, Activity, Eye, Download, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '../../../components/ThemeToggle';

interface QuizAnalytics {
    id: string;
    title: string;
    totalAttempts: number;
    passCount: number;
    failCount: number;
    highestScore: number;
    lowestScore: number;
    averageScore: number;
    completionRate: number;
    averageTime: number;
}

export default function AnalyticsPage() {
    const [analytics, setAnalytics] = useState<QuizAnalytics[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('token');
            const user = localStorage.getItem('user');

            if (!token || !user) {
                router.push('/login');
                return;
            }

            const userData = JSON.parse(user);
            if (userData.role !== 'ADMIN' && userData.role !== 'SUPER_ADMIN') {
                router.push('/dashboard');
                return;
            }

            try {
                const [analyticsRes, statsRes] = await Promise.all([
                    fetch(`${apiUrl}/admin/analytics`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${apiUrl}/admin/global-stats`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                if (analyticsRes.ok && statsRes.ok) {
                    const analyticsData = await analyticsRes.json();
                    const statsData = await statsRes.json();
                    setAnalytics(analyticsData);
                    setStats(statsData);
                }
            } catch (err) {
                console.error('Failed to fetch analytics', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [apiUrl, router]);

    const handleViewDetails = (quizTitle: string) => {
        router.push(`/admin/results?q=${encodeURIComponent(quizTitle)}`);
    };

    const handleExport = async (quizId: string) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/admin/export/${quizId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `quiz-report-${quizId}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Export failed', err);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 transition-colors duration-200">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 animate-fade-in">
                    <div>
                        <Link href="/admin/dashboard" className="flex items-center gap-2 text-primary font-bold mb-4 hover:gap-3 transition-all">
                            <ArrowLeft size={18} />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">Exam Analytics</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Performance metrics and engagement data for all targets.</p>
                    </div>
                    <ThemeToggle />
                </header>

                {/* Global Stats Grid */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                        {[
                            { label: 'Total Exams', value: stats.totalQuizzes, icon: <BarChart3 className="text-blue-500" /> },
                            { label: 'Total Candidates', value: stats.totalCandidates, icon: <Users className="text-emerald-500" /> },
                            { label: 'Total Attempts', value: stats.totalAttempts, icon: <TrendingUp className="text-amber-500" /> },
                            { label: 'Global Avg Score', value: `${stats.averageScore}%`, icon: <Activity className="text-rose-500" /> }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 animate-scale-in" style={{ animationDelay: `${i * 100}ms` }}>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                                        {stat.icon}
                                    </div>
                                </div>
                                <div className="text-3xl font-black text-slate-900 dark:text-slate-50 mb-1">{stat.value}</div>
                                <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Individual Quiz Analytics Table */}
                <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-slide-up" style={{ animationDelay: '400ms' }}>
                    <div className="p-8 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Performance by Exam</h3>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pass Threshold: 50%</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest border-b border-slate-50 dark:border-slate-700">
                                    <th className="px-8 py-6">Exam Title</th>
                                    <th className="px-8 py-6">Attempts</th>
                                    <th className="px-8 py-6">Performance</th>
                                    <th className="px-8 py-6">High / Low</th>
                                    <th className="px-8 py-6">Avg Score</th>
                                    <th className="px-8 py-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {analytics.map((quiz) => (
                                    <tr key={quiz.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                        <td className="px-8 py-6 font-bold text-slate-900 dark:text-slate-100">{quiz.title}</td>
                                        <td className="px-8 py-6">
                                            <div className="text-slate-700 dark:text-slate-300 font-bold">{quiz.totalAttempts}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{quiz.completionRate}% Completion</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-emerald-500 uppercase tracking-tighter">PASS: {quiz.passCount}</span>
                                                    <span className="text-rose-400 uppercase tracking-tighter">FAIL: {quiz.failCount}</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                                    <div className="h-full bg-emerald-500" style={{ width: quiz.totalAttempts > 0 ? `${(quiz.passCount / (quiz.passCount + quiz.failCount || 1)) * 100}%` : '0%' }} />
                                                    <div className="h-full bg-rose-400" style={{ width: quiz.totalAttempts > 0 ? `${(quiz.failCount / (quiz.passCount + quiz.failCount || 1)) * 100}%` : '0%' }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">H: {quiz.highestScore}%</span>
                                                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 italic">L: {quiz.lowestScore}%</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 uppercase">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-lg font-black ${quiz.averageScore >= 70 ? 'text-emerald-500' : quiz.averageScore >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                    {quiz.averageScore}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => handleViewDetails(quiz.title)}
                                                    className="p-2 text-slate-400 hover:text-primary transition-colors"
                                                    title="View Results"
                                                >
                                                    <Eye size={20} />
                                                </button>
                                                <button
                                                    onClick={() => handleExport(quiz.id)}
                                                    className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
                                                    title="Export Excel"
                                                >
                                                    <Download size={20} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    );
}
