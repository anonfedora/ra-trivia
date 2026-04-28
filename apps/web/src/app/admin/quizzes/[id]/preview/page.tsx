"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock, ListChecks, Copy, Check, Download } from 'lucide-react';
import { ThemeToggle } from '../../../../../components/ThemeToggle';
import NotificationBell from '../../../../../components/NotificationBell';
import { QRCodeDisplay } from '../../../../../components/attendance/QRCodeDisplay';
import { apiFetch } from '../../../../../lib/api';
import { getAccessToken, getUser } from '../../../../../lib/auth';
import { useToast } from '../../../../../contexts/ToastContext';

interface PreviewQuestion {
    id: string;
    text: string;
    optionA: string | null;
    optionB: string | null;
    optionC: string | null;
    optionD: string | null;
    correctOption: string;
    format: 'MULTIPLE_CHOICE' | 'FILL_IN_THE_GAP';
    questionType: string;
}

interface PreviewQuiz {
    id: string;
    title: string;
    duration: number;
    isActive: boolean;
    examCode: string | null;
    retakeLimit: number | null;
    startDate: string | null;
    endDate: string | null;
    questions: PreviewQuestion[];
    _count: { questions: number };
}

export default function AdminQuizPreviewPage() {
    const params = useParams();
    const router = useRouter();
    const quizId = params?.id as string;

    const [quiz, setQuiz] = useState<PreviewQuiz | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [questionTypeStats, setQuestionTypeStats] = useState<any>(null);
    const [isCopied, setIsCopied] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const user = getUser();

        if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
            router.push('/login');
            return;
        }

        const fetchPreview = async () => {
            try {
                const [quizRes, statsRes] = await Promise.all([
                    apiFetch(`quizzes/${quizId}/preview`),
                    apiFetch(`questions/stats/${quizId}`)
                ]);

                if (!quizRes.ok) {
                    router.push('/admin/dashboard');
                    return;
                }

                const quizData = await quizRes.json();
                setQuiz(quizData);

                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setQuestionTypeStats(statsData);
                }
            } catch (err) {
                console.error('Failed to fetch preview', err);
                router.push('/admin/dashboard');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPreview();
    }, [quizId, router]);

    if (!quizId) {
        return <div>Loading...</div>;
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        );
    }

    if (!quiz) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <p className="text-slate-500 text-lg font-medium">Could not load preview.</p>
                <Link href="/admin/dashboard" className="text-primary font-bold hover:underline">Back to Dashboard</Link>
            </div>
        );
    }

    const formatDate = (iso: string | null) => {
        if (!iso) return 'Not set';
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleString();
    };

    const formatQuestionType = (questionType: string) => {
        const typeMap: { [key: string]: string } = {
            'AMBASSADOR_RANK_EXAMS': 'Ambassador Rank Exams',
            'EXTRAORDINARY_RANK_EXAMS': 'Extraordinary Rank Exams',
            'PRE_PLENIPOTENTIARY_EXAMS': 'Pre-Plenipotentiary Exams',
            'PLENIPOTENTIARY_RANK_EXAMS': 'Plenipotentiary Rank Exams'
        };
        return typeMap[questionType] || questionType;
    };

    const handleCopyCode = () => {
        if (!quiz?.examCode) return;
        navigator.clipboard.writeText(quiz.examCode);
        setIsCopied(true);
        toast('Exam code copied to clipboard!', 'success');
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleExportPdf = async () => {
        if (!quiz) return;
        
        setIsExportingPdf(true);
        try {
            const res = await apiFetch(`admin/export/quiz-preview/${quizId}?format=pdf`);
            
            if (!res.ok) {
                throw new Error('Failed to export PDF');
            }
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${quiz.title.toLowerCase().replace(/[^a-z0-9\s]/gi, '_').replace(/\s+/g, '_')}_questions_preview.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            toast('PDF exported successfully!', 'success');
        } catch (error) {
            console.error('PDF export error:', error);
            toast('Failed to export PDF', 'error');
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 transition-colors duration-200">
            <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <Link href="/admin/dashboard" className="flex items-center gap-2 text-primary font-bold mb-4 hover:gap-3 transition-all">
                            <ArrowLeft size={18} />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">Preview Exam</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Read-only preview of what candidates will see.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExportPdf}
                            disabled={isExportingPdf}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Download size={18} />
                            {isExportingPdf ? 'Exporting...' : 'Export PDF'}
                        </button>
                        <NotificationBell />
                        <ThemeToggle />
                    </div>
                </header>

                <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 p-8">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                            <BookOpen size={24} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{quiz.title}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-bold">
                                        <Clock size={16} /> Duration
                                    </div>
                                    <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{quiz.duration} min</div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-bold">
                                        <ListChecks size={16} /> Questions
                                    </div>
                                    <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{quiz._count?.questions ?? quiz.questions.length}</div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                                    <div className="text-slate-500 dark:text-slate-400 text-sm font-bold">Retake Limit</div>
                                    <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{quiz.retakeLimit ?? 2}</div>
                                </div>
                                {quiz.examCode && (
                                    <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-4 border border-primary/20 relative group">
                                        <div className="text-primary dark:text-primary text-sm font-bold">Exam Access Code</div>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="text-xl font-black text-primary tracking-widest uppercase">{quiz.examCode}</div>
                                            <button 
                                                onClick={handleCopyCode}
                                                className="p-2 hover:bg-primary/10 rounded-lg transition-all text-primary"
                                                title="Copy Code"
                                            >
                                                {isCopied ? <Check size={18} /> : <Copy size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                                    <div className="text-slate-500 dark:text-slate-400 text-sm font-bold">Start Date</div>
                                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">{formatDate(quiz.startDate)}</div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                                    <div className="text-slate-500 dark:text-slate-400 text-sm font-bold">End Date</div>
                                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-2">{formatDate(quiz.endDate)}</div>
                                </div>
                            </div>

                            {questionTypeStats && questionTypeStats.questionTypeDistribution.length > 0 && (
                                <div className="mt-6">
                                    <div className="text-slate-500 dark:text-slate-400 text-sm font-bold mb-3">Question Type Distribution</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {questionTypeStats.questionTypeDistribution.map((stat: any) => (
                                            <div key={stat.questionType} className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                                                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">{formatQuestionType(stat.questionType)}</div>
                                                <div className="text-lg font-black text-slate-800 dark:text-slate-100">{stat.count} questions ({stat.percentage}%)</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* QR Attendance Section */}
                <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">QR Code Attendance</h3>
                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Generate QR codes for candidates to verify their attendance before starting the exam.</p>
                    </div>
                    <div className="p-8">
                        <QRCodeDisplay 
                            quizId={quiz.id} 
                            quizTitle={quiz.title}
                        />
                    </div>
                </section>

                <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Questions</h3>
                        <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Options are shown as candidates would see them.</p>
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-slate-700">
                        {quiz.questions.map((q, idx) => (
                            <div key={q.id} className="p-6 md:p-8">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Q{idx + 1}</div>
                                    <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                        {formatQuestionType(q.questionType)}
                                    </div>
                                </div>
                                <div className="font-semibold text-slate-800 dark:text-slate-100 mb-4 leading-relaxed">{q.text}</div>
                                
                                {q.format === 'FILL_IN_THE_GAP' ? (
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white">
                                            <Check size={18} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Correct Answer</div>
                                            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{q.correctOption}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {([
                                            { key: 'A', text: q.optionA },
                                            { key: 'B', text: q.optionB },
                                            { key: 'C', text: q.optionC },
                                            { key: 'D', text: q.optionD }
                                        ].filter(o => o.text) as { key: string; text: string }[]).map(opt => {
                                            const isCorrect = q.correctOption === opt.key;
                                            return (
                                                <div 
                                                    key={opt.key} 
                                                    className={`px-4 py-3 rounded-xl border transition-all ${
                                                        isCorrect 
                                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20' 
                                                            : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <span className={`font-black mr-2 ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                                                                {opt.key}.
                                                            </span>
                                                            {opt.text}
                                                        </div>
                                                        {isCorrect && (
                                                            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white px-2 py-0.5 rounded-md shadow-sm">
                                                                Correct
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
