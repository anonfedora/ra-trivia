"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Clock, AlertCircle, CheckCircle, Info, ArrowLeft, Play, Calendar, Repeat } from 'lucide-react';

interface Quiz {
    id: string;
    title: string;
    duration: number;
    startDate?: string | null;
    endDate?: string | null;
    retakeLimit?: number | null;
    completedAttempts?: number;
    _count: {
        questions: number;
    };
}

export default function InstructionsPage() {
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const params = useParams();
    const quizId = params.id as string;

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

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }

        const fetchQuizDetails = async () => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            try {
                // Fetch quiz details and user sessions
                const [quizRes, sessionRes] = await Promise.all([
                    fetch(`${apiUrl}/quizzes/${quizId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${apiUrl}/quiz/my-sessions`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                if (quizRes.ok && sessionRes.ok) {
                    const quizData = await quizRes.json();
                    const sessionsData = await sessionRes.json();

                    // Check scheduling
                    const now = new Date();
                    if (quizData.startDate && now < new Date(quizData.startDate)) {
                        alert('This quiz has not started yet. Please check back later.');
                        router.push('/dashboard');
                        return;
                    }

                    if (quizData.endDate && now > new Date(quizData.endDate)) {
                        alert('This quiz has ended. You can no longer take this exam.');
                        router.push('/dashboard');
                        return;
                    }

                    // Check retake limit
                    const completedAttempts = sessionsData.filter((session: any) => 
                        session.quizId === quizId && session.endTime !== null
                    ).length;

                    const retakeLimit = quizData.retakeLimit || 2;
                    if (completedAttempts >= retakeLimit) {
                        alert(`You have reached the maximum number of attempts (${retakeLimit}) for this quiz.`);
                        router.push('/dashboard');
                        return;
                    }

                    setQuiz({ ...quizData, completedAttempts });
                } else {
                    const errorData = await quizRes.json();
                    alert(errorData.message || 'Failed to load quiz details');
                    router.push('/dashboard');
                }
            } catch (err) {
                console.error('Failed to fetch quiz details', err);
                alert('An error occurred while loading the quiz');
                router.push('/dashboard');
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuizDetails();
    }, [quizId, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!quiz) return null;

    return (
        <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-slide-up">
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
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 items-center flex gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                                <Clock size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Duration</p>
                                <p className="text-xl font-bold text-slate-900">{quiz.duration} Minutes</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 items-center flex gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Questions</p>
                                <p className="text-xl font-bold text-slate-900">{quiz._count.questions} Total</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 items-center flex gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                                <Calendar size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Schedule</p>
                                <p className="text-sm font-bold text-slate-900">{getScheduleLabel()}</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 items-center flex gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                                <Repeat size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Attempts</p>
                                <p className="text-sm font-bold text-slate-900">{getTriesLabel()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            System Rules & Guidelines
                        </h3>
                        <ul className="space-y-3">
                            {[
                                "The timer starts immediately after you click 'Start Exam'.",
                                "Answers are automatically saved as you navigate between questions.",
                                "You can move back and forth to review your answers.",
                                "Ensure you have a stable internet connection throughout the session.",
                                "Do not refresh the page or close the tab as the timer continues running.",
                                "The exam will auto-submit when the timer expires."
                            ].map((rule, i) => (
                                <li key={i} className="flex gap-3 text-slate-600">
                                    <CheckCircle size={18} className="text-emerald-500 mt-1 flex-shrink-0" />
                                    <span className="font-medium text-sm leading-relaxed">{rule}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <button
                        onClick={() => router.push(`/quiz/${quiz.id}`)}
                        className="w-full bg-primary hover:bg-primary/90 text-white py-5 rounded-2xl font-bold shadow-lg shadow-primary/20 transform transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 mt-4"
                    >
                        <Play size={20} fill="currentColor" />
                        Start My Exam
                    </button>

                    <p className="text-center text-xs text-slate-400 font-medium pb-2">
                        By starting the exam, you agree to follow all the rules mentioned above.
                    </p>
                </div>
            </div>
        </main>
    );
}
