"use client";

import { useState, useEffect } from 'react';
import { BookOpen, Clock, PlayCircle, Plus, Upload, Trash2, Power, PowerOff, FileDown, MoreVertical, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface Quiz {
    id: string;
    title: string;
    duration: number;
    isActive: boolean;
    _count: {
        questions: number;
    };
}

interface Attempt {
    id: string;
    startTime: string;
    endTime: string | null;
    score: number | null;
    user: {
        name: string;
        email: string;
    };
    quiz: {
        title: string;
    };
}

export default function AdminDashboard() {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [recentAttempts, setRecentAttempts] = useState<Attempt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [selectedQuizId, setSelectedQuizId] = useState<string>('');

    // Create Quiz Form
    const [newTitle, setNewTitle] = useState('');
    const [newDuration, setNewDuration] = useState('30');
    const [isCreating, setIsCreating] = useState(false);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const token = localStorage.getItem('token');
        try {
            // Fetch Quizzes — cache-bust to always get fresh data
            const quizRes = await fetch(`${apiUrl}/quizzes?t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' }
            });
            if (quizRes.ok) {
                const data = await quizRes.json();
                setQuizzes(data);
                // Only auto-select if nothing is selected yet
                setSelectedQuizId(prev => (prev || (data.length > 0 ? data[0].id : '')));
            }

            // Fetch Recent Results
            const resultRes = await fetch(`${apiUrl}/admin/results`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resultRes.ok) {
                const data = await resultRes.json();
                setRecentAttempts(data.slice(0, 5));
            }
        } catch (err) {
            console.error('Failed to fetch data', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchQuizzes = () => fetchData(); // Alias for backward compatibility if needed

    const handleCreateQuiz = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/quizzes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: newTitle, duration: newDuration }),
            });

            if (res.ok) {
                setNewTitle('');
                fetchQuizzes();
                alert('Quiz created successfully!');
            }
        } catch (err) {
            alert('Creation failed');
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggle = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/quizzes/${id}/toggle`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchQuizzes();
        } catch (err) {
            console.error('Toggle failed');
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!window.confirm(`Are you sure you want to delete "${title}"? This will also delete all associated questions and candidate sessions.`)) {
            return;
        }

        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/quizzes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                // Immediately remove from local state — don't wait for re-fetch
                setQuizzes(prev => prev.filter(q => q.id !== id));
                if (selectedQuizId === id) setSelectedQuizId('');
                // Then re-fetch to confirm server state is in sync
                fetchQuizzes();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(`Delete failed: ${errData.message || 'Unknown error'}`);
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('Could not connect to server for deletion');
        }
    };

    const [importToExisting, setImportToExisting] = useState(true);
    const [importTitle, setImportTitle] = useState('');
    const [importDuration, setImportDuration] = useState('30');

    const handleUpload = async () => {
        if (!file || (importToExisting && !selectedQuizId)) {
            alert('Please select a file and a quiz');
            return;
        }
        if (!importToExisting && (!importTitle || !importDuration)) {
            alert('Please provide a title and duration for the new exam');
            return;
        }
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', file);
        if (importToExisting) {
            formData.append('quizId', selectedQuizId);
        } else {
            formData.append('title', importTitle);
            formData.append('duration', importDuration);
        }

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiUrl}/questions/import`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (res.ok) {
                alert('Import successful!');
                setImportTitle('');
                setFile(null);
                fetchQuizzes();
            } else {
                const errorData = await res.json();
                alert(`Import failed: ${errorData.message || 'Unknown error'}`);
            }
        } catch (err) {
            alert('Upload error: Could not connect to the server');
        } finally {
            setIsUploading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 p-6 md:p-12">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 animate-fade-in">
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Admin Dashboard</h1>
                        <p className="text-slate-500 mt-2 font-medium">Manage your exam sessions and candidate records.</p>
                    </div>
                    <div className="flex gap-4">
                        <Link href="/admin/results" className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:shadow-xl transition-all">
                            <BookOpen size={18} />
                            Detailed Results
                        </Link>
                    </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    {/* Left Column: Quiz List & Recent Activity */}
                    <div className="xl:col-span-3 space-y-8">
                        {/* Exam Sessions List */}
                        <section className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-slide-up">
                            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                <h3 className="text-xl font-bold text-slate-800">Exam Sessions</h3>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{quizzes.length} Total</span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-50">
                                            <th className="px-8 py-6">Exam Title</th>
                                            <th className="px-8 py-6">Questions</th>
                                            <th className="px-8 py-6">Duration</th>
                                            <th className="px-8 py-6">Status</th>
                                            <th className="px-8 py-6">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {quizzes.map((quiz) => (
                                            <tr
                                                key={quiz.id}
                                                onClick={() => setSelectedQuizId(quiz.id)}
                                                className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedQuizId === quiz.id ? 'bg-primary/5' : ''}`}
                                            >
                                                <td className="px-8 py-6">
                                                    <div className="font-bold text-slate-900">{quiz.title}</div>
                                                    <div className="text-xs text-slate-400 mt-1 uppercase tracking-tighter font-bold">ID: {quiz.id.slice(0, 8)}</div>
                                                </td>
                                                <td className="px-8 py-6 font-semibold text-slate-600">{quiz._count.questions} Items</td>
                                                <td className="px-8 py-6 font-semibold text-slate-600">{quiz.duration} min</td>
                                                <td className="px-8 py-6">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${quiz.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${quiz.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                        {quiz.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleToggle(e, quiz.id)}
                                                            className={`p-2 rounded-xl border transition-all ${quiz.isActive ? 'bg-amber-50 border-amber-100 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}
                                                            title={quiz.isActive ? "Deactivate" : "Activate"}
                                                        >
                                                            {quiz.isActive ? <PowerOff size={18} /> : <Power size={18} />}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDelete(e, quiz.id, quiz.title)}
                                                            className="p-2 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all font-bold"
                                                            title="Delete Exam"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Recent Activity Table */}
                        <section className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
                            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                <h3 className="text-xl font-bold text-slate-800">Recent Candidate Activity</h3>
                                <Link href="/admin/results" className="text-xs font-bold text-primary uppercase tracking-widest hover:underline">View All</Link>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-50">
                                            <th className="px-8 py-6">Candidate</th>
                                            <th className="px-8 py-6">Exam</th>
                                            <th className="px-8 py-6">Score</th>
                                            <th className="px-8 py-6">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {recentAttempts.length > 0 ? recentAttempts.map((attempt) => (
                                            <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-8 py-6">
                                                    <div className="font-bold text-slate-900">{attempt.user.name}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">{attempt.user.email}</div>
                                                </td>
                                                <td className="px-8 py-6 font-semibold text-slate-600">{attempt.quiz.title}</td>
                                                <td className="px-8 py-6 font-bold">
                                                    {attempt.score !== null ? (
                                                        <span className={attempt.score >= 50 ? 'text-emerald-500' : 'text-rose-500'}>
                                                            {attempt.score.toFixed(1)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 font-medium italic text-sm">N/A</span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${attempt.endTime ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                                        }`}>
                                                        {attempt.endTime ? 'Completed' : 'Running'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="px-8 py-10 text-center text-slate-400 italic">No recent activity.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Sidebar Actions */}
                    <div className="space-y-8">
                        {/* Create Quiz Form */}
                        <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl animate-fade-in" style={{ animationDelay: '150ms' }}>
                            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Plus className="text-primary" size={20} />
                                New Exam Session
                            </h3>
                            <form onSubmit={handleCreateQuiz} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Title</label>
                                    <input
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        placeholder="e.g. Mathematics Q1"
                                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Duration (min)</label>
                                    <input
                                        type="number"
                                        value={newDuration}
                                        onChange={(e) => setNewDuration(e.target.value)}
                                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 mt-2 shadow-lg shadow-slate-200"
                                >
                                    {isCreating ? 'Creating...' : 'Create Exam'}
                                </button>
                            </form>
                        </section>

                        {/* Import Questions */}
                        <section className="bg-primary p-10 rounded-[2.5rem] text-white shadow-xl shadow-primary/20 animate-fade-in" style={{ animationDelay: '200ms' }}>
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Upload size={20} />
                                Bulk Import
                            </h3>
                            <p className="text-primary-foreground/70 mb-8 text-sm leading-relaxed">
                                {importToExisting ? (
                                    selectedQuizId ? (
                                        <>Target Exam: <span className="font-bold text-white">{quizzes.find(q => q.id === selectedQuizId)?.title}</span></>
                                    ) : (
                                        'Select an exam from the list to import questions.'
                                    )
                                ) : (
                                    'A new exam will be created from your file.'
                                )}
                            </p>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl cursor-pointer hover:bg-white/20 transition-all mb-4" onClick={() => setImportToExisting(!importToExisting)}>
                                    <div className={`w-5 h-5 rounded-md border-2 border-white flex items-center justify-center transition-all ${!importToExisting ? 'bg-white' : ''}`}>
                                        {!importToExisting && <CheckCircle size={14} className="text-primary" />}
                                    </div>
                                    <span className="text-sm font-bold">Create new exam from this file</span>
                                </div>

                                {!importToExisting && (
                                    <div className="space-y-4 animate-slide-up">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest ml-1">New Exam Title</label>
                                            <input
                                                type="text"
                                                value={importTitle}
                                                onChange={(e) => setImportTitle(e.target.value)}
                                                placeholder="e.g. Science Part 1"
                                                className="w-full px-5 py-3 rounded-2xl bg-white/10 border border-white/20 focus:border-white focus:ring-4 focus:ring-white/10 transition-all outline-none text-sm text-white placeholder:text-white/40"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest ml-1">Duration (min)</label>
                                            <input
                                                type="number"
                                                value={importDuration}
                                                onChange={(e) => setImportDuration(e.target.value)}
                                                className="w-full px-5 py-3 rounded-2xl bg-white/10 border border-white/20 focus:border-white focus:ring-4 focus:ring-white/10 transition-all outline-none text-sm text-white"
                                            />
                                        </div>
                                    </div>
                                )}

                                <input
                                    key={file ? 'file-present' : 'file-empty'}
                                    type="file"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs text-primary-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white/20 file:text-white hover:file:bg-white/30"
                                />
                                <button
                                    onClick={handleUpload}
                                    disabled={isUploading || (importToExisting && !selectedQuizId)}
                                    className="w-full bg-white text-primary py-4 rounded-2xl font-bold shadow-lg transform transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                                >
                                    {isUploading ? 'Importing...' : 'Upload Excel'}
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
}
