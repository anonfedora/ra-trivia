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
    const [showWarning, setShowWarning] = useState<string | null>(null);
    const [showReview, setShowReview] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const fetchQuiz = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
                return;
            }

            try {
                // Clear any existing backup to force fresh randomization
                const quizId = params.id as string;
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
        };

        fetchQuiz();
    }, [router, quizId]);

    useEffect(() => {
        if (timeLeft <= 0) return;
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
    }, [timeLeft]);

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
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!quiz) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400">Loading quiz...</div>;

    const currentQuestion = quiz.questions[currentIndex];
    const answeredCount = Object.keys(answers).length;
    const unansweredCount = quiz.questions.length - answeredCount;

    // Review Screen
    if (showReview) {
        return (
            <main className="min-h-screen bg-slate-50 p-6 md:p-12 flex flex-col items-center">
                <div className="max-w-4xl w-full">
                    <div className="bg-white rounded-[2.5rem] shadow-xl p-10 border border-slate-100 mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 mb-6">Review Your Answers</h1>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            <div className="bg-blue-50 p-4 rounded-2xl text-center">
                                <div className="text-2xl font-bold text-blue-600">{answeredCount}</div>
                                <div className="text-sm text-blue-500">Answered</div>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-2xl text-center">
                                <div className="text-2xl font-bold text-orange-600">{unansweredCount}</div>
                                <div className="text-sm text-orange-500">Unanswered</div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl text-center">
                                <div className="text-2xl font-bold text-slate-600">{quiz.questions.length}</div>
                                <div className="text-sm text-slate-500">Total Questions</div>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {quiz.questions.map((question: any, index: number) => {
                                const hasAnswer = answers[question.id];
                                return (
                                    <div
                                        key={question.id}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${hasAnswer
                                            ? 'bg-green-50 border-green-200 hover:bg-green-100'
                                            : 'bg-red-50 border-red-200 hover:bg-red-100'
                                            }`}
                                        onClick={() => {
                                            setShowReview(false);
                                            setCurrentIndex(index);
                                        }}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex-1">
                                                <span className="font-bold text-slate-700">Q{index + 1}:</span>
                                                <span className="ml-2 text-slate-600">{question.text.substring(0, 80)}...</span>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-sm font-bold ${hasAnswer
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
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
                            className="flex-1 px-8 py-4 rounded-2xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
                        >
                            Continue Editing
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || unansweredCount > 0}
                            className="flex-1 px-8 py-4 rounded-2xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-xl shadow-green-100 transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Submitting...' : unansweredCount > 0 ? `Submit (${unansweredCount} unanswered)` : 'Submit Quiz'}
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 p-6 md:p-12 flex flex-col items-center">
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
                    {currentQuestion.randomizedOptions?.map((opt: any, index: number) => (
                        <button
                            key={opt.key}
                            onClick={() => saveAnswer(currentQuestion.id, opt.key)}
                            className={`p-6 rounded-2xl text-left font-semibold transition-all border-2 ${answers[currentQuestion.id] === opt.key
                                ? 'bg-primary/5 border-primary text-primary shadow-md'
                                : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mr-3 shadow-sm ${answers[currentQuestion.id] === opt.key ? 'bg-primary text-white' : 'bg-white text-slate-400'}`}>
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
                    className="px-8 py-4 rounded-2xl font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    Previous
                </button>

                <button
                    onClick={() => {
                        saveAnswer(currentQuestion.id, answers[currentQuestion.id]);
                        setShowReview(true);
                    }}
                    disabled={isSubmitting || !answers[currentQuestion.id]}
                    className="flex-1 px-8 py-4 rounded-2xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-xl shadow-red-100 transition-all transform hover:-translate-y-1 disabled:opacity-50"
                >
                    {isSubmitting ? 'Submitting...' : 'Review and Submit'}
                </button>

                {currentIndex < quiz.questions.length - 1 ? (
                    <button
                        onClick={() => setCurrentIndex(prev => Math.min(quiz.questions.length - 1, prev + 1))}
                        className="px-8 py-4 rounded-2xl font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-lg transition-all"
                    >
                        Next
                    </button>
                ) : (
                    <>
                        <button
                            onClick={() => setShowReview(true)}
                            className="flex-1 px-8 py-4 rounded-2xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all transform hover:-translate-y-1"
                        >
                            Review & Submit
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex-1 px-8 py-4 rounded-2xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-xl shadow-green-100 transition-all transform hover:-translate-y-1 disabled:opacity-50"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Now'}
                        </button>
                    </>
                )}
            </div>
        </main>
    );
}
