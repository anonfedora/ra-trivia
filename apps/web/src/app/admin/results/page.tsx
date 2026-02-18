"use client";

import { useState, useEffect } from 'react';
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

export default function AdminResults() {
    const [results, setResults] = useState<Result[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    useEffect(() => {
        fetchResults();
    }, []);

    const fetchResults = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/admin/results`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setResults(data);
            }
        } catch (err) {
            console.error('Failed to fetch results', err);
        } finally {
            setIsLoading(false);
        }
    };

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

    const filteredResults = results.filter(r =>
        r.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.quiz.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{filteredResults.length} records found</span>
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
                                {filteredResults.length > 0 ? filteredResults.map((result) => (
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
                </section>
            </div>
        </main>
    );
}
