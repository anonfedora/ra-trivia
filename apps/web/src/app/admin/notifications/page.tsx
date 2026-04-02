"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Bell, Check, CheckCheck, Trash2, ArrowLeft, ClipboardList, UserPlus, ShieldCheck, Users, LifeBuoy } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ThemeToggle } from '../../../components/ThemeToggle';
import { useToast } from '../../../contexts/ToastContext';
import { apiFetch } from '../../../lib/api';
import { getAccessToken } from '../../../lib/auth';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

type FilterType = 'ALL' | 'EXAM_SUBMITTED' | 'NEW_CANDIDATE' | 'NEW_ADMIN' | 'SUPPORT_REQUEST';

const FILTERS: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'ALL', label: 'All', icon: <Bell size={14} /> },
    { key: 'EXAM_SUBMITTED', label: 'Exams', icon: <ClipboardList size={14} /> },
    { key: 'NEW_CANDIDATE', label: 'Candidates', icon: <UserPlus size={14} /> },
    { key: 'NEW_ADMIN', label: 'Admins', icon: <ShieldCheck size={14} /> },
    { key: 'SUPPORT_REQUEST', label: 'Support', icon: <LifeBuoy size={14} /> },
];

function matchesFilter(type: string, filter: FilterType): boolean {
    if (filter === 'ALL') return true;
    if (filter === 'EXAM_SUBMITTED') return type === 'EXAM_SUBMITTED';
    if (filter === 'NEW_CANDIDATE') return type === 'NEW_USER_REGISTERED';
    if (filter === 'NEW_ADMIN') return type === 'NEW_ADMIN_REGISTERED' || (type === 'NEW_USER_REGISTERED' && false);
    if (filter === 'SUPPORT_REQUEST') return type === 'SUPPORT_REQUEST';
    return true;
}

// More precise: candidate = NEW_USER_REGISTERED where role is candidate
// We rely on the type field set by the server
function getFilter(type: string): FilterType {
    if (type === 'EXAM_SUBMITTED') return 'EXAM_SUBMITTED';
    if (type === 'NEW_ADMIN_REGISTERED') return 'NEW_ADMIN';
    if (type === 'NEW_USER_REGISTERED') return 'NEW_CANDIDATE';
    if (type === 'SUPPORT_REQUEST') return 'SUPPORT_REQUEST';
    return 'ALL';
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const { toast } = useToast();

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await apiFetch('notifications?pageSize=100');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            }
        } catch (err) {
            console.error('Failed to fetch notifications', err);
            toast('Failed to load notifications. Please refresh.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    const filtered = useMemo(() =>
        notifications.filter(n => {
            if (activeFilter === 'ALL') return true;
            return getFilter(n.type) === activeFilter;
        }),
        [notifications, activeFilter]
    );

    // Count per filter for badges
    const counts = useMemo(() => ({
        ALL: notifications.length,
        EXAM_SUBMITTED: notifications.filter(n => n.type === 'EXAM_SUBMITTED').length,
        NEW_CANDIDATE: notifications.filter(n => n.type === 'NEW_USER_REGISTERED').length,
        NEW_ADMIN: notifications.filter(n => n.type === 'NEW_ADMIN_REGISTERED').length,
        SUPPORT_REQUEST: notifications.filter(n => n.type === 'SUPPORT_REQUEST').length,
    }), [notifications]);

    const markAsRead = async (id: string) => {
        await apiFetch(`notifications/${id}/read`, {
            method: 'PATCH'
        });
        fetchNotifications();
    };

    const markAllAsRead = async () => {
        await apiFetch('notifications/mark-all-read', {
            method: 'POST'
        });
        fetchNotifications();
    };

    const deleteNotification = async (id: string) => {
        await apiFetch(`notifications/${id}`, {
            method: 'DELETE'
        });
        fetchNotifications();
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-12 transition-colors duration-200">
            <div className="max-w-3xl mx-auto">
                <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-8 gap-4">
                    <div>
                        <Link href="/admin/dashboard" className="flex items-center gap-2 text-primary font-bold mb-4 hover:gap-3 transition-all">
                            <ArrowLeft size={18} /> Back to Dashboard
                        </Link>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-3">
                            <Bell size={26} /> Notifications
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">
                            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <ThemeToggle />
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all whitespace-nowrap"
                            >
                                <CheckCheck size={14} /> Mark all read
                            </button>
                        )}
                    </div>
                </header>

                {/* Filter tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
                    {FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setActiveFilter(f.key)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${activeFilter === f.key
                                    ? 'bg-primary text-white shadow-md'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                }`}
                        >
                            {f.icon}
                            {f.label}
                            {counts[f.key] > 0 && (
                                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                    }`}>
                                    {counts[f.key]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <section className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                    {filtered.length === 0 ? (
                        <div className="p-16 text-center text-slate-400 dark:text-slate-500">
                            <Users size={56} className="mx-auto mb-4 opacity-20" />
                            <p className="font-bold text-lg">No notifications</p>
                            <p className="text-sm mt-1">Nothing here for this filter</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filtered.map((n) => (
                                <li key={n.id} className={`flex items-start gap-3 p-4 md:p-5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${!n.isRead ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{n.title}</p>
                                            {!n.isRead && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">{n.message}</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
                                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0 pt-1">
                                        {!n.isRead && (
                                            <button onClick={() => markAsRead(n.id)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500" title="Mark as read">
                                                <Check size={15} />
                                            </button>
                                        )}
                                        <button onClick={() => deleteNotification(n.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500" title="Delete">
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </main>
    );
}
