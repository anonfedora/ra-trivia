"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock, ListChecks } from 'lucide-react';

interface PreviewQuestion {
    id: string;
    text: string;
    optionA: string | null;
    optionB: string | null;
    optionC: string | null;
    optionD: string | null;
}

interface PreviewQuiz {
    id: string;
    title: string;
    duration: number;
    isActive: boolean;
    retakeLimit: number | null;
    startDate: string | null;
    endDate: string | null;
    questions: PreviewQuestion[];
    _count: { questions: number };
}

export default function AdminQuizPreviewPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = params.id as string;

    const [quiz, setQuiz] = useState<PreviewQuiz | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userRaw = localStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;

        if (!token || !user || user.role !== 'ADMIN') {
            router.push('/login');
            return;
        }

        const fetchPreview = async () => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            try {
                const res = await fetch(`${apiUrl}/quizzes/${quizId}/preview`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    router.push('/admin/dashboard');
                    return;
                }

                const data = await res.json();
                setQuiz(data);
            } catch (err) {
                console.error('Failed to fetch preview', err);
                router.push('/admin/dashboard');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPreview();
    }, [quizId, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        );
    }

    if (!quiz) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <p className="text-slate-500 text-lg font-medium">Could not load preview.</p>
                <Link href="/admin/dashboard" className="text-primary font-bold hover:underline">Back to Dashboard</Link>
            </div>
        );
    }

    const formatDate = (iso: string | null) => {
        if (!iso) return 'Not set';
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleString();
    };

    return (
        <main className="min-h-screen bg-slate-50 p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <Link href="/admin/dashboard" className="flex items-center gap-2 text-primary font-bold mb-4 hover:gap-3 transition-all">
                            <ArrowLeft size={18} />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Preview Exam</h1>
                        <p className="text-slate-500 mt-2 font-medium">Read-only preview of what candidates will see.</p>
                    </div>
                </header>

                <section className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <BookOpen size={24} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-slate-900">{quiz.title}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                                        <Clock size={16} /> Duration
                                    </div>
                                    <div className="text-xl font-black text-slate-800 mt-2">{quiz.duration} min</div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
                                        <ListChecks size={16} /> Questions
                                    </div>
                                    <div className="text-xl font-black text-slate-800 mt-2">{quiz._count?.questions ?? quiz.questions.length}</div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="text-slate-500 text-sm font-bold">Retake Limit</div>
                                    <div className="text-xl font-black text-slate-800 mt-2">{quiz.retakeLimit ?? 2}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="text-slate-500 text-sm font-bold">Start Date</div>
                                    <div className="text-sm font-semibold text-slate-700 mt-2">{formatDate(quiz.startDate)}</div>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="text-slate-500 text-sm font-bold">End Date</div>
                                    <div className="text-sm font-semibold text-slate-700 mt-2">{formatDate(quiz.endDate)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/50">
                        <h3 className="text-xl font-bold text-slate-800">Questions</h3>
                        <p className="text-slate-400 text-sm mt-1">Options are shown as candidates would see them.</p>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {quiz.questions.map((q, idx) => (
                            <div key={q.id} className="p-6 md:p-8">
                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Q{idx + 1}</div>
                                <div className="font-semibold text-slate-800 mb-4 leading-relaxed">{q.text}</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {([
                                        { key: 'A', text: q.optionA },
                                        { key: 'B', text: q.optionB },
                                        { key: 'C', text: q.optionC },
                                        { key: 'D', text: q.optionD }
                                    ].filter(o => o.text) as { key: string; text: string }[]).map(opt => (
                                        <div key={opt.key} className="px-4 py-3 rounded-xl border bg-slate-50 border-slate-100 text-sm text-slate-700">
                                            <span className="font-black mr-2">{opt.key}.</span>
                                            {opt.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
