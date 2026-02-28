"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, TrendingUp, Users, Clock, FileText, Download } from 'lucide-react';

interface QuizAnalytics {
    id: string;
    title: string;
    totalAttempts: number;
    averageScore: number;
    completionRate: number;
    averageTime: number;
}

interface GlobalStats {
    totalQuizzes: number;
    totalCandidates: number;
    totalAttempts: number;
    averageScore: number;
}

export default function AnalyticsPage() {
    const [analytics, setAnalytics] = useState<QuizAnalytics[]>([]);
    const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
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

        fetchAnalytics(token);
    }, [router]);

    const fetchAnalytics = async (token: string) => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            
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
                setGlobalStats(statsData);
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const exportReport = async (quizId: string) => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            const response = await fetch(`${apiUrl}/admin/export/${quizId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `quiz-report-${quizId}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('Failed to export report:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Quiz Analytics</h1>
                            <p className="text-slate-600 dark:text-slate-400">Performance insights and statistics</p>
                        </div>
                        <Link 
                            href="/admin/dashboard"
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                        >
                            Back to Dashboard
                        </Link>
                    </div>
                </header>

                {/* Global Statistics */}
                {globalStats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Quizzes</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{globalStats.totalQuizzes}</p>
                                </div>
                                <FileText className="w-8 h-8 text-primary" />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Candidates</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{globalStats.totalCandidates}</p>
                                </div>
                                <Users className="w-8 h-8 text-green-600" />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Attempts</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{globalStats.totalAttempts}</p>
                                </div>
                                <BarChart3 className="w-8 h-8 text-blue-600" />
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Average Score</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{globalStats.averageScore.toFixed(1)}%</p>
                                </div>
                                <TrendingUp className="w-8 h-8 text-purple-600" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Quiz Performance Table */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Quiz Performance</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">Quiz Title</th>
                                    <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">Total Attempts</th>
                                    <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">Average Score</th>
                                    <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">Completion Rate</th>
                                    <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">Avg. Time</th>
                                    <th className="text-left p-4 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.map((quiz) => (
                                    <tr key={quiz.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <td className="p-4">
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-slate-50">{quiz.title}</p>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">Quiz ID: {quiz.id}</p>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-900 dark:text-slate-50">{quiz.totalAttempts}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-medium ${
                                                    quiz.averageScore >= 70 ? 'text-green-600' : 
                                                    quiz.averageScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                    {quiz.averageScore.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-medium ${
                                                    quiz.completionRate >= 80 ? 'text-green-600' : 
                                                    quiz.completionRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                                                }`}>
                                                    {quiz.completionRate.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                                <span className="font-medium text-slate-900 dark:text-slate-50">{quiz.averageTime}m</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setSelectedQuiz(quiz.id)}
                                                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    View Details
                                                </button>
                                                <button
                                                    onClick={() => exportReport(quiz.id)}
                                                    className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                                                >
                                                    <Download className="w-3 h-3" />
                                                    Export
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
}
