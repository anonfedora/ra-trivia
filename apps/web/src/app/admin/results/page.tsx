"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Search, FileDown, ArrowLeft, User, Mail, GraduationCap, Award, Calendar, Activity } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ThemeToggle } from '../../../components/ThemeToggle';

interface Result {
    id: string;
    startTime: string;
    endTime: string | null;
    score: number | null;
    manualStatus: string | null;
    resultReleasesAt: string | null;
    user: {
        name: string;
        email: string;
        church: string | null;
    };
    quiz: {
        id: string;
        title: string;
    };
}

interface PagedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

function AdminResultsContent() {
    const searchParams = useSearchParams();
    const initialQuery = searchParams?.get('q') || '';

    const [results, setResults] = useState<Result[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(initialQuery);
    const [status, setStatus] = useState<'completed'>('completed');
    const [userTypeFilter, setUserTypeFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState<any>(null);

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
                const data: any = await res.json();
                setResults(data.items);
                setTotal(data.total);
                setSummary(data.summary);
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

    const handleStatusChange = async (sessionId: string, newStatus: string | null) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/admin/sessions/${sessionId}/status`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ manualStatus: newStatus })
            });

            if (res.ok) {
                // Refresh results to show updated status
                fetchResults();
            } else {
                alert('Failed to update status');
            }
        } catch (err) {
            console.error('Status update error:', err);
            alert('Failed to update status');
        }
    };

    const handleReleaseResults = async (sessionIds: string[]) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/admin/sessions/release`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionIds })
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message);
                fetchResults();
            } else {
                alert('Failed to release results');
            }
        } catch (err) {
            console.error('Release error:', err);
            alert('Failed to release results');
        }
    };

    const handleExport = async (format: 'excel' | 'formatted-excel' | 'pdf') => {
        const token = localStorage.getItem('token');
        try {
            const params = new URLSearchParams();
            if (userTypeFilter !== 'all') {
                params.append('userType', userTypeFilter);
            }
            
            const endpoint = format === 'excel' 
                ? `${apiUrl}/admin/export/excel`
                : `${apiUrl}/admin/export/${format}?${params.toString()}`;
                
            const res = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                
                const extension = format === 'pdf' ? 'pdf' : 'xlsx';
                const formatPrefix = format === 'formatted-excel' ? 'formatted_' : '';
                
                // Determine exam type for filename
                let examTypePrefix = '';
                
                if (userTypeFilter !== 'all') {
                    // Use the dropdown filter
                    examTypePrefix = `${userTypeFilter.toLowerCase()}_`;
                } else if (searchTerm.trim()) {
                    // Try to detect exam type from search term - be more flexible with matching
                    const searchLower = searchTerm.toLowerCase().trim();
                    
                    // Check for exam type keywords in search term
                    if (searchLower.includes('ambassador') || searchLower.includes('amb')) {
                        examTypePrefix = 'ambassador_rank_exams_';
                    } else if (searchLower.includes('extraordinary') || searchLower.includes('extra')) {
                        examTypePrefix = 'extraordinary_rank_exams_';
                    } else if (searchLower.includes('pre-plenipotentiary') || searchLower.includes('pre_plenipotentiary') || searchLower.includes('pre plenipotentiary')) {
                        examTypePrefix = 'pre_plenipotentiary_exams_';
                    } else if (searchLower.includes('plenipotentiary') && !searchLower.includes('pre')) {
                        examTypePrefix = 'plenipotentiary_rank_exams_';
                    } else {
                        // If search doesn't match any exam type, check if results contain a dominant exam type
                        const examTypeCounts = results.reduce((acc, result) => {
                            const title = result.quiz.title.toLowerCase();
                            if (title.includes('ambassador')) acc.ambassador = (acc.ambassador || 0) + 1;
                            else if (title.includes('extraordinary')) acc.extraordinary = (acc.extraordinary || 0) + 1;
                            else if (title.includes('pre-plenipotentiary') || title.includes('pre_plenipotentiary')) acc.pre_plenipotentiary = (acc.pre_plenipotentiary || 0) + 1;
                            else if (title.includes('plenipotentiary') && !title.includes('pre')) acc.plenipotentiary = (acc.plenipotentiary || 0) + 1;
                            return acc;
                        }, {} as Record<string, number>);
                        
                        // Find the most common exam type in results
                        const dominantType = Object.entries(examTypeCounts).reduce((max, [type, count]) => 
                            count > (max.count || 0) ? { type, count } : max, { type: '', count: 0 });
                        
                        if (dominantType.type && dominantType.count > 0) {
                            examTypePrefix = `${dominantType.type}_rank_exams_`;
                        } else {
                            examTypePrefix = 'search_results_';
                        }
                    }
                } else {
                    examTypePrefix = 'all_exams_';
                }
                
                a.download = `${examTypePrefix}${formatPrefix}exam_results.${extension}`;
                
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            }
        } catch (err) {
            alert('Export failed');
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    if (isLoading) {
        return null;
    }

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 transition-colors duration-200">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 animate-fade-in">
                    <div>
                        <Link href="/admin/dashboard" className="flex items-center gap-2 text-primary font-bold mb-4 hover:gap-3 transition-all">
                            <ArrowLeft size={18} />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">Completed Exam Results</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Analysis of completed candidate performances across all examinations.</p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <ThemeToggle />
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleExport('excel')}
                                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-3 rounded-2xl font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
                            >
                                <FileDown size={18} />
                                Excel
                            </button>
                            <button
                                onClick={() => handleExport('formatted-excel')}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-2xl font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
                            >
                                <FileDown size={18} />
                                Formatted Excel
                            </button>
                            <button
                                onClick={() => handleExport('pdf')}
                                className="flex items-center gap-2 bg-red-600 text-white px-4 py-3 rounded-2xl font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
                            >
                                <FileDown size={18} />
                                PDF Report
                            </button>
                        </div>
                    </div>
                </header>

                {/* Search and Filters */}
                <div className="mb-12 relative animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name, email, or exam title..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 rounded-[1.5rem] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-slate-600 dark:text-slate-300 font-medium"
                    />
                </div>

                {/* Performance Summary Header (Only when filtering) */}
                {summary && (
                    <div className="mb-12 grid grid-cols-1 md:grid-cols-4 gap-6 animate-slide-up">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Pass / Fail Ratio</h4>
                            <div className="flex items-end gap-1.5 mb-2">
                                <span className="text-3xl font-black text-emerald-500">{summary.passCount}</span>
                                <span className="text-xs font-bold text-slate-300 mb-1">vs</span>
                                <span className="text-3xl font-black text-rose-400">{summary.failCount}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                <div className="h-full bg-emerald-500" style={{ width: `${(summary.passCount / summary.totalCompleted) * 100}%` }} />
                                <div className="h-full bg-rose-400" style={{ width: `${(summary.failCount / summary.totalCompleted) * 100}%` }} />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Average Score</h4>
                            <div className="text-4xl font-black text-primary">{summary.averageScore}%</div>
                            <div className="text-[10px] font-bold text-slate-400 mt-1 italic">Across {summary.totalCompleted} completions</div>
                        </div>

                        <div className="md:col-span-2 bg-slate-900 dark:bg-primary p-6 rounded-3xl shadow-lg border border-slate-800 text-white flex justify-between items-center bg-gradient-to-br from-slate-900 to-slate-800 dark:from-primary dark:to-primary/80">
                            <div>
                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">Score Range</h4>
                                <div className="flex items-center gap-8">
                                    <div>
                                        <div className="text-[10px] font-bold text-white/40 uppercase">Highest</div>
                                        <div className="text-3xl font-black">{summary.highestScore}%</div>
                                    </div>
                                    <div className="w-px h-10 bg-white/10" />
                                    <div>
                                        <div className="text-[10px] font-bold text-white/40 uppercase">Lowest</div>
                                        <div className="text-3xl font-black text-white/60">{summary.lowestScore}%</div>
                                    </div>
                                </div>
                            </div>
                            <Activity className="text-white/10" size={64} />
                        </div>
                    </div>
                )}

                {/* Results Table */}
                <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-slide-up" style={{ animationDelay: '200ms' }}>
                    <div className="p-8 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Completed Attempts</h3>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{total} completed records</span>
                    </div>

                    <div className="px-8 pt-6 flex flex-col md:flex-row gap-4 md:items-center">
                        <div className="flex gap-2 items-center">
                            <label className="text-sm font-bold text-slate-600 dark:text-slate-400">Filter by Exam Type:</label>
                            <select
                                value={userTypeFilter}
                                onChange={(e) => setUserTypeFilter(e.target.value)}
                                className="px-3 py-2 rounded-xl text-sm font-bold border bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                            >
                                <option value="all">All Types</option>
                                <option value="AMBASSADOR_RANK_EXAMS">Ambassador Rank</option>
                                <option value="EXTRAORDINARY_RANK_EXAMS">Extraordinary Rank</option>
                                <option value="PRE_PLENIPOTENTIARY_EXAMS">Pre-Plenipotentiary</option>
                                <option value="PLENIPOTENTIARY_RANK_EXAMS">Plenipotentiary Rank</option>
                            </select>
                        </div>

                        <div className="ml-auto text-sm font-bold text-slate-400 dark:text-slate-500">
                            Page {page} of {totalPages}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest border-b border-slate-50 dark:border-slate-700">
                                    <th className="px-8 py-6">Candidate</th>
                                    <th className="px-8 py-6">Exam</th>
                                    <th className="px-8 py-6">Score</th>
                                    <th className="px-8 py-6">Status</th>
                                    <th className="px-8 py-6">Timeline</th>
                                    <th className="px-8 py-6">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {results.length > 0 ? results.map((result) => (
                                    <tr key={result.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                    <User size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-slate-100">{result.user.name}</div>
                                                    <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                        <Mail size={12} />
                                                        {result.user.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="font-semibold text-slate-700 dark:text-slate-300">{result.quiz.title}</div>
                                            <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mt-1 uppercase font-bold tracking-tighter">
                                                <GraduationCap size={12} />
                                                {result.user.church || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {result.score !== null && (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col">
                                                        <span className={`text-lg font-black ${result.score >= 70 ? 'text-emerald-500' : result.score >= 40 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                            {result.score.toFixed(1)}%
                                                        </span>
                                                        <div className="w-16 h-1 bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${result.score >= 70 ? 'bg-emerald-500' : result.score >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                                style={{ width: `${result.score}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    {result.score >= 80 && <Award className="text-amber-400" size={20} />}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-8 py-6">
                                            <select
                                                value={result.manualStatus || (result.score && result.score >= 50 ? 'Cleared' : 'Not Cleared - No Certificates')}
                                                onChange={(e) => handleStatusChange(result.id, e.target.value)}
                                                className="px-3 py-2 rounded-xl text-xs font-bold border bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            >
                                                <option value="Cleared">✅ Cleared</option>
                                                <option value="Not Cleared - No Certificates">❌ Not Cleared</option>
                                            </select>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm font-medium">
                                                <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
                                                {new Date(result.startTime).toLocaleDateString('en-GB')}
                                            </div>
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-tight">
                                                Started: {new Date(result.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {result.endTime && (
                                                    <>
                                                        <br />
                                                        Completed: {new Date(result.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <button
                                                onClick={() => handleReleaseResults([result.id])}
                                                disabled={!!result.resultReleasesAt && new Date(result.resultReleasesAt) <= new Date()}
                                                className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-95"
                                            >
                                                {result.resultReleasesAt && new Date(result.resultReleasesAt) <= new Date() ? '✓ Released' : 'Release Now'}
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-300 dark:text-slate-700">
                                                    <Search size={32} />
                                                </div>
                                                <p className="text-slate-400 dark:text-slate-500 font-bold text-lg">No matching records found</p>
                                                <button onClick={() => setSearchTerm('')} className="text-primary font-bold hover:underline">Clear all filters</button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-8 border-t border-slate-50 dark:border-slate-700 flex flex-col md:flex-row gap-4 md:items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            Showing {(total === 0) ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-5 py-2 rounded-xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-5 py-2 rounded-xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
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

export default function AdminResults() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        }>
            <AdminResultsContent />
        </Suspense>
    );
}
