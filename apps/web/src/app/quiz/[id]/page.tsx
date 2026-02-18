"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function QuizPage() {
    const params = useParams();
    const quizId = params.id as string;
    const [quiz, setQuiz] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [answers, setAnswers] = useState<any>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchQuiz = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
                return;
            }

            try {
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
                    setAnswers(data.session.answers || {});

                    // Initialize timer
                    const durationSeconds = data.quiz.duration * 60;
                    const elapsedSeconds = Math.floor((new Date().getTime() - new Date(data.session.startTime).getTime()) / 1000);
                    setTimeLeft(Math.max(0, durationSeconds - elapsedSeconds));
                }
            } catch (err) {
                console.error('Failed to load quiz');
            }
        };

        fetchQuiz();
    }, [router]);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const saveAnswer = async (questionId: string, option: string) => {
        setAnswers((prev: any) => ({ ...prev, [questionId]: option }));

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

    const handleSubmit = async () => {
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
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!quiz) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Loading quiz...</div>;

    const currentQuestion = quiz.questions[currentIndex];

    return (
        <main className="min-h-screen bg-slate-50 p-6 md:p-12 flex flex-col items-center">
            <div className="max-w-4xl w-full flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{quiz.title}</h1>
                    <p className="text-slate-500 font-medium">Question {currentIndex + 1} of {quiz.questions.length}</p>
                </div>
                <div className={`px-6 py-3 rounded-2xl font-mono text-xl font-bold shadow-sm ${timeLeft < 60 ? 'bg-red-50 text-red-600 border border-red-100 animate-pulse' : 'bg-white text-primary border border-slate-100'}`}>
                    {formatTime(timeLeft)}
                </div>
            </div>

            <div className="max-w-4xl w-full bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 p-10 border border-slate-100 mb-10 min-h-[400px] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-800 mb-10 leading-snug">
                    {currentQuestion.text}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
                    {['A', 'B', 'C', 'D'].map((opt) => (
                        <button
                            key={opt}
                            onClick={() => saveAnswer(currentQuestion.id, opt)}
                            className={`p-6 rounded-2xl text-left font-semibold transition-all border-2 ${answers[currentQuestion.id] === opt
                                ? 'bg-primary/5 border-primary text-primary shadow-md'
                                : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mr-3 shadow-sm ${answers[currentQuestion.id] === opt ? 'bg-primary text-white' : 'bg-white text-slate-400'}`}>
                                {opt}
                            </span>
                            {currentQuestion[`option${opt}`]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-4xl w-full flex justify-between gap-4">
                <button
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="px-8 py-4 rounded-2xl font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    Previous
                </button>

                {currentIndex < quiz.questions.length - 1 ? (
                    <button
                        onClick={() => setCurrentIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
                        className="px-8 py-4 rounded-2xl font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-lg transition-all"
                    >
                        Next
                    </button>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-10 py-4 rounded-2xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-xl shadow-green-100 transition-all transform hover:-translate-y-1"
                    >
                        {isSubmitting ? 'Submitting...' : 'Finish Quiz'}
                    </button>
                )}
            </div>
        </main>
    );
}
