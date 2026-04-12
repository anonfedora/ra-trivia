"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import { ThemeToggle } from '../../../components';
import { useToast } from '../../../contexts/ToastContext';
import ConfirmModal from '../../../components/ConfirmModal';
import { apiFetch } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default function QuizPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const quizId = params?.id as string;
    const examCode = searchParams?.get('code');
    
    const [quiz, setQuiz] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [answers, setAnswers] = useState<any>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showWarning, setShowWarning] = useState<string | null>(null);
    const [showReview, setShowReview] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [leaveCount, setLeaveCount] = useState(0);
    const [savedFlash, setSavedFlash] = useState<string | null>(null); // questionId that just saved
    const [fitgPool, setFitgPool] = useState<string[]>([]);
    const [draggedAnswer, setDraggedAnswer] = useState<{answer: string, index: number} | null>(null);
    const [selectedFromPool, setSelectedFromPool] = useState<{answer: string, index: number} | null>(null);
    const [screenshotWarning, setScreenshotWarning] = useState(false);
    const leaveCountRef = useRef(0);
    const { toast } = useToast();
    const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
    const pendingSavesRef = useRef<Set<string>>(new Set());

    const handleSubmit = useCallback(async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            if (!session?.id) {
                toast('Session not found. Please restart the quiz.', 'error');
                router.push('/dashboard');
                return;
            }
            
            const res = await apiFetch('quiz/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId: session.id }),
            });

            if (res.ok) {
                // Clean up localStorage backup
                if (session?.id) {
                    localStorage.removeItem(`quiz_backup_${session.id}`);
                }
                
                router.push(`/results?sessionId=${session.id}`);
            } else {
                const data = await res.json();
                toast(data.message || 'Submission failed', 'error');
                setIsSubmitting(false);
            }
        } catch (err) {
            console.error('Submission error:', err);
            toast('An error occurred during submission', 'error');
            setIsSubmitting(false);
        }
    }, [isSubmitting, session?.id, router, toast]);

    const fetchQuiz = useCallback(async () => {
        try {
            // Clear any existing backup to force fresh randomization
            const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('quiz_backup_'));
            backupKeys.forEach(key => localStorage.removeItem(key));

            const res = await apiFetch('quiz/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ quizId, examCode }),
            });

            const data = await res.json();
            
            if (res.ok) {
                if (data.quiz.questions && data.quiz.questions.length > 0) {
                    const pool = data.quiz.questions
                        .filter((q: any) => q.format === 'FILL_IN_THE_GAP')
                        .map((q: any) => q.correctOption);
                    
                    // Shuffle pool
                    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
                    setFitgPool(shuffledPool);
                }
                setQuiz(data.quiz);
                setSession(data.session);

                // Start fresh - don't recover old answers to ensure new randomization
                // Convert old answer format to new format if needed
                const sessionAnswers = data.session.answers || {};
                const convertedAnswers: any = {};
                Object.entries(sessionAnswers).forEach(([questionId, answer]) => {
                    if (typeof answer === 'string') {
                        // Old format - convert to new format
                        convertedAnswers[questionId] = { value: answer, poolIndex: undefined };
                    } else {
                        // New format
                        convertedAnswers[questionId] = answer;
                    }
                });
                setAnswers(convertedAnswers);

                // Initialize timer
                const durationSeconds = data.quiz.duration * 60;
                const elapsedSeconds = Math.floor((new Date().getTime() - new Date(data.session.startTime).getTime()) / 1000);
                const calculatedTimeLeft = durationSeconds - elapsedSeconds;
                
                if (calculatedTimeLeft > 5) {
                    setTimeLeft(calculatedTimeLeft);
                } else {
                    setTimeLeft(durationSeconds);
                }
            } else {
                toast(`Failed to start quiz: ${data.message || 'Unknown error'}`, 'error');
                router.push('/dashboard');
            }
        } catch (err) {
            console.error('Quiz fetch error:', err);
            toast('An error occurred while starting the quiz', 'error');
            router.push('/dashboard');
        }
    }, [quizId, examCode, router, toast]);

    // Check for tab reload and show warning
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (session && timeLeft > 0) {
                e.preventDefault();
                e.returnValue = 'If you reload, your quiz progress will be lost. Are you sure?';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [session, timeLeft]);

    // Handle window visibility change (tab switching) and blur events
    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;
        
        let violationTimeout: NodeJS.Timeout | null = null;
        
        const handleViolation = () => {
            // Prevent double-counting if both events fire simultaneously
            if (violationTimeout) return;
            
            console.log('Violation detected:', {
                session: !!session,
                timeLeft,
                isSubmitting,
                currentLeaveCount: leaveCountRef.current
            });
            
            if (session && timeLeft > 0 && !isSubmitting) {
                // Set a small timeout to prevent duplicate violations
                violationTimeout = setTimeout(() => {
                    violationTimeout = null;
                }, 500);
                
                // Increment using ref for immediate access
                leaveCountRef.current += 1;
                const newLeaveCount = leaveCountRef.current;
                setLeaveCount(newLeaveCount);

                console.log('New leave count:', newLeaveCount);

                if (newLeaveCount === 1) {
                    setShowWarning('⚠️ Warning 1/2: Do not leave the quiz window! This is your first warning.');
                    setTimeout(() => setShowWarning(null), 5000);
                } else if (newLeaveCount === 2) {
                    setShowWarning('⚠️ Warning 2/2: Final warning! Next violation will auto-submit your exam.');
                    setTimeout(() => setShowWarning(null), 5000);
                } else if (newLeaveCount >= 3) {
                    setShowWarning('🚨 Auto-submitting exam due to multiple violations!');
                    setTimeout(() => {
                        handleSubmit();
                    }, 2000);
                }
            }
        };
        
        const handleVisibilityChange = () => {
            if (document.hidden) {
                handleViolation();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleViolation);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleViolation);
            if (violationTimeout) clearTimeout(violationTimeout);
        };
    }, [session, timeLeft, isSubmitting, handleSubmit]);

    useEffect(() => {
        fetchQuiz();
    }, [fetchQuiz]);

    // Disable copy, paste, cut, and right-click during the exam
    useEffect(() => {
        if (!session) return;
        const prevent = (e: Event) => e.preventDefault();
        document.addEventListener('copy', prevent);
        document.addEventListener('paste', prevent);
        document.addEventListener('cut', prevent);
        document.addEventListener('contextmenu', prevent);
        return () => {
            document.removeEventListener('copy', prevent);
            document.removeEventListener('paste', prevent);
            document.removeEventListener('cut', prevent);
            document.removeEventListener('contextmenu', prevent);
        };
    }, [session]);

    // Block screenshot attempts (PrintScreen, macOS Cmd+Shift+3/4/5)
    useEffect(() => {
        if (!session) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            const isPrintScreen = e.key === 'PrintScreen';
            const isMacScreenshot = e.metaKey && e.shiftKey && ['3', '4', '5', 's'].includes(e.key);
            if (isPrintScreen || isMacScreenshot) {
                e.preventDefault();
                setScreenshotWarning(true);
                setTimeout(() => setScreenshotWarning(false), 2500);
                // Count as a violation
                leaveCountRef.current += 1;
                const newCount = leaveCountRef.current;
                setLeaveCount(newCount);
                if (newCount === 1) {
                    setShowWarning('⚠️ Warning 1/2: Screenshots are not allowed during the exam!');
                    setTimeout(() => setShowWarning(null), 5000);
                } else if (newCount === 2) {
                    setShowWarning('⚠️ Warning 2/2: Final warning! Screenshots are not allowed.');
                    setTimeout(() => setShowWarning(null), 5000);
                } else if (newCount >= 3) {
                    setShowWarning('🚨 Auto-submitting due to repeated violations!');
                    setTimeout(() => handleSubmit(), 2000);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [session, handleSubmit]);

    useEffect(() => {
        if (!quiz || !session) return;

        console.log('Timer useEffect triggered:', {
            timeLeft,
            quizLoaded: !!quiz,
            sessionLoaded: !!session,
            isSubmitting
        });
        
        if (timeLeft <= 0) {
            console.log('Auto-submitting due to timeLeft <= 0');
            handleSubmit();
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
    }, [timeLeft, handleSubmit, quiz, session, isSubmitting]);

    const flushPendingSaves = useCallback(async () => {
        const promises = Object.entries(saveTimeoutRef.current).map(async ([qId, timeout]) => {
            clearTimeout(timeout);
            const answer = answers[qId]?.value;
            if (answer && session?.id) {
                try {
                    await apiFetch('quiz/update-answer', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: session.id,
                            questionId: qId,
                            selectedOption: answer
                        }),
                    });
                } catch (e) { console.error('Flush failed', qId); }
            }
        });
        saveTimeoutRef.current = {};
        pendingSavesRef.current.clear();
        await Promise.all(promises);
    }, [answers, session?.id]);

    if (!quizId) {
        return <div>Loading...</div>;
    }

    const saveAnswer = async (questionId: string, option: string, poolIndex?: number) => {
        // Immediate local update for responsive UI
        const newAnswers = { ...answers, [questionId]: { value: option, poolIndex } };
        setAnswers(newAnswers);

        // Flash feedback
        setSavedFlash(questionId);
        setTimeout(() => setSavedFlash(null), 600);

        // Backup to localStorage for recovery
        if (session?.id) {
            localStorage.setItem(`quiz_backup_${session.id}`, JSON.stringify(newAnswers));
        }

        // Debounced Save to Server
        if (saveTimeoutRef.current[questionId]) {
            clearTimeout(saveTimeoutRef.current[questionId]);
        }

        pendingSavesRef.current.add(questionId);

        saveTimeoutRef.current[questionId] = setTimeout(async () => {
            try {
                await apiFetch('quiz/update-answer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sessionId: session.id,
                        questionId,
                        selectedOption: option
                    }),
                });
                pendingSavesRef.current.delete(questionId);
                delete saveTimeoutRef.current[questionId];
            } catch (err) {
                console.error('Auto-save failed for', questionId);
            }
        }, 800); // 800ms debounce
    };

    const jumpToQuestion = (index: number) => {
        flushPendingSaves();
        setCurrentIndex(index);
        setShowReview(false);
    };

    const isQuestionAnswered = (questionId: string) => {
        return answers[questionId] !== undefined && answers[questionId].value !== undefined;
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!quiz) return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400 dark:bg-slate-900 transition-colors duration-200">Loading quiz...</div>;

    const currentQuestion = quiz.questions[currentIndex];
    const answeredCount = Object.values(answers).filter((answer: any) => answer && answer.value !== undefined).length;
    const unansweredCount = quiz.questions.length - answeredCount;
    const progressPct = Math.round((answeredCount / quiz.questions.length) * 100);

    // Timer color thresholds
    const timerCls = timeLeft <= 60
        ? 'bg-red-50 dark:bg-rose-900/20 text-red-600 dark:text-rose-400 border-red-200 dark:border-rose-900/50 animate-pulse'
        : timeLeft <= 300
        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
        : 'bg-white dark:bg-slate-800 text-primary dark:text-primary border-slate-100 dark:border-slate-700';

    // Review Screen
    if (showReview) {
        return (
            <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 flex flex-col items-center transition-colors duration-200">
                <style>{`@media print { body { visibility: hidden !important; } }`}</style>
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
                                            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/20'
                                            : 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/20'
                                            }`}
                                        onClick={() => {
                                            setShowReview(false);
                                            setCurrentIndex(index);
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            {hasAnswer
                                                ? <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                                                : <XCircle size={18} className="text-rose-400 flex-shrink-0" />
                                            }
                                            <div className="flex-1 min-w-0">
                                                <span className="font-bold text-slate-700 dark:text-slate-200">Q{index + 1}:</span>
                                                <span className="ml-2 text-slate-600 dark:text-slate-400 text-sm">{question.text.substring(0, 80)}{question.text.length > 80 ? '…' : ''}</span>
                                            </div>
                                            <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${hasAnswer
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                                                }`}>
                                                {hasAnswer ? 'Answered' : 'Skipped'}
                                            </span>
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
                            onClick={() => setShowSubmitConfirm(true)}
                            disabled={isSubmitting}
                            className="flex-1 px-8 py-4 rounded-2xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-xl shadow-green-100 dark:shadow-none transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
                        </button>
                    </div>
                </div>

                <ConfirmModal
                    isOpen={showSubmitConfirm}
                    title="Submit Exam"
                    message={unansweredCount > 0
                        ? `You have ${unansweredCount} unanswered question${unansweredCount !== 1 ? 's' : ''}. Are you sure you want to submit?`
                        : 'Are you sure you want to submit your exam? This cannot be undone.'}
                    confirmLabel={isSubmitting ? 'Submitting...' : 'Submit'}
                    variant="warning"
                    onConfirm={handleSubmit}
                    onCancel={() => setShowSubmitConfirm(false)}
                />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 pb-24 md:pb-32 flex flex-col items-center transition-colors duration-200">
            {/* Print/screenshot blackout — hides content in print media */}
            <style>{`@media print { body { visibility: hidden !important; } }`}</style>

            {/* Screenshot attempt overlay */}
            {screenshotWarning && (
                <div className="fixed inset-0 z-[99999] bg-black flex items-center justify-center pointer-events-none">
                    <div className="text-white text-center px-8">
                        <div className="text-5xl mb-4">🚫</div>
                        <p className="text-2xl font-black">Screenshots are not allowed</p>
                        <p className="text-white/60 mt-2">This violation has been recorded.</p>
                    </div>
                </div>
            )}

            {/* Timer Warning */}
            {showWarning && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce pointer-events-none px-3 max-w-[92vw] sm:max-w-md">
                    <div className="inline-flex items-center justify-center bg-red-500 text-white px-4 py-3 sm:px-6 sm:py-3 rounded-2xl font-bold text-sm sm:text-lg shadow-xl border-2 border-red-600 text-center whitespace-normal break-words">
                        ⚠️ {showWarning}
                    </div>
                </div>
            )}

            <div className="max-w-4xl w-full flex flex-col md:flex-row md:justify-between md:items-center mb-10 text-center md:text-left">
                <div className="mb-4 md:mb-0">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{quiz.title}</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Question {currentIndex + 1} of {quiz.questions.length}</p>
                    {/* Progress bar */}
                    <div className="mt-2 w-48 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{answeredCount}/{quiz.questions.length} answered</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 justify-center md:justify-end">
                    {/* Violation Counter */}
                    {leaveCount > 0 && (
                        <div className={`px-3 py-2 rounded-lg text-sm font-bold ${
                            leaveCount === 1 
                                ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/30'
                                : leaveCount === 2
                                ? 'bg-red-100 dark:bg-rose-900/20 text-red-700 dark:text-rose-400 border border-red-200 dark:border-rose-900/30'
                                : 'bg-red-600 text-white border border-red-700'
                        }`}>
                            {leaveCount === 1 ? '⚠️ Warning 1/2' : leaveCount === 2 ? '⚠️ Warning 2/2' : '🚨 Auto-submitting...'}
                        </div>
                    )}
                    <ThemeToggle />
                    <button
                        onClick={() => setShowReview(true)}
                        className="px-4 py-2 rounded-xl font-semibold text-sm text-red-600 dark:text-rose-400 bg-red-50 dark:bg-rose-900/20 border border-red-200 dark:border-rose-900/50 hover:bg-red-100 dark:hover:bg-rose-900/30 transition-all"
                    >
                        Review &amp; Submit
                    </button>
                    <div className={`px-6 py-3 rounded-2xl font-mono text-xl font-bold shadow-sm border transition-all ${timerCls}`}>
                        {formatTime(timeLeft)}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl w-full bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none p-10 border border-slate-100 dark:border-slate-700 mb-10 min-h-[400px] flex flex-col">
                {currentQuestion.format === 'FILL_IN_THE_GAP' ? (
                    <div className="flex flex-col md:flex-row gap-8 flex-1 items-start">
                        {/* Question Side */}
                        <div className="flex-1 space-y-8 w-full">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-snug">
                                {currentQuestion.text.split('___').map((part: string, i: number, arr: any[]) => (
                                    <span key={i}>
                                        {part}
                                        {i < arr.length - 1 && (
                                            <div
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.currentTarget.classList.add('bg-primary/20', 'border-primary');
                                                }}
                                                onDragLeave={(e) => {
                                                    e.currentTarget.classList.remove('bg-primary/20', 'border-primary');
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.currentTarget.classList.remove('bg-primary/20', 'border-primary');
                                                    if (draggedAnswer) {
                                                        saveAnswer(currentQuestion.id, draggedAnswer.answer, draggedAnswer.index);
                                                    }
                                                }}
                                                onClick={() => {
                                                    if (selectedFromPool) {
                                                        saveAnswer(currentQuestion.id, selectedFromPool.answer, selectedFromPool.index);
                                                        setSelectedFromPool(null);
                                                    } else if (answers[currentQuestion.id]) {
                                                        // Optional: Clear on click if already filled
                                                        const newAnswers = { ...answers };
                                                        delete newAnswers[currentQuestion.id];
                                                        setAnswers(newAnswers);
                                                    }
                                                }}
                                                className={`inline-flex items-center justify-center min-w-[140px] h-11 mx-2 border-2 border-dashed rounded-xl transition-all cursor-pointer shadow-sm ${
                                                    answers[currentQuestion.id]?.value
                                                        ? 'bg-primary/10 border-primary text-primary font-bold'
                                                        : selectedFromPool
                                                        ? 'bg-primary/5 border-primary/40 text-slate-400 animate-pulse'
                                                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-300 dark:border-slate-700 text-slate-400'
                                                }`}
                                            >
                                                {answers[currentQuestion.id]?.value || (selectedFromPool ? 'Tap to Fill' : 'Drop Here')}
                                            </div>
                                        )}
                                    </span>
                                ))}
                            </h2>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                                    <HelpCircle size={16} className="text-primary" />
                                    <span>
                                        <span className="hidden md:inline">Drag answers to the gaps or </span>
                                        <span>Click an answer then tap the gap to fill it.</span>
                                    </span>
                                </p>
                            </div>
                        </div>

                        {/* Answer Pool Side - Sticky on Desktop */}
                        <div className="w-full md:w-72 md:sticky md:top-24 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 max-h-[70vh] flex flex-col">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                                <span>Answer Pool</span>
                                {selectedFromPool && (
                                    <button 
                                        onClick={() => setSelectedFromPool(null)}
                                        className="text-[10px] text-primary hover:underline"
                                    >
                                        Clear Selection
                                    </button>
                                )}
                            </h3>
                            <div className="flex flex-wrap md:flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
                                {fitgPool.map((answer, index) => {
                                    const isUsed = Object.values(answers).some((a: any) => a && a.poolIndex === index);
                                    const isSelected = selectedFromPool?.index === index;
                                    return (
                                        <div
                                            key={`${answer}-${index}`}
                                            draggable={!isUsed}
                                            onDragStart={() => !isUsed && setDraggedAnswer({answer, index})}
                                            onDragEnd={() => setDraggedAnswer(null)}
                                            onClick={() => {
                                                if (!isUsed) {
                                                    setSelectedFromPool(isSelected ? null : {answer, index});
                                                }
                                            }}
                                            className={`px-4 py-3 rounded-xl border font-bold text-sm transition-all active:scale-95 select-none cursor-pointer ${
                                                isUsed
                                                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 opacity-40 cursor-not-allowed'
                                                    : isSelected
                                                    ? 'bg-primary border-primary text-white shadow-lg scale-105 z-10'
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary hover:shadow-md'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span>{answer}</span>
                                                {isSelected && <CheckCircle2 size={14} color="white" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-10 leading-snug">
                            {currentQuestion.text}
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-auto">
                            {(() => {
                                const options = currentQuestion.randomizedOptions || [
                                    { key: 'A', text: currentQuestion.optionA },
                                    { key: 'B', text: currentQuestion.optionB },
                                    { key: 'C', text: currentQuestion.optionC },
                                    { key: 'D', text: currentQuestion.optionD }
                                ].filter(opt => opt && opt.text);
                                
                                console.log('Rendering options for question:', currentQuestion.id, options);
                                
                                return options.map((opt: any, index: number) => {
                                    const isSelected = answers[currentQuestion.id]?.value === opt.key;
                                    const isFlashing = savedFlash === currentQuestion.id && isSelected;
                                    return (
                                        <button
                                            key={opt.key}
                                            onClick={() => saveAnswer(currentQuestion.id, opt.key)}
                                            className={`p-6 rounded-2xl text-left font-semibold transition-all border-2 relative overflow-hidden ${
                                                isSelected
                                                    ? 'border-2 border-primary bg-primary text-white font-bold shadow-lg ring-2 ring-primary/20'
                                                    : 'border-2 border-slate-300 dark:border-slate-600 hover:border-primary hover:bg-primary/5 text-slate-700 dark:text-slate-300'
                                            }`}
                                        >
                                            {/* Save flash overlay */}
                                            {isFlashing && (
                                                <span className="absolute inset-0 bg-primary/10 animate-ping rounded-2xl pointer-events-none" />
                                            )}
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mr-3 shadow-sm transition-all ${isSelected ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 text-slate-400'}`}>
                                                {String.fromCharCode(65 + index)}
                                            </span>
                                            {opt.text}
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                    </>
                )}
            </div>

            <div className="max-w-4xl w-full flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
                <button
                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    Previous
                </button>

                {currentIndex < quiz.questions.length - 1 ? (
                    <button
                        onClick={async () => {
                            await flushPendingSaves();
                            setCurrentIndex(prev => Math.min(quiz.questions.length - 1, prev + 1));
                        }}
                        className="w-full sm:w-auto flex-1 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-primary hover:bg-slate-800 dark:hover:bg-primary/90 shadow-lg transition-all"
                    >
                        Next
                    </button>
                ) : (
                    <button
                        onClick={async () => {
                            await flushPendingSaves();
                            setShowReview(true);
                        }}
                        className="w-full sm:w-auto flex-1 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-bold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 shadow-lg transition-all"
                    >
                        Review Answers
                    </button>
                )}
            </div>

            {/* Question Navigation Boxes */}
            <div className="max-w-4xl w-full bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none p-5 sm:p-6 border border-slate-100 dark:border-slate-700 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest">Question Navigation</h3>
                    <span className="text-xs font-semibold text-slate-400">{answeredCount}/{quiz.questions.length} answered</span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 gap-2">
                    {quiz.questions.map((question: any, index: number) => {
                        const isAnswered = isQuestionAnswered(question.id);
                        const isCurrent = index === currentIndex;
                        return (
                            <button
                                key={question.id}
                                onClick={() => jumpToQuestion(index)}
                                title={isCurrent ? 'Current' : isAnswered ? 'Answered' : 'Unanswered'}
                                className={`min-h-[44px] w-full rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${
                                    isCurrent
                                        ? 'bg-primary text-white border-primary shadow-md'
                                        : isAnswered
                                        ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
                                        : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                {index + 1}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs font-semibold text-slate-400">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary inline-block" />Current</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400 inline-block" />Answered</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700 inline-block" />Unanswered</span>
                </div>
            </div>
        </main>
    );
}
