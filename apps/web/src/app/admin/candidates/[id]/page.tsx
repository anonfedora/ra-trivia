"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Building2, Award, Clock, CheckCircle2, XCircle, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ThemeToggle } from '../../../../components/ThemeToggle';
import NotificationBell from '../../../../components/NotificationBell';
import { useToast } from '../../../../contexts/ToastContext';

interface Session {
    id: string;
    startTime: string;
    endTime: string | null;
    score: number | null;
    manualStatus: string | null;
    resultReleasesAt: string | null;
    quiz: { id: string; title: string; duration: number };
}

interface Candidate {
    id: string;
    name: string;
    email: string;
    church: string | null;
    association: string | null;
    userType: string;
    emailVerified: boolean;
    createdAt: string;
    sessions: Session[];
}

const USER_TYPE_LABELS: Record<string, string> = {
    AMBASSADOR_RANK_EXAMS: 'Ambassador Rank',
    EXTRAORDINARY_RANK_EXAMS: 'Extraordinary Rank',
    PRE_PLENIPOTENTIARY_EXAMS: 'Pre-Plenipotentiary',
    PLENIPOTENTIARY_RANK_EXAMS: 'Plenipotentiary Rank',
};

function formatDuration(startTime: string, endTime: string | null): string {
    if (!endTime) return '—';
    const ms = new Date(endTime).getTime() - new Date(startTime).getTime();
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
}

export default function CandidateDetailPage() {
    const params = useParams();
    const candidateId = params?.id as string;
    const [candidate, setCandidate] = useState<Candidate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const { toast } = useToast();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    useEffect(() => {
        const fetchCandidate = async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`${apiUrl}/admin/candidates/${candidateId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    setCandidate(await res.json());
                } else {
                    toast('Failed to load candidate', 'error');
                }
            } catch {
                toast('Failed to load candidate', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        if (candidateId) fetchCandidate();
    }, [apiUrl, candidateId, toast]);

    if (isLoading) {
        return (
            <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="h-10 w-40 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                    <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-[2.5rem] animate-pulse" />
                    <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-[2.5rem] animate-pulse" />
                </div>
            </main>
        );
    }

    if (!candidate) {
        return (
            <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-slate-400 font-bold text-xl mb-4">Candidate not found</p>
                    <Link href="/admin/candidates" className="text-primary font-bold hover:underline">Back to Candidates</Link>
                </div>
            </main>
        );
    }

    const completedSessions = candidate.sessions.filter(s => s.endTime);
    const scores = completedSessions.map(s => s.score ?? 0);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const bestScore = scores.length > 0 ? Math.max(...scores) : null;

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 transition-colors duration-200">
            <div className="max-w-4xl mx-auto">
                <header className="flex justify-between items-start mb-10">
                    <Link href="/admin/candidates" className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all">
                        <ArrowLeft size={18} /> Back to Candidates
                    </Link>
                    <div className="flex gap-3 items-center">
                        <NotificationBell />
                        <ThemeToggle />
                    </div>
                </header>

                {/* Profile Card */}
                <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 p-8 mb-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary font-black text-3xl flex-shrink-0">
                            {candidate.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-3 mb-1">
                                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{candidate.name}</h1>
                                {candidate.emailVerified && (
                                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                        <CheckCircle2 size={12} /> Verified
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400 font-medium">
                                <span className="flex items-center gap-1.5"><Mail size={14} />{candidate.email}</span>
                                {candidate.church && <span className="flex items-center gap-1.5"><Building2 size={14} />{candidate.church}</span>}
                                {candidate.association && <span className="flex items-center gap-1.5"><Award size={14} />{candidate.association}</span>}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-3">
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                                    {USER_TYPE_LABELS[candidate.userType] ?? candidate.userType}
                                </span>
                                <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                    <Calendar size={12} /> Joined {new Date(candidate.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{candidate.sessions.length}</div>
                            <div className="text-xs font-bold text-slate-400 mt-1">Total Attempts</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{completedSessions.length}</div>
                            <div className="text-xs font-bold text-slate-400 mt-1">Completed</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 text-center">
                            <div className={`text-2xl font-black ${avgScore !== null ? (avgScore >= 50 ? 'text-emerald-500' : 'text-rose-500') : 'text-slate-300'}`}>
                                {avgScore !== null ? `${avgScore.toFixed(1)}%` : '—'}
                            </div>
                            <div className="text-xs font-bold text-slate-400 mt-1">Avg Score</div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 text-center">
                            <div className={`text-2xl font-black ${bestScore !== null ? 'text-primary' : 'text-slate-300'}`}>
                                {bestScore !== null ? `${bestScore.toFixed(1)}%` : '—'}
                            </div>
                            <div className="text-xs font-bold text-slate-400 mt-1">Best Score</div>
                        </div>
                    </div>
                </section>

                {/* Exam History */}
                <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Exam History</h2>
                    </div>

                    {candidate.sessions.length === 0 ? (
                        <div className="p-16 text-center">
                            <p className="text-slate-400 font-bold">No exam attempts yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50 dark:divide-slate-700">
                            {candidate.sessions.map((session) => {
                                const isExpanded = expandedSession === session.id;
                                const isCompleted = !!session.endTime;
                                const passed = session.score !== null && session.score >= 50;
                                const duration = formatDuration(session.startTime, session.endTime);

                                return (
                                    <div key={session.id}>
                                        <button
                                            onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                                            className="w-full text-left p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-4"
                                        >
                                            {/* Score badge */}
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-sm ${
                                                !isCompleted
                                                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                                    : passed
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-rose-100 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400'
                                            }`}>
                                                {!isCompleted ? '…' : session.score !== null ? `${session.score.toFixed(0)}%` : 'N/A'}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{session.quiz.title}</p>
                                                <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400 font-medium">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={11} />
                                                        {new Date(session.startTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={11} />
                                                        {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {isCompleted && (
                                                        <span className="flex items-center gap-1">
                                                            Duration: {duration}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                {isCompleted ? (
                                                    passed
                                                        ? <CheckCircle2 size={18} className="text-emerald-500" />
                                                        : <XCircle size={18} className="text-rose-400" />
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">In Progress</span>
                                                )}
                                                {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                            </div>
                                        </button>

                                        {/* Expanded detail */}
                                        {isExpanded && (
                                            <div className="px-6 pb-6 bg-slate-50/50 dark:bg-slate-900/20">
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
                                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Score</div>
                                                        <div className={`text-xl font-black ${session.score !== null ? (session.score >= 50 ? 'text-emerald-500' : 'text-rose-500') : 'text-slate-300'}`}>
                                                            {session.score !== null ? `${session.score.toFixed(2)}%` : 'N/A'}
                                                        </div>
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
                                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Duration</div>
                                                        <div className="text-xl font-black text-slate-700 dark:text-slate-200">{duration}</div>
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
                                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Exam Length</div>
                                                        <div className="text-xl font-black text-slate-700 dark:text-slate-200">{session.quiz.duration} min</div>
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4">
                                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</div>
                                                        <div className={`text-sm font-black ${
                                                            !isCompleted ? 'text-blue-500'
                                                            : session.manualStatus === 'Cleared' ? 'text-emerald-500'
                                                            : 'text-rose-500'
                                                        }`}>
                                                            {!isCompleted ? 'In Progress' : session.manualStatus ?? (passed ? 'Cleared' : 'Not Cleared')}
                                                        </div>
                                                    </div>
                                                    {session.endTime && (
                                                        <div className="col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-4">
                                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Completed At</div>
                                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                                {new Date(session.endTime).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {session.resultReleasesAt && (
                                                        <div className="col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-4">
                                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Result Released</div>
                                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                                {new Date(session.resultReleasesAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
