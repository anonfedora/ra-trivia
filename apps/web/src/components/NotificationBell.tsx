"use client";

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { useToast } from '../contexts/ToastContext';
import { getAccessToken } from '../lib/auth';
import { requestCoordinator, coordinatedFetch } from '../lib/requestCoordinator';
import { apiFetch } from '../lib/api';

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
    const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [mounted, setMounted] = useState(false);
    const [notificationsHref, setNotificationsHref] = useState('/admin/notifications');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    useEffect(() => {
        setMounted(true);
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (user?.role === 'CANDIDATE') {
                setNotificationsHref('/notifications');
            }
        } catch {}
    }, []);

    const fetchNotifications = async () => {
        try {
            const data = await coordinatedFetch<any>(
                'notifications-header',
                'notifications?pageSize=10'
            );
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        }
    };

    useEffect(() => {
        // Add small delay to prevent request burst on login
        const timer = setTimeout(() => {
            fetchNotifications();
        }, 200);

        // Connect to Socket.IO for real-time notifications
        const token = getAccessToken();
        if (!token) return;

        const socketUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '');
        const socket: Socket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
        });

        socket.on('notification', () => {
            // A new notification arrived — refresh the list
            fetchNotifications();
        });

        socket.on('connect_error', (err) => {
            console.warn('[SOCKET] Connection error, falling back to polling:', err.message);
            // Fallback: poll every 30s if socket fails
            const interval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(interval);
        });

        return () => {
            clearTimeout(timer);
            socket.disconnect();
        };
    }, [apiUrl]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)
            ) {
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

    const getNotificationHref = (n: Notification): string | null => {
        if (n.type === 'NEW_EXAM_AVAILABLE' && n.quizId) {
            return `/quiz/${n.quizId}/instructions`;
        }
        if (n.type === 'SUPPORT_REQUEST') {
            return `/admin/support`;
        }
        return null;
    };

    const handleToggle = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const dropdownWidth = window.innerWidth < 640 ? Math.min(window.innerWidth - 16, 384) : 384;
            const rightFromEdge = window.innerWidth - rect.right;
            const clampedRight = Math.min(rightFromEdge, window.innerWidth - dropdownWidth - 8);
            setDropdownPos({
                top: rect.bottom + window.scrollY + 8,
                right: Math.max(8, clampedRight),
            });
        }
        setIsOpen(!isOpen);
    };

    const markAsRead = async (notificationId: string) => {
        try {
            const res = await apiFetch(`notifications/${notificationId}/read`, {
                method: 'PATCH'
            });
            if (res.ok) {
                fetchNotifications();
            }
        } catch (err) {
            console.error('Failed to mark as read', err);
        }
    };

    const markAllAsRead = async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('notifications/mark-all-read', {
                method: 'POST'
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
        try {
            const res = await apiFetch(`notifications/${notificationId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchNotifications();
            }
        } catch (err) {
            console.error('Failed to delete notification', err);
        }
    };

    const dropdownContent = (
        <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999, width: 'min(24rem, calc(100vw - 16px))' }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[600px] flex flex-col"
        >
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

            {/* Unread summary */}
            {unreadCount > 0 && (
                <div className="px-4 py-2 bg-primary/5 dark:bg-primary/10 border-b border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-primary">
                        You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                    </p>
                </div>
            )}

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                        <Bell size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No notifications yet</p>
                        <p className="text-xs mt-1">You&apos;ll be notified when candidates submit exams</p>
                    </div>
                ) : (
                    notifications.map((notification) => {
                        const href = getNotificationHref(notification);
                        const itemContent = (
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
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsRead(notification.id); }}
                                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                                            title="Mark as read"
                                        >
                                            <Check size={14} />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNotification(notification.id); }}
                                        className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );

                        return href ? (
                            <Link
                                key={notification.id}
                                href={href}
                                onClick={() => setIsOpen(false)}
                                className={`block p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${
                                    !notification.isRead ? 'bg-primary/5 dark:bg-primary/10' : ''
                                }`}
                            >
                                {itemContent}
                            </Link>
                        ) : (
                            <div
                                key={notification.id}
                                className={`p-4 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${
                                    !notification.isRead ? 'bg-primary/5 dark:bg-primary/10' : ''
                                }`}
                            >
                                {itemContent}
                            </div>
                        );
                    })
                )}
            </div>

            {notifications.length > 0 && (
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 text-center">
                    <Link
                        href={notificationsHref}
                        onClick={() => setIsOpen(false)}
                        className="text-xs font-bold text-primary hover:underline"
                    >
                        View All Notifications
                    </Link>
                </div>
            )}
        </div>
    );

    return (
        <div className="relative">
            <button
                ref={buttonRef}
                onClick={handleToggle}
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

            {isOpen && mounted && createPortal(dropdownContent, document.body)}
        </div>
    );
}
