"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Clock, PlayCircle, LogOut, Calendar, Repeat } from 'lucide-react';
import { ThemeToggle } from '../../components/ThemeToggle';

interface Quiz {
    id: string;
    title: string;
    duration: number;
    retakeLimit?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    isActive: boolean;
    _count: {
        questions: number;
    };
    completedAttempts?: number; // Number of completed sessions
}

interface Session {
    id: string;
    startTime: string;
    endTime: string | null;
    score: number | null;
    resultReleasesAt?: string | null;
    quiz: {
        id: string;
        title: string;
    };
}

export default function DashboardPage() {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [pastSessions, setPastSessions] = useState<Session[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    const formatDateTime = (value: string) => {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleString();
    };

    const getScheduleLabel = (quiz: Quiz) => {
        const start = quiz.startDate ? formatDateTime(quiz.startDate) : null;
        const end = quiz.endDate ? formatDateTime(quiz.endDate) : null;

        if (start && end) return `${start} - ${end}`;
        if (start) return `From ${start}`;
        if (end) return `Until ${end}`;
        return 'Anytime';
    };

    const getTriesLabel = (quiz: Quiz) => {
        if (quiz.retakeLimit === null || quiz.retakeLimit === undefined) return 'Unlimited';
        const completed = quiz.completedAttempts || 0;
        const remaining = Math.max(0, quiz.retakeLimit - completed);
        if (remaining === 0) return 'No tries left';
        if (remaining === 1) return '1 try left';
        return `${remaining} tries left`;
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');

        if (!storedUser || !token) {
            router.push('/login');
            return;
        }

        const userData = JSON.parse(storedUser);

        // Redirect admins and super admins to admin dashboard
        if (userData.role === 'ADMIN' || userData.role === 'SUPER_ADMIN') {
            router.push('/admin/dashboard');
            return;
        }

        setUser(userData);

        const fetchData = async () => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            try {
                // Fetch Quizzes and Past Sessions in parallel
                const [quizRes, sessionRes] = await Promise.all([
                    fetch(`${apiUrl}/quizzes?activeOnly=true`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${apiUrl}/quiz/my-sessions`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                if (quizRes.ok && sessionRes.ok) {
                    const quizzesData = await quizRes.json();
                    const sessionsData = await sessionRes.json();

                    // Count completed attempts for each quiz
                    const quizzesWithAttempts = quizzesData.map((quiz: Quiz) => {
                        const completedAttempts = sessionsData.filter((session: Session) =>
                            session.quiz.id === quiz.id && session.endTime !== null
                        ).length;
                        return { ...quiz, completedAttempts };
                    });

                    setQuizzes(quizzesWithAttempts);
                    setPastSessions(sessionsData);
                }
            } catch (err) {
                console.error('Failed to fetch data', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
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
            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-12 animate-fade-in text-center md:text-left">
                    <div className="flex items-center gap-4 text-left">
                        <img
                            src="/favicon.png"
                            alt="RA Logo"
                            className="w-12 h-12 rounded-lg"
                        />
                        <div>
                            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50">Candidate Dashboard</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-2">Welcome back, <span className="font-bold text-primary">{user?.name}</span>. Ready for your next challenge?</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <button
                            onClick={handleLogout}
                            className="hidden md:flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"
                        >
                            <LogOut size={18} />
                            Logout
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-2 space-y-12">
                        <section>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <PlayCircle className="text-primary" size={24} />
                                Available Exams
                            </h2>
                            {quizzes.length === 0 ? (
                                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-12 text-center shadow-xl border border-slate-100 dark:border-slate-700 animate-slide-up">
                                    <div className="bg-slate-50 dark:bg-slate-900 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-400">
                                        <BookOpen size={40} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">No active exams</h3>
                                    <p className="text-slate-500 dark:text-slate-400">There are currently no exams available for you to take.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {quizzes.map((quiz, index) => (
                                        <div
                                            key={quiz.id}
                                            className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-xl border border-slate-100 dark:border-slate-700 hover:shadow-2xl hover:-translate-y-2 transition-all group animate-scale-in"
                                            style={{ animationDelay: `${index * 100}ms` }}
                                        >
                                            <div className="bg-primary/10 w-14 h-14 rounded-2xl flex items-center justify-center text-primary mb-6 transition-transform group-hover:scale-110">
                                                <BookOpen size={28} />
                                            </div>
                                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">{quiz.title}</h3>

                                            <div className="space-y-3 mb-8">
                                                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                                    <Clock size={18} />
                                                    <span className="font-medium">{quiz.duration} Minutes</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                                    <Calendar size={18} />
                                                    <span className="font-medium">{getScheduleLabel(quiz)}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                                    <Repeat size={18} />
                                                    <span className="font-medium">{getTriesLabel(quiz)}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                                    <PlayCircle size={18} />
                                                    <span className="font-medium">{quiz._count.questions} Questions</span>
                                                </div>
                                            </div>

                                            {(() => {
                                                const remainingTries = quiz.retakeLimit && quiz.retakeLimit > 0
                                                    ? Math.max(0, quiz.retakeLimit - (quiz.completedAttempts || 0))
                                                    : Infinity;

                                                return (
                                                    <Link
                                                        href={remainingTries > 0 ? `/quiz/${quiz.id}/instructions` : '#'}
                                                        className={`block w-full text-center py-4 rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${remainingTries > 0
                                                            ? 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
                                                            : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                                            }`}
                                                        onClick={(e) => {
                                                            if (remainingTries === 0) {
                                                                e.preventDefault();
                                                                alert('You have no attempts left for this exam.');
                                                            }
                                                        }}
                                                    >
                                                        {remainingTries > 0 ? 'Take Exam' : 'No Attempts Left'}
                                                    </Link>
                                                );
                                            })()}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    <div className="space-y-8">
                        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-xl animate-fade-in" style={{ animationDelay: '200ms' }}>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <Clock className="text-primary" size={24} />
                                My Results
                            </h2>
                            <div className="space-y-4">
                                {pastSessions.length === 0 ? (
                                    <p className="text-slate-400 dark:text-slate-500 text-center py-8 italic font-medium">No previous attempts recorded.</p>
                                ) : (
                                    pastSessions.map((session) => {
                                        const now = new Date();
                                        const isReleased = !session.resultReleasesAt || now >= new Date(session.resultReleasesAt);
                                        const isRunning = !session.endTime;

                                        return (
                                            <div
                                                key={session.id}
                                                className={`p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 transition-all ${!isRunning ? 'cursor-pointer hover:border-primary/20 hover:bg-white dark:hover:bg-slate-800 active:scale-95' : ''}`}
                                                onClick={() => {
                                                    if (!isRunning) {
                                                        router.push(`/results?quizId=${session.quiz.id}&sessionId=${session.id}`);
                                                    }
                                                }}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="font-bold text-slate-900 dark:text-slate-50">{session.quiz.title}</div>
                                                    {!isRunning && (
                                                        <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg">View Details</span>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                                        {new Date(session.startTime).toLocaleDateString()}
                                                    </span>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-black ${isRunning
                                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                        : isReleased
                                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                                        }`}>
                                                        {isRunning
                                                            ? 'Running'
                                                            : isReleased
                                                                ? `${session.score?.toFixed(1)}%`
                                                                : 'Locked until 8 PM'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </section>

                        <button
                            onClick={handleLogout}
                            className="md:hidden w-full flex items-center justify-center gap-2 px-6 py-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"
                        >
                            <LogOut size={18} />
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
