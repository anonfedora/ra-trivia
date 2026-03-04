"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ThemeToggle } from '../../../components/ThemeToggle';

export default function QuizPage() {
    const params = useParams();
    const quizId = params.id as string;
    const [quiz, setQuiz] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [answers, setAnswers] = useState<any>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showWarning, setShowWarning] = useState<string | null>(null);
    const [showReview, setShowReview] = useState(false);
    const router = useRouter();

    const fetchQuiz = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }

        try {
            // Clear any existing backup to force fresh randomization
            const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('quiz_backup_'));
            backupKeys.forEach(key => localStorage.removeItem(key));

            // For development, we assume there's a quiz with ID 'default'
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            const res = await fetch(`${apiUrl}/quiz/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ quizId }),
            });

            const data = await res.json();
            if (res.ok) {
                setQuiz(data.quiz);
                setSession(data.session);

                // Start fresh - don't recover old answers to ensure new randomization
                setAnswers(data.session.answers || {});

                // Initialize timer
                const durationSeconds = data.quiz.duration * 60;
                const elapsedSeconds = Math.floor((new Date().getTime() - new Date(data.session.startTime).getTime()) / 1000);
                setTimeLeft(Math.max(0, durationSeconds - elapsedSeconds));
            }
        } catch (err) {
            console.error('Failed to load quiz');
        }
    }, [quizId, router]);

    const handleSubmit = useCallback(async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const token = localStorage.getItem('token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            const res = await fetch(`${apiUrl}/quiz/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ sessionId: session.id }),
            });

            if (res.ok) {
                // Clean up localStorage backup
                if (session?.id) {
                    localStorage.removeItem(`quiz_backup_${session.id}`);
                }
                router.push(`/results?quizId=${quizId}&sessionId=${session.id}`);
            } else {
                const data = await res.json();
                alert(data.message || 'Submission failed');
                setIsSubmitting(false);
            }
        } catch (err) {
            console.error('Submission error:', err);
            alert('An error occurred during submission');
            setIsSubmitting(false);
        }
    }, [isSubmitting, session?.id, router, quizId]);

    useEffect(() => {
        fetchQuiz();
    }, [fetchQuiz]);

    useEffect(() => {
        if (timeLeft <= 0) {
            if (quiz && session) {
                handleSubmit();
            }
            return;
        }
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }

                // Show warnings
                if (prev === 300) { // 5 minutes
                    setShowWarning('5 minutes remaining!');
                    setTimeout(() => setShowWarning(null), 3000);
                } else if (prev === 60) { // 1 minute
                    setShowWarning('1 minute remaining!');
                    setTimeout(() => setShowWarning(null), 3000);
                } else if (prev === 30) { // 30 seconds
                    setShowWarning('30 seconds remaining!');
                    setTimeout(() => setShowWarning(null), 3000);
                }

                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft, handleSubmit, quiz, session]);

    const saveAnswer = async (questionId: string, option: string) => {
        const newAnswers = { ...answers, [questionId]: option };
        setAnswers(newAnswers);

        // Backup to localStorage for recovery
        if (session?.id) {
            localStorage.setItem(`quiz_backup_${session.id}`, JSON.stringify(newAnswers));
        }

        // Auto-save to server
        try {
            const token = localStorage.getItem('token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            await fetch(`${apiUrl}/quiz/update-answer`, {
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
            });
        } catch (err) {
            console.error('Auto-save failed');
        }
    };


    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!quiz) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400 dark:bg-slate-900 transition-colors duration-200">Loading quiz...</div>;

    const currentQuestion = quiz.questions[currentIndex];
    const answeredCount = Object.keys(answers).length;
    const unansweredCount = quiz.questions.length - answeredCount;

    // Review Screen
    if (showReview) {
        return (
            <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 flex flex-col items-center transition-colors duration-200">
                <div className="max-w-4xl w-full">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl p-10 border border-slate-100 dark:border-slate-700 mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-6">Review Your Answers</h1>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl text-center border border-blue-100 dark:border-blue-900/50">
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{answeredCount}</div>
                                <div className="text-sm text-blue-500 dark:text-blue-400/80">Answered</div>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-2xl text-center border border-orange-100 dark:border-orange-900/50">
                                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{unansweredCount}</div>
                                <div className="text-sm text-orange-500 dark:text-orange-400/80">Unanswered</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-2xl text-center border border-slate-100 dark:border-slate-600">
                                <div className="text-2xl font-bold text-slate-600 dark:text-slate-300">{quiz.questions.length}</div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">Total Questions</div>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                            {quiz.questions.map((question: any, index: number) => {
                                const hasAnswer = answers[question.id];
                                return (
                                    <div
                                        key={question.id}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${hasAnswer
                                            ? 'bg-green-50 dark:bg-emerald-900/10 border-green-200 dark:border-emerald-900/30 hover:bg-green-100 dark:hover:bg-emerald-900/20'
                                            : 'bg-red-50 dark:bg-rose-900/10 border-red-200 dark:border-rose-900/30 hover:bg-red-100 dark:hover:bg-rose-900/20'
                                            }`}
                                        onClick={() => {
                                            setShowReview(false);
                                            setCurrentIndex(index);
                                        }}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex-1">
                                                <span className="font-bold text-slate-700 dark:text-slate-200">Q{index + 1}:</span>
                                                <span className="ml-2 text-slate-600 dark:text-slate-400">{question.text.substring(0, 80)}...</span>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-sm font-bold ${hasAnswer
                                                ? 'bg-green-100 dark:bg-emerald-900/30 text-green-700 dark:text-emerald-400'
                                                : 'bg-red-100 dark:bg-rose-900/30 text-red-700 dark:text-rose-400'
                                                }`}>
                                                {hasAnswer ? 'Answered' : 'Not Answered'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowReview(false)}
                            className="flex-1 px-8 py-4 rounded-2xl font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                        >
                            Continue Editing
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || unansweredCount > 0}
                            className="flex-1 px-8 py-4 rounded-2xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-xl shadow-green-100 dark:shadow-none transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Submitting...' : unansweredCount > 0 ? `Submit (${unansweredCount} unanswered)` : 'Submit Quiz'}
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 flex flex-col items-center transition-colors duration-200">
            {/* Timer Warning */}
            {showWarning && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
                    <div className="bg-red-500 text-white px-6 py-3 rounded-2xl font-bold text-lg shadow-xl border-2 border-red-600">
                        ⚠️ {showWarning}
                    </div>
                </div>
            )}

            <div className="max-w-4xl w-full flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{quiz.title}</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Question {currentIndex + 1} of {quiz.questions.length}</p>
                </div>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <button
                        onClick={() => setShowReview(true)}
                        className="px-4 py-2 rounded-xl font-semibold text-sm text-red-600 dark:text-rose-400 bg-red-50 dark:bg-rose-900/20 border border-red-200 dark:border-rose-900/50 hover:bg-red-100 dark:hover:bg-rose-900/30 transition-all"
                    >
                        Review &amp; Submit
                    </button>
                    <div className={`px-6 py-3 rounded-2xl font-mono text-xl font-bold shadow-sm transition-all ${timeLeft < 60 ? 'bg-red-50 dark:bg-rose-900/20 text-red-600 dark:text-rose-400 border border-red-100 dark:border-rose-900/50 animate-pulse' : 'bg-white dark:bg-slate-800 text-primary dark:text-primary border border-slate-100 dark:border-slate-700'}`}>
                        {formatTime(timeLeft)}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl w-full bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none p-10 border border-slate-100 dark:border-slate-700 mb-10 min-h-[400px] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-10 leading-snug">
                    {currentQuestion.text}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
                    {currentQuestion.randomizedOptions?.map((opt: any, index: number) => (
                        <button
                            key={opt.key}
                            onClick={() => saveAnswer(currentQuestion.id, opt.key)}
                            className={`p-6 rounded-2xl text-left font-semibold transition-all border-2 ${answers[currentQuestion.id] === opt.key
                                ? 'bg-primary/5 dark:bg-primary/10 border-primary text-primary shadow-md'
                                : 'bg-slate-50 dark:bg-slate-900/50 border-transparent dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mr-3 shadow-sm transition-all ${answers[currentQuestion.id] === opt.key ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 text-slate-400'}`}>
                                {String.fromCharCode(65 + index)}
                            </span>
                            {opt.text}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-4xl w-full flex justify-between gap-4">
                <button
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="px-8 py-4 rounded-2xl font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    Previous
                </button>

                {currentIndex < quiz.questions.length - 1 ? (
                    <button
                        onClick={() => setCurrentIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
                        className="flex-1 px-8 py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-primary hover:bg-slate-800 dark:hover:bg-primary/90 shadow-lg transition-all"
                    >
                        Next
                    </button>
                ) : (
                    <button
                        onClick={() => setShowReview(true)}
                        className="flex-1 px-8 py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 shadow-lg transition-all"
                    >
                        Review Answers
                    </button>
                )}
            </div>
        </main>
    );
}
