"use client";

import { ChevronRight, Users } from 'lucide-react';
import Link from 'next/link';

export interface CandidateRow {
    id: string;
    name: string;
    email: string;
    church: string | null;
    userType: string;
    createdAt: string;
    _count: { sessions: number };
}

const USER_TYPE_LABELS: Record<string, string> = {
    AMBASSADOR_RANK_EXAMS: 'Ambassador Rank',
    EXTRAORDINARY_RANK_EXAMS: 'Extraordinary Rank',
    PRE_PLENIPOTENTIARY_RANK_EXAMS: 'Pre-Plenipotentiary',
    PLENIPOTENTIARY_RANK_EXAMS: 'Plenipotentiary Rank',
};

interface Props {
    candidates: CandidateRow[];
    isLoading: boolean;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    searchTerm: string;
    onClearSearch: () => void;
    onPrev: () => void;
    onNext: () => void;
}

export default function CandidateTable({
    candidates, isLoading, total, page, pageSize, totalPages, searchTerm,
    onClearSearch, onPrev, onNext,
}: Props) {
    return (
        <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-8 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Candidates</h3>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{total} total</span>
            </div>

            {isLoading ? (
                <div className="p-12 space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : candidates.length === 0 ? (
                <div className="p-20 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto mb-4">
                        <Users size={32} className="text-slate-300 dark:text-slate-700" />
                    </div>
                    <p className="text-slate-400 font-bold text-lg">No candidates found</p>
                    {searchTerm && (
                        <button onClick={onClearSearch} className="text-primary font-bold hover:underline mt-2">
                            Clear search
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
                        {candidates.map((c) => (
                            <Link key={c.id} href={`/admin/candidates/${c.id}`}
                                className="flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-slate-100">{c.name}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{c.email}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{c.church || 'No church'} · {c._count.sessions} attempt{c._count.sessions !== 1 ? 's' : ''}</p>
                                </div>
                                <ChevronRight size={18} className="text-slate-300 flex-shrink-0" />
                            </Link>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest border-b border-slate-50 dark:border-slate-700">
                                    <th className="px-8 py-5">Name</th>
                                    <th className="px-8 py-5">Church</th>
                                    <th className="px-8 py-5">Exam Type</th>
                                    <th className="px-8 py-5">Attempts</th>
                                    <th className="px-8 py-5">Joined</th>
                                    <th className="px-8 py-5" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {candidates.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="font-bold text-slate-900 dark:text-slate-100">{c.name}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">{c.email}</div>
                                        </td>
                                        <td className="px-8 py-5 text-slate-600 dark:text-slate-400 font-medium">{c.church || '—'}</td>
                                        <td className="px-8 py-5">
                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                                                {USER_TYPE_LABELS[c.userType] ?? c.userType}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">{c._count.sessions}</td>
                                        <td className="px-8 py-5 text-slate-500 dark:text-slate-400 text-sm">
                                            {new Date(c.createdAt).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-8 py-5">
                                            <Link href={`/admin/candidates/${c.id}`}
                                                className="flex items-center gap-1 text-primary font-bold text-sm hover:gap-2 transition-all">
                                                View <ChevronRight size={16} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-8 border-t border-slate-50 dark:border-slate-700 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
                        <span className="text-sm text-slate-500 font-medium">
                            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                        </span>
                        <div className="flex gap-3">
                            <button onClick={onPrev} disabled={page <= 1}
                                className="px-5 py-2 rounded-xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                Prev
                            </button>
                            <button onClick={onNext} disabled={page >= totalPages}
                                className="px-5 py-2 rounded-xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                Next
                            </button>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
