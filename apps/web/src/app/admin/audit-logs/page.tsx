"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Search, ArrowLeft, User, Globe, Activity, Shield, Clock, Info, Smartphone, Monitor } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '../../../components/ThemeToggle';
import NotificationBell from '../../../components/NotificationBell';
import { useToast } from '../../../contexts/ToastContext';
import { apiFetch } from '../../../lib/api';

interface AuditLog {
    id: string;
    action: string;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: any;
    createdAt: string;
    user: {
        name: string;
        email: string;
        role: string;
    } | null;
}

function AuditLogsContent() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(25);
    const [total, setTotal] = useState(0);

    const { toast } = useToast();

    const fetchLogs = useCallback(async (overridePage?: number) => {
        const effectivePage = overridePage ?? page;
        try {
            const params = new URLSearchParams({
                page: String(effectivePage),
                pageSize: String(pageSize),
                action: actionFilter,
                ...(searchTerm.trim() ? { q: searchTerm.trim() } : {})
            });
            const res = await apiFetch(`admin/audit-logs?${params.toString()}`);
            if (res.ok) {
                const data: any = await res.json();
                setLogs(data.items);
                setTotal(data.total);
            }
        } catch (err) {
            console.error('Failed to fetch audit logs', err);
            toast('Failed to load audit logs.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [page, pageSize, searchTerm, actionFilter, toast]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        const t = setTimeout(() => {
            setPage(1);
            fetchLogs(1);
        }, 300);
        return () => clearTimeout(t);
    }, [searchTerm, actionFilter]);

    const formatAction = (action: string) => {
        return action.replace(/_/g, ' ');
    };

    const getActionColor = (action: string) => {
        if (action.includes('LOGIN')) return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30';
        if (action.includes('EXAM')) return 'text-primary bg-primary/5 border-primary/10';
        if (action.includes('CHANGED') || action.includes('UPDATE')) return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30';
        return 'text-slate-500 bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700';
    };

    const isMobile = (agent: string | null) => {
        if (!agent) return false;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(agent);
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 transition-colors duration-200">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 animate-fade-in">
                    <div>
                        <Link href="/admin/dashboard" className="flex items-center gap-2 text-primary font-bold mb-4 hover:gap-3 transition-all">
                            <ArrowLeft size={18} />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-3">
                            <Shield className="text-primary" />
                            System Audit Logs
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Monitoring administrative actions and system-wide security events.</p>
                    </div>
                    <div className="flex gap-4 items-center">
                        <NotificationBell />
                        <ThemeToggle />
                    </div>
                </header>

                {/* Search and Filters */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12 animate-fade-in">
                    <div className="lg:col-span-3 relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name, email, IP, or action..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 rounded-[1.5rem] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-slate-600 dark:text-slate-300 font-medium"
                        />
                    </div>
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="py-4 px-6 rounded-[1.5rem] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-slate-600 dark:text-slate-300 font-bold appearance-none cursor-pointer"
                    >
                        <option value="all">All Actions</option>
                        <option value="ADMIN_LOGIN">Admin Logins</option>
                        <option value="USER_LOGIN">User Logins</option>
                        <option value="EXAM_STARTED">Exam Started</option>
                        <option value="EXAM_SUBMITTED">Exam Submitted</option>
                        <option value="USER_TYPE_CHANGED">Type Changes</option>
                    </select>
                </div>

                <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-slide-up">
                    <div className="p-8 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Audit History</h3>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{total} Total Events</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest border-b border-slate-50 dark:border-slate-700">
                                    <th className="px-8 py-6">Action</th>
                                    <th className="px-8 py-6">User</th>
                                    <th className="px-8 py-6">IP Address</th>
                                    <th className="px-8 py-6">Device</th>
                                    <th className="px-8 py-6">Timestamp</th>
                                    <th className="px-8 py-6 text-center">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-20 text-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                        </td>
                                    </tr>
                                ) : logs.length > 0 ? logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getActionColor(log.action)}`}>
                                                {formatAction(log.action)}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6">
                                            {log.user ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                        <User size={14} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{log.user.name}</div>
                                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-tight">{log.user.role}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-sm font-medium italic">System</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 px-2.5 py-1.5 rounded-lg w-fit">
                                                <Globe size={12} />
                                                {log.ipAddress || 'unknown'}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400" title={log.userAgent || ''}>
                                                {isMobile(log.userAgent) ? <Smartphone size={16} /> : <Monitor size={16} />}
                                                <span className="text-xs font-medium truncate max-w-[120px]">
                                                    {log.userAgent ? (isMobile(log.userAgent) ? 'Mobile' : 'Desktop') : 'Unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm font-medium">
                                                <Clock size={14} className="text-slate-400" />
                                                {new Date(log.createdAt).toLocaleString('en-GB', { 
                                                    day: '2-digit', 
                                                    month: '2-digit', 
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <button 
                                                onClick={() => {
                                                    // Quick metadata view via alert for now, can be improved to a modal later
                                                    console.log('Log Metadata:', log.metadata);
                                                    toast('View console for technical metadata', 'info');
                                                }}
                                                className="p-2 text-slate-400 hover:text-primary transition-colors"
                                                title="View technical details"
                                            >
                                                <Info size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-bold">
                                            No audit logs found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-8 border-t border-slate-50 dark:border-slate-700 flex flex-col md:flex-row gap-4 md:items-center justify-between bg-slate-50/30 dark:bg-slate-900/10">
                        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                            Showing {(total === 0) ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-5 py-2 rounded-xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                Prev
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-5 py-2 rounded-xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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

export default function AuditLogsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        }>
            <AuditLogsContent />
        </Suspense>
    );
}
