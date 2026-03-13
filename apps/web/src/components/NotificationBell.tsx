"use client";

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    quizId?: string | null;
    sessionId?: string | null;
    candidateName?: string | null;
    candidateEmail?: string | null;
    isRead: boolean;
    createdAt: string;
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    const fetchNotifications = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/notifications?pageSize=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount);
            }
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const markAsRead = async (notificationId: string) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/notifications/${notificationId}/read`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchNotifications();
            }
        } catch (err) {
            console.error('Failed to mark as read', err);
        }
    };

    const markAllAsRead = async () => {
        const token = localStorage.getItem('token');
        setIsLoading(true);
        try {
            const res = await fetch(`${apiUrl}/notifications/mark-all-read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchNotifications();
            }
        } catch (err) {
            console.error('Failed to mark all as read', err);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteNotification = async (notificationId: string) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchNotifications();
            }
        } catch (err) {
            console.error('Failed to delete notification', err);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Notifications"
            >
                <Bell size={20} className="text-slate-600 dark:text-slate-400" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 max-h-[600px] flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    disabled={isLoading}
                                    className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
                                    title="Mark all as read"
                                >
                                    <CheckCheck size={16} />
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                                <Bell size={48} className="mx-auto mb-3 opacity-30" />
                                <p className="font-medium">No notifications yet</p>
                                <p className="text-xs mt-1">You'll be notified when candidates submit exams</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${
                                        !notification.isRead ? 'bg-primary/5 dark:bg-primary/10' : ''
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                                                    {notification.title}
                                                </h4>
                                                {!notification.isRead && (
                                                    <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                                                {notification.message}
                                            </p>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            {!notification.isRead && (
                                                <button
                                                    onClick={() => markAsRead(notification.id)}
                                                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                                                    title="Mark as read"
                                                >
                                                    <Check size={14} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteNotification(notification.id)}
                                                className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-center">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    // Could navigate to a full notifications page if you create one
                                }}
                                className="text-xs font-bold text-primary hover:underline"
                            >
                                View All Notifications
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
