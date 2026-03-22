"use client";

import { useState, useEffect, useCallback } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '../../../components/ThemeToggle';
import NotificationBell from '../../../components/NotificationBell';
import { useToast } from '../../../contexts/ToastContext';
import CandidateTable from '../../../components/CandidateTable';

export default function MyExamTakersPage() {
    const router = useRouter();
    const [candidates, setCandidates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 25;
    const { toast } = useToast();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    // SUPER_ADMIN should use the full candidates page
    useEffect(() => {
        const userRaw = localStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;
        if (user?.role === 'SUPER_ADMIN') {
            router.replace('/admin/candidates');
        }
    }, [router]);

    const fetchTakers = useCallback(async (overridePage?: number) => {
        const token = localStorage.getItem('token');
        const effectivePage = overridePage ?? page;
        try {
            const params = new URLSearchParams({
                page: String(effectivePage),
                pageSize: String(pageSize),
                ...(searchTerm.trim() ? { q: searchTerm.trim() } : {}),
            });
            const res = await fetch(`${apiUrl}/admin/my-exam-takers?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setCandidates(data.items);
                setTotal(data.total);
            } else {
                toast('Failed to load exam takers', 'error');
            }
        } catch {
            toast('Failed to load exam takers', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, page, pageSize, searchTerm, toast]);

    useEffect(() => { fetchTakers(); }, [fetchTakers]);

    useEffect(() => {
        const t = setTimeout(() => { setPage(1); fetchTakers(1); }, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 transition-colors duration-200">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <div>
                        <Link href="/admin/dashboard" className="flex items-center gap-2 text-primary font-bold mb-4 hover:gap-3 transition-all">
                            <ArrowLeft size={18} /> Back to Dashboard
                        </Link>
                        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">My Exam Takers</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Candidates who have attempted your exams.</p>
                    </div>
                    <div className="flex gap-3 items-center">
                        <NotificationBell />
                        <ThemeToggle />
                    </div>
                </header>

                <div className="mb-8 relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name, email, or church..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 rounded-[1.5rem] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-slate-600 dark:text-slate-300 font-medium"
                    />
                </div>

                <CandidateTable
                    candidates={candidates}
                    isLoading={isLoading}
                    total={total}
                    page={page}
                    pageSize={pageSize}
                    totalPages={totalPages}
                    searchTerm={searchTerm}
                    onClearSearch={() => setSearchTerm('')}
                    onPrev={() => setPage(p => Math.max(1, p - 1))}
                    onNext={() => setPage(p => Math.min(totalPages, p + 1))}
                />
            </div>
        </main>
    );
}
