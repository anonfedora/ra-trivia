"use client";

import { useEffect, useState, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Home, Award, BookOpen, TrendingUp } from 'lucide-react';

interface QuestionBreakdown {
    questionId: string;
    text: string;
    options: string[];
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

    const fetchSession = useCallback(async () => {
        if (!sessionId) { setIsLoading(false); return; }
        const token = localStorage.getItem('token');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        try {
            const res = await fetch(`${apiUrl}/quiz/session/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setResult(await res.json());
        } catch (err) {
            console.error('Failed to fetch result:', err);
        } finally {
            setIsLoading(false);
        }
    }, [sessionId]);

    useEffect(() => { fetchSession(); }, [fetchSession]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        );
    }

    if (!result) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <p className="text-slate-500 text-lg font-medium">Could not load results.</p>
                <Link href="/dashboard" className="text-primary font-bold hover:underline">Back to Dashboard</Link>
            </div>
        );
    }

    const score = result.score !== null ? Math.round(result.score) : 0;
    const passed = score >= 50;
    const scoreColor = score >= 70 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-rose-500';
    const scoreBg = score >= 70 ? 'bg-emerald-50 border-emerald-100' : score >= 50 ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100';

    return (
        <main className="min-h-screen bg-slate-50 p-6 md:p-12">
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Header Card */}
                <div className={`bg-white rounded-[2.5rem] shadow-xl border p-10 text-center animate-scale-in ${scoreBg}`}>
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                        {passed ? <Award size={40} /> : <BookOpen size={40} />}
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900 mb-1">{result.quiz.title}</h1>
                    <p className={`text-lg font-bold mb-6 ${passed ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {passed ? '🎉 Passed!' : 'Not Passed'}
                    </p>

                    {/* Score */}
                    <div className={`text-8xl font-black mb-2 ${scoreColor}`}>{score}%</div>
                    <p className="text-slate-400 font-medium text-sm uppercase tracking-widest">Final Score</p>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-4 mt-8">
                        <div className="bg-white/70 rounded-2xl p-4 border border-slate-100">
                            <div className="text-2xl font-black text-slate-800">{result.totalQuestions}</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Total</div>
                        </div>
                        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                            <div className="text-2xl font-black text-emerald-600">{result.correctCount}</div>
                            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mt-1">Correct</div>
                        </div>
                        <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100">
                            <div className="text-2xl font-black text-rose-500">{result.incorrectCount}</div>
                            <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mt-1">Incorrect</div>
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 p-6 animate-fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp size={18} className="text-primary" />
                        <span className="font-bold text-slate-700">Performance Breakdown</span>
                        <span className="ml-auto text-sm font-bold text-slate-400">{result.correctCount}/{result.totalQuestions} correct</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-1000 ${score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${score}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-400 mt-2">
                        <span>0%</span>
                        <span className="text-amber-500">50% (Pass)</span>
                        <span>100%</span>
                    </div>
                </div>

                {/* Per-Question Breakdown */}
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-slide-up">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/50">
                        <h2 className="text-xl font-bold text-slate-800">Question Review</h2>
                        <p className="text-slate-400 text-sm mt-1">See how you answered each question</p>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {result.breakdown.map((q, index) => (
                            <div key={q.questionId} className={`p-6 md:p-8 ${q.isCorrect ? 'bg-white' : 'bg-rose-50/30'}`}>
                                <div className="flex items-start gap-4">
                                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${q.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                                        {q.isCorrect
                                            ? <CheckCircle2 size={18} />
                                            : <XCircle size={18} />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Q{index + 1}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${q.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                                                {q.isCorrect ? 'Correct' : 'Incorrect'}
                                            </span>
                                        </div>
                                        <p className="font-semibold text-slate-800 mb-4 leading-relaxed">{q.text}</p>

                                        <div className="space-y-2">
                                            {q.options.map((opt) => {
                                                const isSelected = opt === q.selectedOption;
                                                const isCorrect = opt === q.correctOption;
                                                let style = 'bg-slate-50 border-slate-100 text-slate-600';
                                                if (isCorrect) style = 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold';
                                                if (isSelected && !isCorrect) style = 'bg-rose-50 border-rose-200 text-rose-600 font-bold line-through';
                                                return (
                                                    <div key={opt} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${style}`}>
                                                        {isCorrect && <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />}
                                                        {isSelected && !isCorrect && <XCircle size={14} className="text-rose-400 flex-shrink-0" />}
                                                        {!isCorrect && !isSelected && <div className="w-3.5 h-3.5 flex-shrink-0" />}
                                                        <span>{opt}</span>
                                                    </div>
                                                );
                                            })}
                                            {!q.selectedOption && (
                                                <p className="text-xs text-slate-400 italic mt-1 pl-1">No answer selected</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Back to Dashboard — no retake button */}
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
