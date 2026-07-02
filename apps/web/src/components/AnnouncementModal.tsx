"use client";

import { useState } from 'react';
import { X, Send, Megaphone, Target, CheckCircle } from 'lucide-react';
import { UserType } from './UserTypeSelector';
import { apiFetch } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

interface AnnouncementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AnnouncementModal({ isOpen, onClose }: AnnouncementModalProps) {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [targetType, setTargetType] = useState<UserType | 'ALL'>('ALL');
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();

    if (!isOpen) return null;

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) {
            toast('Please fill in both subject and message', 'warning');
            return;
        }

        setIsSending(true);
        try {
            const res = await apiFetch('admin/announcement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject,
                    message,
                    targetUserType: targetType === 'ALL' ? null : targetType
                })
            });

            if (res.ok) {
                const data = await res.json();
                toast(data.message || 'Announcement sent successfully', 'success');
                setSubject('');
                setMessage('');
                onClose();
            } else {
                const err = await res.json();
                toast(err.message || 'Failed to send announcement', 'error');
            }
        } catch (err) {
            toast('Failed to connect to server', 'error');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="bg-primary p-8 text-white flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                            <Megaphone size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Send Announcement</h2>
                            <p className="text-white/70 text-sm">Send a general message to candidates</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSend} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Target Audience</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {[
                                    { id: 'ALL', label: 'All Candidates' },
                                    { id: 'AMBASSADOR_RANK_EXAMS', label: 'Ambassadors' },
                                    { id: 'EXTRAORDINARY_RANK_EXAMS', label: 'Extraordinary' },
                                    { id: 'PRE_PLENIPOTENTIARY_RANK_EXAMS', label: 'Pre-Pleni' },
                                    { id: 'PLENIPOTENTIARY_RANK_EXAMS', label: 'Plenipotentiary' }
                                ].map((type) => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setTargetType(type.id as any)}
                                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center justify-center text-center leading-tight ${
                                            targetType === type.id
                                                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105'
                                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary/30'
                                        }`}
                                    >
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Subject</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="e.g. Important Update: Exam Schedule"
                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 dark:text-slate-100 font-bold"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Message Content</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Type your message here... Use professional and clear language."
                                rows={6}
                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 dark:text-slate-100 font-medium resize-none leading-relaxed"
                                required
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4 flex gap-3">
                        <CheckCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                            This message will be sent to the <strong>{targetType === 'ALL' ? 'entire candidate base' : targetType.replace(/_/g, ' ')}</strong> via both email and their in-app notification dashboard.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={isSending}
                        className="w-full bg-primary hover:bg-primary/90 text-white py-5 rounded-2xl font-bold shadow-lg shadow-primary/20 transform transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-3"
                    >
                        {isSending ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Sending Announcement...
                            </>
                        ) : (
                            <>
                                <Send size={20} />
                                Broadcast Announcement
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
