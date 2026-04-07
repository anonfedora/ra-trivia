"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, AlertCircle, CheckCircle, Info, ArrowLeft, Play, Calendar, Repeat, Lock } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Quiz {
    id: string;
    title: string;
    duration: number;
    examCode?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    retakeLimit?: number | null;
    completedAttempts?: number;
    _count: {
        questions: number;
    };
}

import { ThemeToggle } from '../../../../components/ThemeToggle';
import { useToast } from '../../../../contexts/ToastContext';

export default function InstructionsPage() {
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userExamCode, setUserExamCode] = useState('');
    const router = useRouter();
    const params = useParams();
    const quizId = params?.id as string;
    const { toast } = useToast();

    useEffect(() => {
        const fetchQuizDetails = async () => {
            try {
                // Fetch quiz details and user sessions
                const [quizRes, sessionRes] = await Promise.all([
                    apiFetch(`quizzes/${quizId}`),
                    apiFetch('quiz/my-sessions')
                ]);

                if (quizRes.ok && sessionRes.ok) {
                    const quizData = await quizRes.json();
                    const sessionsData = await sessionRes.json();

                    // Check scheduling
                    const now = new Date();
                    if (quizData.startDate && now < new Date(quizData.startDate)) {
                        toast('This quiz has not started yet. Please check back later.', 'warning');
                        router.push('/dashboard');
                        return;
                    }

                    if (quizData.endDate && now > new Date(quizData.endDate)) {
                        toast('This quiz has ended. You can no longer take this exam.', 'warning');
                        router.push('/dashboard');
                        return;
                    }

                    // Check retake limit
                    const completedAttempts = sessionsData.filter((s: any) => s.status === 'COMPLETED' && s.quizId === quizId).length;
                    if (quizData.retakeLimit !== null && completedAttempts >= quizData.retakeLimit) {
                        toast('You have reached the maximum number of attempts for this quiz.', 'warning');
                        router.push('/dashboard');
                        return;
                    }

                    setQuiz({ ...quizData, completedAttempts });
                } else {
                    router.push('/dashboard');
                }
            } catch (err) {
                console.error('Failed to fetch quiz details:', err);
                router.push('/dashboard');
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuizDetails();
    }, [quizId, router, toast]);

    if (!quizId) {
        return <div>Loading...</div>;
    }

    const formatDateTime = (value: string) => {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleString();
    };

    const getScheduleLabel = () => {
        if (!quiz) return '';
        const start = quiz.startDate ? formatDateTime(quiz.startDate) : null;
        const end = quiz.endDate ? formatDateTime(quiz.endDate) : null;

        if (start && end) return `${start} - ${end}`;
        if (start) return `From ${start}`;
        if (end) return `Until ${end}`;
        return 'Anytime';
    };

    const getTriesLabel = () => {
        if (!quiz) return '';
        if (quiz.retakeLimit === null || quiz.retakeLimit === undefined) return 'Unlimited';
        const completed = quiz.completedAttempts || 0;
        const remaining = Math.max(0, quiz.retakeLimit - completed);
        if (remaining === 0) return 'No tries left';
        if (remaining === 1) return '1 try left';
        return `${remaining} tries left`;
    };

    const handleStartExam = () => {
        if (!quiz) return;
        
        if (quiz.examCode && !userExamCode) {
            toast('Please enter the exam code to start.', 'warning');
            return;
        }

        const url = quiz.examCode 
            ? `/quiz/${quiz.id}?code=${encodeURIComponent(userExamCode)}`
            : `/quiz/${quiz.id}`;
            
        router.push(url);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!quiz) return null;

    return (
        <main className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-6 transition-colors duration-200">
            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>
            <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-slide-up">
                <div className="bg-primary p-8 text-white relative">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="absolute top-8 left-8 p-2 hover:bg-white/10 rounded-xl transition-all"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="text-center mt-4">
                        <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Info size={32} />
                        </div>
                        <h1 className="text-3xl font-bold">{quiz.title}</h1>
                        <p className="text-white/80 mt-2">Please read the instructions carefully before starting.</p>
                    </div>
                </div>

                <div className="p-10 space-y-8">
                    {/* Exam Code Section */}
                    {quiz.examCode && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-3xl p-6 animate-pulse-slow">
                            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <AlertCircle size={16} />
                                Access Code Required
                            </h3>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={userExamCode}
                                    onChange={(e) => setUserExamCode(e.target.value)}
                                    placeholder="Enter exam code provided by admin"
                                    autoComplete="off"
                                    data-lpignore="true"
                                    spellCheck="false"
                                    className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 dark:text-slate-100 font-bold tracking-widest uppercase placeholder:normal-case placeholder:font-medium placeholder:tracking-normal"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400">
                                    <Lock size={18} />
                                </div>
                            </div>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 font-medium">
                                You cannot start the exam without the correct access code.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 items-center flex gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                                <Clock size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Duration</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-slate-50">{quiz.duration} Minutes</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 items-center flex gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Questions</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-slate-50">{quiz._count.questions} Total</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 items-center flex gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                                <Calendar size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Schedule</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{getScheduleLabel()}</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 items-center flex gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                                <Repeat size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Attempts</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-50">{getTriesLabel()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <CheckCircle size={18} className="text-emerald-500" /> Exam Guidelines
                        </h3>
                        <ul className="space-y-3">
                            {[
                                "The timer starts immediately after you click 'Start Exam'.",
                                "Answers are automatically saved as you navigate between questions.",
                                "You can move back and forth to review your answers before submitting.",
                                "Ensure you have a stable internet connection throughout the session.",
                                "The exam will auto-submit when the timer expires."
                            ].map((rule, i) => (
                                <li key={i} className="flex gap-3 text-slate-600 dark:text-slate-400">
                                    <CheckCircle size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <span className="font-medium text-sm leading-relaxed">{rule}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <AlertCircle size={18} className="text-red-500" /> Anti-Cheat & Violations
                        </h3>
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-2xl p-5">
                            <ul className="space-y-3">
                                {[
                                    "Switching tabs or minimizing the browser window is detected and logged.",
                                    "Copying, pasting, or right-clicking is disabled during the exam.",
                                    "Do not refresh the page or close the tab — the timer keeps running.",
                                    "Each violation is recorded and may be reviewed by the examiner.",
                                    "Excessive violations may result in automatic exam termination.",
                                    "Using external tools, AI assistants, or other aids is strictly prohibited."
                                ].map((rule, i) => (
                                    <li key={i} className="flex gap-3 text-red-700 dark:text-red-300">
                                        <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                                        <span className="font-medium text-sm leading-relaxed">{rule}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <button
                        onClick={handleStartExam}
                        className="w-full bg-primary hover:bg-primary/90 text-white py-5 rounded-2xl font-bold shadow-lg shadow-primary/20 transform transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 mt-4"
                    >
                        <Play size={20} fill="currentColor" />
                        Start My Exam
                    </button>

                    <p className="text-center text-xs text-slate-400 dark:text-slate-500 font-medium pb-2">
                        By starting the exam, you agree to follow all the rules mentioned above.
                    </p>
                </div>
            </div>
        </main>
    );
}
