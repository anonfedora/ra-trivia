"use client";

import { useState, useEffect, useCallback } from 'react';
import { Search, FileDown, ArrowLeft, User, Mail, GraduationCap, Award, Calendar } from 'lucide-react';
import Link from 'next/link';

interface Result {
    id: string;
    startTime: string;
    endTime: string | null;
    score: number | null;
    user: {
        name: string;
        email: string;
        church: string | null;
    };
    quiz: {
        title: string;
    };
}

interface PagedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

export default function AdminResults() {
    const [results, setResults] = useState<Result[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [status, setStatus] = useState<'all' | 'completed' | 'running'>('all');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(25);
    const [total, setTotal] = useState(0);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    const fetchResults = useCallback(async (overridePage?: number) => {
        const token = localStorage.getItem('token');
        const effectivePage = overridePage ?? page;
        try {
            const params = new URLSearchParams({
                page: String(effectivePage),
                pageSize: String(pageSize),
                status,
                ...(searchTerm.trim() ? { q: searchTerm.trim() } : {})
            });
            const res = await fetch(`${apiUrl}/admin/results?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data: PagedResponse<Result> = await res.json();
                setResults(data.items);
                setTotal(data.total);
            }
        } catch (err) {
            console.error('Failed to fetch results', err);
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, page, pageSize, searchTerm, status]);

    useEffect(() => {
        fetchResults();
    }, [fetchResults]);

    useEffect(() => {
        const t = setTimeout(() => {
            setPage(1);
            fetchResults(1);
        }, 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, status]);

    const handleExport = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/admin/export/excel`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'exam_results.xlsx';
                document.body.appendChild(a);
                a.click();
                a.remove();
            }
        } catch (err) {
            alert('Export failed');
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
                        <Link href="/admin/dashboard" className="flex items-center gap-2 text-primary font-bold mb-4 hover:gap-3 transition-all">
                            <ArrowLeft size={18} />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Exam Results</h1>
                        <p className="text-slate-500 mt-2 font-medium">Detailed breakdown of candidate performances across all exams.</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                            <FileDown size={18} />
                            Export Excel
                        </button>
                    </div>
                </header>

                {/* Search and Filters */}
                <div className="mb-8 relative animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name, email, or exam title..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 rounded-[1.5rem] bg-white border border-slate-200 shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-slate-600 font-medium"
                    />
                </div>

                {/* Results Table */}
                <section className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                        <h3 className="text-xl font-bold text-slate-800">Candidate Attempts</h3>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{total} records found</span>
                    </div>

                    <div className="px-8 pt-6 flex flex-col md:flex-row gap-4 md:items-center">
                        <div className="flex gap-2">
                            {(['all', 'completed', 'running'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatus(s)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${status === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {s === 'all' ? 'All' : s === 'completed' ? 'Completed' : 'Running'}
                                </button>
                            ))}
                        </div>

                        <div className="ml-auto text-sm font-bold text-slate-400">
                            Page {page} of {totalPages}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-50">
                                    <th className="px-8 py-6">Candidate</th>
                                    <th className="px-8 py-6">Exam</th>
                                    <th className="px-8 py-6">Score</th>
                                    <th className="px-8 py-6">Timeline</th>
                                    <th className="px-8 py-6">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {results.length > 0 ? results.map((result) => (
                                    <tr key={result.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                    <User size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900">{result.user.name}</div>
                                                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                                                        <Mail size={12} />
                                                        {result.user.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="font-semibold text-slate-700">{result.quiz.title}</div>
                                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1 uppercase font-bold tracking-tighter">
                                                <GraduationCap size={12} />
                                                {result.user.church || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {result.score !== null ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col">
                                                        <span className={`text-lg font-black ${result.score >= 70 ? 'text-emerald-500' : result.score >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                            {result.score.toFixed(1)}%
                                                        </span>
                                                        <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${result.score >= 70 ? 'bg-emerald-500' : result.score >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                                style={{ width: `${result.score}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    {result.score >= 80 && <Award className="text-amber-400" size={20} />}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 font-bold italic text-sm">In Progress</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
                                                <Calendar size={14} className="text-slate-400" />
                                                {new Date(result.startTime).toLocaleDateString()}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">
                                                Started: {new Date(result.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${result.endTime ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${result.endTime ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                                {result.endTime ? 'Completed' : 'Running'}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                                                    <Search size={32} />
                                                </div>
                                                <p className="text-slate-400 font-bold text-lg">No matching records found</p>
                                                <button onClick={() => setSearchTerm('')} className="text-primary font-bold hover:underline">Clear all filters</button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-8 border-t border-slate-50 flex flex-col md:flex-row gap-4 md:items-center justify-between bg-slate-50/30">
                        <div className="text-sm text-slate-500 font-medium">
                            Showing {(total === 0) ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-5 py-2 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-5 py-2 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
