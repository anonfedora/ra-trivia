"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PlayCircle, Clock } from 'lucide-react';

interface Question {
    id: string;
    text: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
}

interface Quiz {
    id: string;
    title: string;
    duration: number;
    questions: Question[];
}

export default function AdminTestQuizPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = params.id as string;
    
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [session, setSession] = useState<any>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [answers, setAnswers] = useState<any>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userRaw = localStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;

        if (!token || !user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
            router.push('/login');
            return;
        }

        const fetchQuiz = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
                const res = await fetch(`${apiUrl}/quiz/start`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ quizId })
                });

                if (res.ok) {
                    const data = await res.json();
                    setQuiz(data.quiz);
                    setSession(data.session);
                    setCurrentIndex(0);
                    setAnswers(data.session.answers || {});

                    // Initialize timer
                    const durationSeconds = data.quiz.duration * 60;
                    const elapsedSeconds = Math.floor((new Date().getTime() - new Date(data.session.startTime).getTime()) / 1000);
                    setTimeLeft(Math.max(0, durationSeconds - elapsedSeconds));
                } else {
                    console.error('Failed to start quiz');
                }
            } catch (err) {
                console.error('Failed to load quiz:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuiz();
    }, [quizId, router]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAnswerSelect = (questionId: string, option: string) => {
        const newAnswers = { ...answers, [questionId]: option };
        setAnswers(newAnswers);

        // Sync with server
        const token = localStorage.getItem('token');
        if (token && session) {
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/quiz/update-answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: session.id,
                    questionId,
                    selectedOption: option
                }),
            }).catch(err => console.error('Failed to sync answer:', err));
        }
    };

    const handleSubmit = useCallback(async () => {
        if (!session) return;

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/quiz/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: session.id,
                    answers
                })
            });

            if (res.ok) {
                router.push('/admin/dashboard');
            }
        } catch (err) {
            console.error('Failed to submit quiz:', err);
        }
    }, [session, answers, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!quiz || !session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">Quiz not found</h2>
                    <Link href="/admin/dashboard" className="text-primary hover:underline">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const currentQuestion = quiz.questions[currentIndex];
    const progress = ((currentIndex + 1) / quiz.questions.length) * 100;

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <Link href="/admin/dashboard" className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">
                            <ArrowLeft size={20} />
                            Back to Admin
                        </Link>
                        <div className="bg-yellow-100 dark:bg-yellow-900 px-4 py-2 rounded-lg">
                            <span className="text-yellow-800 dark:text-yellow-200 font-semibold text-sm">🧪 ADMIN TEST MODE</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">{quiz.title}</h1>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <Clock size={20} />
                                <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                                Question {currentIndex + 1} of {quiz.questions.length}
                            </div>
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div 
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </header>

                {/* Question */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 mb-6">
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-6">
                        {currentQuestion.text}
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {['optionA', 'optionB', 'optionC', 'optionD'].map((option, index) => (
                            <button
                                key={option}
                                onClick={() => handleAnswerSelect(currentQuestion.id, currentQuestion[option as keyof Question] || '')}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${
                                    answers[currentQuestion.id] === currentQuestion[option as keyof Question]
                                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                                        : 'border-slate-300 dark:border-slate-600 hover:border-primary hover:bg-primary/5 text-slate-700 dark:text-slate-300'
                                }`}
                            >
                                <span className="font-medium">
                                    {String.fromCharCode(65 + index)}. {currentQuestion[option as keyof Question]}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        Progress: {currentIndex + 1} / {quiz.questions.length}
                    </div>
                    
                    {currentIndex === quiz.questions.length - 1 && (
                        <button
                            onClick={handleSubmit}
                            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors"
                        >
                            Submit Quiz
                        </button>
                    )}
                </div>
            </div>
        </main>
    );
}
