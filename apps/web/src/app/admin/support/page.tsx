"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, ArrowLeft, MessageCircle, User, Clock, CheckCircle2, AlertCircle, Send, Bell } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '../../../components/ThemeToggle';
import NotificationBell from '../../../components/NotificationBell';
import { useToast } from '../../../contexts/ToastContext';
import { format, formatDistanceToNow } from 'date-fns';
import { io, Socket } from 'socket.io-client';

interface SupportThread {
    userId: string;
    user: {
        id: string;
        name: string;
        email: string;
    };
    latestMessage: string;
    latestCreatedAt: string;
    status: string;
}

interface ChatItem {
    id: string;
    message: string;
    isAdmin: boolean;
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
    const { toast } = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    const fetchThreads = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiUrl}/support/admin`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setThreads(data);
            }
        } catch (err) {
            toast('Failed to fetch support threads', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, toast]);

    const fetchChatHistory = useCallback(async (userId: string) => {
        setIsChatLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiUrl}/support/admin/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setChatHistory(data.history);
                setSelectedUser(data.user);
            }
        } catch (err) {
            toast('Failed to fetch chat history', 'error');
        } finally {
            setIsChatLoading(false);
        }
    }, [apiUrl, toast]);

    // Use a ref for the selectedUserId to access it inside socket callbacks
    const selectedUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        selectedUserIdRef.current = selectedUserId;
    }, [selectedUserId]);

    useEffect(() => {
        fetchThreads();

        // Socket for real-time updates from candidates
        const token = localStorage.getItem('token');
        if (token) {
            const socketUrl = apiUrl.replace('/api', '');
            const socket = io(socketUrl, {
                auth: { token },
                transports: ['websocket', 'polling'],
            });

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
                }
            });

            socketRef.current = socket;
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [apiUrl, fetchThreads, fetchChatHistory]);

    useEffect(() => {
        if (selectedUserId) {
            fetchChatHistory(selectedUserId);
        }
    }, [selectedUserId, fetchChatHistory]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reply.trim() || !selectedUserId) return;

        setIsSending(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiUrl}/support/admin/${selectedUserId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: reply }),
            });

            if (res.ok) {
                setReply('');
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
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiUrl}/support/admin/${selectedUserId}/resolve`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
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
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
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
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-40 space-y-3">
                                <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full" />
                                <p className="text-sm text-slate-500">Loading threads...</p>
                            </div>
                        ) : filteredThreads.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-center p-6 text-slate-500">
                                <AlertCircle size={40} className="mb-3 opacity-20" />
                                <p className="text-sm font-medium">No support requests found</p>
                            </div>
                        ) : (
                            filteredThreads.map((thread) => (
                                <button
                                    key={thread.userId}
                                    onClick={() => setSelectedUserId(thread.userId)}
                                    className={`w-full p-4 flex gap-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all text-left ${selectedUserId === thread.userId ? 'bg-slate-100 dark:bg-slate-900 ring-2 ring-inset ring-primary' : ''}`}
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                        <User size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-bold text-slate-900 dark:text-white truncate text-sm">
                                                {thread.user.name}
                                            </h3>
                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                {formatDistanceToNow(new Date(thread.latestCreatedAt), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 truncate italic">
                                            &quot;{thread.latestMessage}&quot;
                                        </p>
                                        <div className="mt-2 flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                thread.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                                            }`}>
                                                {thread.status}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </aside>

                {/* Chat Area */}
                <main className={`flex-1 flex flex-col bg-white dark:bg-slate-800 ${!selectedUserId ? 'hidden md:flex' : 'flex'}`}>
                    {selectedUserId ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-md sticky top-0 z-20">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setSelectedUserId(null)} className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold">
                                        {selectedUser?.name.charAt(0)}
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
                                        <p className="text-xs text-slate-500">{selectedUser?.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={handleResolve}
                                        disabled={isResolving || currentThread?.status === 'RESOLVED'}
                                        className={`p-2 transition-colors ${
                                            currentThread?.status === 'RESOLVED' 
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
                                    chatHistory.map((item) => (
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
                                                
                                                <div className={`p-4 rounded-2xl text-sm shadow-sm ${
                                                    item.isAdmin 
                                                        ? 'bg-primary text-white rounded-tr-none' 
                                                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700'
                                                }`}>
                                                    {item.title && <p className="font-bold mb-1 text-xs opacity-90">{item.title}</p>}
                                                    <p className="whitespace-pre-wrap">{item.message}</p>
                                                </div>
                                                
                                                <span className="text-[9px] text-slate-400 mt-1 px-1">
                                                    {format(new Date(item.createdAt), 'MMM d, h:mm a')}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Reply Input */}
                            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                                <form onSubmit={handleSendReply} className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <textarea
                                            rows={2}
                                            placeholder="Type your reply..."
                                            value={reply}
                                            onChange={(e) => setReply(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendReply(e);
                                                }
                                            }}
                                            className="w-full py-3 pl-4 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none text-sm"
                                        />
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
