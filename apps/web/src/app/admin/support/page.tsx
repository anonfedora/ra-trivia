"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, ArrowLeft, MessageCircle, User, Clock, CheckCircle2, AlertCircle, Send, Bell, Check, CheckCheck, Book, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '../../../components/ThemeToggle';
import NotificationBell from '../../../components/NotificationBell';
import { useToast } from '../../../contexts/ToastContext';
import { format, formatDistanceToNow } from 'date-fns';
import { Socket } from 'socket.io-client';
import { createSocket } from '../../../lib/socket';
import { apiFetch } from '../../../lib/api';
import { getAccessToken } from '../../../lib/auth';

interface SupportThread {
    userId: string;
    user: {
        id: string;
        name: string;
        email: string;
        userType?: string;
    };
    latestMessage: string;
    latestCreatedAt: string;
    status: string;
    unreadCount: number;
}

interface ChatItem {
    id: string;
    message: string;
    isAdmin: boolean;
    isRead: boolean;
    createdAt: string;
    type: 'MESSAGE' | 'NOTIFICATION';
    title?: string;
}

export default function AdminSupportPage() {
    const [threads, setThreads] = useState<SupportThread[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);
    const [selectedUser, setSelectedUser] = useState<{ name: string; email: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [reply, setReply] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterUnread, setFilterUnread] = useState(false);
    const [filterUserType, setFilterUserType] = useState<string>('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const [templates, setTemplates] = useState<{ id: string, title: string, content: string }[]>([]);
    const [aiSuggestion, setAiSuggestion] = useState<{ templateId: string | null, confidence: number, reasoning: string, suggestedReply?: string } | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { toast } = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    const fetchThreads = useCallback(async (page = 1) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                unreadOnly: String(filterUnread),
                userType: filterUserType,
                search: searchQuery
            });

            const res = await apiFetch(`support/admin?${params}`);
            if (res.ok) {
                const data = await res.json();
                setThreads(data.threads);
                setPagination({
                    page: data.pagination.page,
                    totalPages: data.pagination.totalPages
                });
            }
        } catch (err) {
            toast('Failed to fetch support threads', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [toast, filterUnread, filterUserType, searchQuery]);

    const fetchTemplates = useCallback(async () => {
        try {
            const res = await apiFetch('support/admin/templates');
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
            }
        } catch (err) {
            console.error('Failed to fetch templates', err);
        }
    }, []);

    const fetchAiSuggestions = useCallback(async (userId: string) => {
        setIsAiLoading(true);
        setAiSuggestion(null);
        try {
            const res = await apiFetch(`support/admin/${userId}/ai-suggestions`);
            if (res.ok) {
                const data = await res.json();
                setAiSuggestion(data);
            }
        } catch (err) {
            console.error('Failed to fetch AI suggestions', err);
        } finally {
            setIsAiLoading(false);
        }
    }, []);

    const markAsRead = useCallback(async (userId: string) => {
        try {
            await apiFetch(`support/admin/${userId}/read`, {
                method: 'PATCH'
            });

            // Update thread list unread count locally for immediate feedback
            setThreads(prev => prev.map(t =>
                t.userId === userId ? { ...t, unreadCount: 0 } : t
            ));
        } catch (err) {
            console.error('Failed to mark messages as read', err);
        }
    }, []);

    const fetchChatHistory = useCallback(async (userId: string) => {
        setIsChatLoading(true);
        try {
            const res = await apiFetch(`support/admin/${userId}`);
            if (res.ok) {
                const data = await res.json();
                setChatHistory(data.history);
                setSelectedUser(data.user);

                // If there are unread candidate messages, mark them as read
                const hasUnreadCandidateMessages = data.history.some((m: ChatItem) => !m.isAdmin && !m.isRead && m.type === 'MESSAGE');
                if (hasUnreadCandidateMessages) {
                    markAsRead(userId);
                }
            }
        } catch (err) {
            toast('Failed to fetch chat history', 'error');
        } finally {
            setIsChatLoading(false);
        }
    }, [toast, markAsRead]);

    // Use a ref for the selectedUserId to access it inside socket callbacks
    const selectedUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        selectedUserIdRef.current = selectedUserId;
    }, [selectedUserId]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    useEffect(() => {
        fetchThreads(1);
    }, [filterUnread, filterUserType, fetchThreads]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchThreads(1);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, fetchThreads]);

    useEffect(() => {
        // Socket for real-time updates from candidates
        const token = getAccessToken();
        if (token) {
            const socket = createSocket(token);

            socket.on('notification', (notif) => {
                if (notif.type === 'SUPPORT_REQUEST') {
                    fetchThreads();
                }
            });

            socket.on('support_message', (msg) => {
                fetchThreads(); // Refresh thread list
                // If the user is currently chatting with this user, refresh their chat too
                if (selectedUserIdRef.current === msg.userId) {
                    fetchChatHistory(msg.userId);
                    fetchAiSuggestions(msg.userId); // Fetch AI suggestion for new message
                }
            });

            socket.on('user_typing', (data: { userId: string, isTyping: boolean }) => {
                setTypingUsers(prev => {
                    const next = new Set(prev);
                    if (data.isTyping) {
                        next.add(data.userId);
                    } else {
                        next.delete(data.userId);
                    }
                    return next;
                });
            });

            socket.on('messages_read', (data) => {
                if (data.byCandidate) {
                    // Candidate read admin's messages, refresh history to show double checks
                    if (selectedUserIdRef.current === data.userId) {
                        fetchChatHistory(data.userId);
                    }
                }
            });

            socketRef.current = socket;
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [fetchThreads, fetchChatHistory, fetchAiSuggestions]);

    useEffect(() => {
        if (selectedUserId) {
            fetchChatHistory(selectedUserId);
            fetchAiSuggestions(selectedUserId);
        }
    }, [selectedUserId, fetchChatHistory, fetchAiSuggestions]);

    const scrollToBottom = (smooth = true) => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    };

    useEffect(() => {
        if (chatHistory.length > 0 || (selectedUserId && typingUsers.has(selectedUserId))) {
            scrollToBottom();
        }
    }, [chatHistory, typingUsers, selectedUserId]);

    const handleTyping = () => {
        if (!socketRef.current || !selectedUserId) return;

        // Emit typing_start with the target user ID
        socketRef.current.emit('typing_start', { userId: selectedUserId });

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set timeout to emit typing_stop after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            if (socketRef.current) {
                socketRef.current.emit('typing_stop', { userId: selectedUserId });
            }
            typingTimeoutRef.current = null;
        }, 2000);
    };

    const handleSendReply = async (e?: React.FormEvent, messageOverride?: string) => {
        if (e) e.preventDefault();
        const messageToSend = messageOverride || reply;
        
        if (!messageToSend.trim() || !selectedUserId) return;

        // Clear typing indicator immediately on send
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
            if (socketRef.current) {
                socketRef.current.emit('typing_stop', { userId: selectedUserId });
            }
        }

        setIsSending(true);
        try {
            const res = await apiFetch(`support/admin/${selectedUserId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: messageToSend }),
            });

            if (res.ok) {
                if (!messageOverride) setReply('');
                fetchChatHistory(selectedUserId);
                fetchThreads(); // Refresh thread preview
            } else {
                toast('Failed to send reply', 'error');
            }
        } catch (err) {
            toast('An error occurred while sending reply', 'error');
        } finally {
            setIsSending(false);
        }
    };

    const handleResolve = async () => {
        if (!selectedUserId || isResolving) return;

        setIsResolving(true);
        try {
            const res = await apiFetch(`support/admin/${selectedUserId}/resolve`, {
                method: 'PATCH'
            });

            if (res.ok) {
                toast('Thread marked as resolved', 'success');
                fetchThreads(); // Refresh list to show RESOLVED status
            } else {
                toast('Failed to resolve thread', 'error');
            }
        } catch (err) {
            toast('An error occurred while resolving', 'error');
        } finally {
            setIsResolving(false);
        }
    };

    const filteredThreads = threads.filter(t =>
        t.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const currentThread = threads.find(t => t.userId === selectedUserId);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
            {/* Header */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Link href="/admin/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MessageCircle className="text-primary" /> Support Center
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <NotificationBell />
                    <ThemeToggle />
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Threads List */}
                <aside className={`w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col ${selectedUserId ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search candidates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setFilterUnread(!filterUnread)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${filterUnread
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary'
                                    }`}
                            >
                                Unread Only
                            </button>
                            <select
                                value={filterUserType}
                                onChange={(e) => setFilterUserType(e.target.value)}
                                className="px-2 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 outline-none hover:border-primary"
                            >
                                <option value="">All Types</option>
                                <option value="AMBASSADOR_RANK_EXAMS">Ambassador</option>
                                <option value="EXTRAORDINARY_RANK_EXAMS">Extraordinary</option>
                                <option value="PRE_PLENIPOTENTIARY_RANK_EXAMS">Pre-Plenipotentiary</option>
                                <option value="PLENIPOTENTIARY_RANK_EXAMS">Plenipotentiary</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {isLoading && threads.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 space-y-3">
                                <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full" />
                                <p className="text-sm text-slate-500">Loading threads...</p>
                            </div>
                        ) : threads.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-center p-6 text-slate-500">
                                <AlertCircle size={40} className="mb-3 opacity-20" />
                                <p className="text-sm font-medium">No support requests found</p>
                            </div>
                        ) : (
                            <>
                                {threads.map((thread) => (
                                    <button
                                        key={thread.userId}
                                        onClick={() => setSelectedUserId(thread.userId)}
                                        className={`w-full p-4 flex gap-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all text-left ${selectedUserId === thread.userId ? 'bg-slate-100 dark:bg-slate-900 ring-2 ring-inset ring-primary' : ''}`}
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 relative">
                                            <User size={24} />
                                            {thread.user.userType && (
                                                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center" title={thread.user.userType}>
                                                    <div className={`w-2 h-2 rounded-full ${thread.user.userType === 'AMBASSADOR_RANK_EXAMS' ? 'bg-blue-500' :
                                                            thread.user.userType === 'EXTRAORDINARY_RANK_EXAMS' ? 'bg-purple-500' :
                                                                thread.user.userType === 'PRE_PLENIPOTENTIARY_RANK_EXAMS' ? 'bg-amber-500' : 'bg-red-500'
                                                        }`} />
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-bold text-slate-900 dark:text-white truncate text-sm">
                                                    {thread.user.name}
                                                </h3>
                                                <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                                                    {thread.latestCreatedAt ? formatDistanceToNow(new Date(thread.latestCreatedAt), { addSuffix: true }) : ''}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 truncate italic">
                                                &quot;{thread.latestMessage}&quot;
                                            </p>
                                            <div className="mt-2 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${thread.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                                                        }`}>
                                                        {thread.status}
                                                    </span>
                                                    {typingUsers.has(thread.userId) && (
                                                        <span className="flex gap-0.5 items-center bg-primary/10 px-1.5 py-0.5 rounded-full">
                                                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
                                                            <span className="text-[8px] font-bold text-primary ml-1 uppercase">Typing</span>
                                                        </span>
                                                    )}
                                                </div>
                                                {thread.unreadCount > 0 && (
                                                    <span className="bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                                        {thread.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}

                                {/* Thread Pagination */}
                                {pagination.totalPages > 1 && (
                                    <div className="p-4 flex justify-center items-center gap-2 border-t border-slate-100 dark:border-slate-700/50">
                                        <button
                                            disabled={pagination.page === 1}
                                            onClick={() => fetchThreads(pagination.page - 1)}
                                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                                        >
                                            <ArrowLeft size={16} />
                                        </button>
                                        <span className="text-xs font-bold text-slate-500">
                                            {pagination.page} / {pagination.totalPages}
                                        </span>
                                        <button
                                            disabled={pagination.page === pagination.totalPages}
                                            onClick={() => fetchThreads(pagination.page + 1)}
                                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                                        >
                                            <ArrowLeft size={16} className="rotate-180" />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </aside>

                {/* Chat Area */}
                <main className={`flex-1 flex flex-col bg-white dark:bg-slate-800 ${!selectedUserId ? 'hidden md:flex' : 'flex'}`}>
                    {selectedUserId ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-md sticky top-0 z-20 shrink-0">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setSelectedUserId(null)} className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold relative">
                                        {selectedUser?.name.charAt(0)}
                                        {currentThread?.user.userType && (
                                            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 ${currentThread.user.userType === 'AMBASSADOR_RANK_EXAMS' ? 'bg-blue-500' :
                                                    currentThread.user.userType === 'EXTRAORDINARY_RANK_EXAMS' ? 'bg-purple-500' :
                                                        currentThread.user.userType === 'PRE_PLENIPOTENTIARY_RANK_EXAMS' ? 'bg-amber-500' : 'bg-red-500'
                                                }`} />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="font-bold text-slate-900 dark:text-white leading-tight">{selectedUser?.name}</h2>
                                            {currentThread?.status === 'RESOLVED' && (
                                                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                                    Resolved
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 flex items-center gap-2">
                                            {selectedUser?.email}
                                            {currentThread?.user.userType && (
                                                <>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                    <span className="text-[10px] font-bold uppercase text-primary tracking-tighter">
                                                        {currentThread.user.userType.replace(/_/g, ' ')}
                                                    </span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleResolve}
                                        disabled={isResolving || currentThread?.status === 'RESOLVED'}
                                        className={`p-2 transition-colors ${currentThread?.status === 'RESOLVED'
                                                ? 'text-green-500 cursor-default'
                                                : 'text-slate-400 hover:text-green-500'
                                            }`}
                                        title={currentThread?.status === 'RESOLVED' ? 'Thread Resolved' : 'Mark as resolved'}
                                    >
                                        {isResolving ? (
                                            <span className="animate-spin block w-5 h-5 border-2 border-slate-300 border-t-primary rounded-full" />
                                        ) : (
                                            <CheckCircle2 size={20} />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Messages Container */}
                            <div
                                ref={scrollRef}
                                className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900/50"
                            >
                                {isChatLoading && chatHistory.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full space-y-3 text-slate-400">
                                        <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full" />
                                        <p className="text-sm">Loading history...</p>
                                    </div>
                                ) : (
                                    <>
                                        {chatHistory.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`flex ${item.isAdmin ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                            >
                                                <div className={`max-w-[70%] flex flex-col ${item.isAdmin ? 'items-end' : 'items-start'}`}>
                                                    <div className="flex items-center gap-2 mb-1 px-1">
                                                        {!item.isAdmin ? (
                                                            <>
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{selectedUser?.name}</span>
                                                                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                                                                    <User size={10} />
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                                    {item.type === 'NOTIFICATION' ? <Bell size={10} /> : <CheckCircle2 size={10} />}
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                                    {item.type === 'NOTIFICATION' ? 'System' : 'Support Team'}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>

                                                    <div className={`p-4 rounded-2xl text-sm shadow-sm relative ${item.isAdmin
                                                            ? 'bg-primary text-white rounded-tr-none'
                                                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700'
                                                        }`}>
                                                        {item.title && <p className="font-bold mb-1 text-xs opacity-90">{item.title}</p>}
                                                        <p className="whitespace-pre-wrap">{item.message}</p>

                                                        {item.isAdmin && item.type === 'MESSAGE' && (
                                                            <div className="flex justify-end mt-1 -mr-1">
                                                                {item.isRead ? (
                                                                    <CheckCheck size={14} className="text-white/80" />
                                                                ) : (
                                                                    <Check size={14} className="text-white/60" />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <span className="text-[9px] text-slate-400 mt-1 px-1">
                                                        {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {selectedUserId && typingUsers.has(selectedUserId) && (
                                            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <div className="max-w-[70%] flex flex-col items-start">
                                                    <div className="flex items-center gap-2 mb-1 px-1">
                                                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                                                            <User size={10} />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{selectedUser?.name}</span>
                                                    </div>
                                                    <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 shadow-sm flex gap-1 items-center">
                                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Reply Input */}
                            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0 relative">
                                {/* AI Suggestion Section */}
                                {aiSuggestion && (aiSuggestion.templateId || aiSuggestion.suggestedReply) && (
                                    <div className="mb-4 animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                        <Sparkles size={14} />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">AI Suggestion</span>
                                                    {aiSuggestion.confidence > 0.8 && (
                                                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded-full uppercase tracking-tighter">High Confidence</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium italic">
                                                    {aiSuggestion.reasoning}
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-start gap-3">
                                                <div className="flex-1">
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                                                        {aiSuggestion.templateId 
                                                            ? templates.find(t => t.id === aiSuggestion.templateId)?.content 
                                                            : aiSuggestion.suggestedReply}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const content = aiSuggestion.templateId 
                                                            ? templates.find(t => t.id === aiSuggestion.templateId)?.content 
                                                            : aiSuggestion.suggestedReply;
                                                        if (content) {
                                                            setReply(content);
                                                            setAiSuggestion(null); // Clear suggestion after use
                                                        }
                                                    }}
                                                    className="px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm shrink-0"
                                                >
                                                    Apply Suggestion
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isAiLoading && (
                                    <div className="mb-4 animate-pulse">
                                        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700" />
                                            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded-full" />
                                            <div className="h-3 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full" />
                                        </div>
                                    </div>
                                )}

                                {showTemplates && (
                                    <div className="absolute bottom-full left-0 w-full p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-xl z-50 animate-in slide-in-from-bottom-2 duration-200">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                <Book size={16} className="text-primary" /> Response Templates
                                            </h4>
                                            <button
                                                onClick={() => setShowTemplates(false)}
                                                className="text-xs text-slate-500 hover:text-slate-700"
                                            >
                                                Close
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {templates.map(t => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => {
                                                        handleSendReply(undefined, t.content);
                                                        setShowTemplates(false);
                                                    }}
                                                    className="p-3 text-left border border-slate-100 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all group"
                                                >
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{t.title}</p>
                                                    <p className="text-[10px] text-slate-500 truncate">{t.content}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <form onSubmit={handleSendReply} className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <textarea
                                            rows={2}
                                            placeholder="Type your reply..."
                                            value={reply}
                                            onChange={(e) => {
                                                setReply(e.target.value);
                                                handleTyping();
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendReply(e);
                                                }
                                            }}
                                            className="w-full py-3 pl-4 pr-10 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowTemplates(!showTemplates)}
                                            className={`absolute right-3 top-3 p-1 rounded-lg transition-all ${showTemplates ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-primary'
                                                }`}
                                            title="Use Template"
                                        >
                                            <Book size={18} />
                                        </button>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSending || !reply.trim()}
                                        className="self-end p-4 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all"
                                    >
                                        {isSending ? (
                                            <span className="animate-spin block w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                                        ) : (
                                            <Send size={20} />
                                        )}
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50 dark:bg-slate-900/50">
                            <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center text-slate-300 dark:text-slate-600 mb-6">
                                <MessageCircle size={48} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Support Conversations</h2>
                            <p className="text-slate-500 max-w-sm">Select a candidate from the left panel to start responding to their support requests.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
