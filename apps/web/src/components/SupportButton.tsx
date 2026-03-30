"use client";

import { useState, useEffect, useRef } from 'react';
import { HelpCircle, Send, X, AlertCircle, MessageCircle, User, Bell } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { format } from 'date-fns';
import { io, Socket } from 'socket.io-client';

interface SupportButtonProps {
    quizId?: string;
}

interface ChatItem {
    id: string;
    message: string;
    isAdmin: boolean;
    createdAt: string;
    type: 'MESSAGE' | 'NOTIFICATION';
    title?: string;
}

export default function SupportButton({ quizId }: SupportButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [history, setHistory] = useState<ChatItem[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const { toast } = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);

    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const token = localStorage.getItem('token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            
            const res = await fetch(`${apiUrl}/support`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (err) {
            console.error('Failed to fetch support history', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchHistory();

            // Connect to Socket.IO for real-time replies
            const token = localStorage.getItem('token');
            if (token) {
                const socketUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '');
                const socket = io(socketUrl, {
                    auth: { token },
                    transports: ['websocket', 'polling'],
                });

                socket.on('support_reply', () => {
                    fetchHistory();
                });

                socketRef.current = socket;
            }
        } else {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [isOpen]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
            
            const res = await fetch(`${apiUrl}/support`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message, quizId }),
            });

            if (res.ok) {
                setMessage('');
                fetchHistory(); // Refresh history
            } else {
                const data = await res.json();
                toast(data.message || 'Failed to send support request', 'error');
            }
        } catch (err) {
            toast('An error occurred. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 p-4 bg-primary text-white rounded-full shadow-2xl hover:scale-110 transition-all duration-300 group"
                title="Report an issue / Support"
            >
                <HelpCircle size={28} />
                <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Report an issue / Support
                </span>
            </button>

            {/* Support Chat Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:justify-end p-4 sm:p-6 bg-black/20 backdrop-blur-sm">
                    <div className="w-full sm:w-[450px] h-[600px] max-h-[80vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 animate-in slide-in-from-bottom-4 duration-300 overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="bg-primary p-5 flex justify-between items-center text-white shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl">
                                    <MessageCircle size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg leading-none">Support Chat</h3>
                                    <p className="text-white/80 text-xs mt-1">We&apos;re here to help</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Chat Messages */}
                        <div 
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 dark:bg-slate-900/50"
                        >
                            {isLoadingHistory && history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-3 text-slate-400">
                                    <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full" />
                                    <p className="text-sm">Loading history...</p>
                                </div>
                            ) : history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 px-10">
                                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400">
                                        <MessageCircle size={40} />
                                    </div>
                                    <h4 className="font-bold text-slate-700 dark:text-slate-200">No messages yet</h4>
                                    <p className="text-sm text-slate-500">Send us a message below and we&apos;ll get back to you as soon as possible.</p>
                                </div>
                            ) : (
                                history.map((item) => (
                                    <div 
                                        key={item.id} 
                                        className={`flex ${item.isAdmin ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                                    >
                                        <div className={`max-w-[85%] flex flex-col ${item.isAdmin ? 'items-start' : 'items-end'}`}>
                                            <div className={`flex items-center gap-2 mb-1 px-1`}>
                                                {item.isAdmin ? (
                                                    <>
                                                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                            {item.type === 'NOTIFICATION' ? <Bell size={10} /> : <User size={10} />}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                            {item.type === 'NOTIFICATION' ? 'System' : 'Support Admin'}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">You</span>
                                                )}
                                            </div>
                                            
                                            <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                                                item.isAdmin 
                                                    ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700' 
                                                    : 'bg-primary text-white rounded-tr-none'
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

                        {/* Input Area */}
                        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                            <form onSubmit={handleSubmit} className="relative">
                                <textarea
                                    required
                                    rows={1}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit(e);
                                        }
                                    }}
                                    placeholder="Type your message..."
                                    className="w-full py-3 pl-4 pr-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none text-sm"
                                />
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !message.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all"
                                >
                                    {isSubmitting ? (
                                        <span className="animate-spin block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                                    ) : (
                                        <Send size={18} />
                                    )}
                                </button>
                            </form>
                            <p className="text-[10px] text-center text-slate-400 mt-2">
                                Press Enter to send, Shift + Enter for new line
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
