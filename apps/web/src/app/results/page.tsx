"use client";

import { useEffect, useState, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Home, Award, BookOpen, TrendingUp } from 'lucide-react';

interface QuestionBreakdown {
    questionId: string;
    text: string;
    options: { key: string; text: string }[];
    selectedOption: string | null;
    correctOption: string;
    isCorrect: boolean;
}

interface SessionResult {
    id: string;
    score: number | null;
    totalQuestions: number;
    correctCount: number;
    incorrectCount: number;
    quiz: { title: string };
    breakdown: QuestionBreakdown[];
}

function ResultsContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('sessionId');
    const [result, setResult] = useState<SessionResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lockedAt, setLockedAt] = useState<string | null>(null);

    const fetchSession = useCallback(async () => {
        if (!sessionId) { setIsLoading(false); return; }
        const token = localStorage.getItem('token');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        try {
            const res = await fetch(`${apiUrl}/quiz/session/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 423) {
                const data = await res.json();
                setLockedAt(data.releaseAt);
            } else if (res.ok) {
                setResult(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch result:', err);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    useEffect(() => { fetchSession(); }, [fetchSession]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        );
    }

    if (lockedAt) {
        const releaseDate = new Date(lockedAt);
        return (
            <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-200">
                <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl p-10 text-center space-y-6 border border-slate-100 dark:border-slate-700 animate-scale-in">
                    <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2">
                        <BookOpen size={40} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Results Locked</h1>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Your exam has been submitted successfully! However, results are only released daily at <span className="text-slate-900 dark:text-slate-50 font-bold">10:00 PM</span>.
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Available on</p>
                        <p className="text-xl font-black text-primary">
                            {releaseDate.toLocaleDateString(undefined, {
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    </div>

                    <Link
                        href="/dashboard"
                        className="flex items-center justify-center gap-2 w-full bg-slate-900 dark:bg-primary text-white py-4 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-primary/90 transition-all shadow-lg active:scale-95"
                    >
                        <Home size={18} />
                        Back to Dashboard
                    </Link>
                    <p className="text-[10px] text-slate-300 dark:text-slate-600 font-bold uppercase tracking-widest">You will receive an email once results are released</p>
                </div>
            </main>
        );
    }

    if (!sessionId || !result) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-200">
                <div className="text-center">
                    <XCircle size={64} className="text-rose-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Session Not Found</h1>
                    <Link href="/dashboard" className="text-primary hover:underline mt-4 block font-bold">Return to Dashboard</Link>
                </div>
            </main>
        );
    }

    const percentage = result.score ?? 0;
    const isPassed = percentage >= 50;

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 transition-colors duration-200">
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 p-8 md:p-12 text-center relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-full h-2 ${isPassed ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                    <div className="flex justify-between items-start mb-8">
                        <Link href="/dashboard" className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-slate-400 hover:text-primary transition-all">
                            <Home size={20} />
                        </Link>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${isPassed ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'
                            }`}>
                            {isPassed ? 'Passed' : 'Not Passed'}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className={`w-24 h-24 ${isPassed ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                            {isPassed ? <Award size={48} /> : <XCircle size={48} />}
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 dark:text-slate-50">{result.quiz.title}</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Detailed results and performance review</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                        {[
                            { label: 'Total Score', value: `${percentage.toFixed(1)}%`, icon: TrendingUp, color: 'text-primary' },
                            { label: 'Correct Answers', value: result.correctCount, icon: CheckCircle2, color: 'text-emerald-500' },
                            { label: 'Incorrect', value: result.incorrectCount, icon: XCircle, color: 'text-rose-500' }
                        ].map((stat, i) => (
                            <div key={i} className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                                <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-3`} />
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-slate-50">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 px-2 flex items-center gap-2">
                        <BookOpen className="text-primary" size={24} />
                        Question Breakdown
                    </h2>

                    {result.breakdown.map((item, idx) => (
                        <div key={item.questionId} className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-lg border border-slate-100 dark:border-slate-700 animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                            <div className="flex justify-between items-start gap-4 mb-6">
                                <div className="flex items-start gap-4">
                                    <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-xs font-black text-slate-400 shrink-0">
                                        {idx + 1}
                                    </span>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">{item.text}</h3>
                                </div>
                                <div className={item.isCorrect ? 'text-emerald-500' : 'text-rose-500'}>
                                    {item.isCorrect ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {item.options.map(opt => {
                                    const isSelected = item.selectedOption === opt.key;
                                    const isCorrect = item.correctOption === opt.key;

                                    let borderColor = 'border-slate-100 dark:border-slate-700';
                                    let bgColor = 'bg-white dark:bg-slate-800';
                                    let textColor = 'text-slate-600 dark:text-slate-400';

                                    if (isCorrect) {
                                        borderColor = 'border-emerald-200 dark:border-emerald-900/50';
                                        bgColor = 'bg-emerald-50 dark:bg-emerald-900/20';
                                        textColor = 'text-emerald-700 dark:text-emerald-400 font-bold';
                                    } else if (isSelected && !isCorrect) {
                                        borderColor = 'border-rose-200 dark:border-rose-900/50';
                                        bgColor = 'bg-rose-50 dark:bg-rose-900/20';
                                        textColor = 'text-rose-700 dark:text-rose-400 font-bold';
                                    }

                                    return (
                                        <div key={opt.key} className={`p-4 rounded-2xl border transition-all ${borderColor} ${bgColor} ${textColor} text-sm flex items-center gap-3`}>
                                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${isCorrect ? 'bg-emerald-500 text-white' : isSelected ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                                                }`}>
                                                {opt.key}
                                            </span>
                                            {opt.text}
                                        </div>
                                    );
                                })}
                            </div>

                            {!item.isCorrect && (
                                <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-700 flex items-center gap-2 text-xs font-bold text-slate-400">
                                    <TrendingUp size={14} className="text-primary" />
                                    Correct Answer: <span className="text-emerald-500 uppercase">{item.correctOption}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="pb-8">
                    <Link
                        href="/dashboard"
                        className="flex items-center justify-center gap-2 w-full bg-primary text-white py-5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:-translate-y-1 transition-all active:scale-95"
                    >
                        <Home size={20} />
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </main>
    );
}

export default function ResultsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading results...</div>}>
            <ResultsContent />
        </Suspense>
    );
}
