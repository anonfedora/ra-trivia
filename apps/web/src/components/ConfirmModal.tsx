"use client";

import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning';
}

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'danger',
}: Props) {
    const confirmRef = useRef<HTMLButtonElement>(null);

    // Focus confirm button when opened; close on Escape
    useEffect(() => {
        if (!isOpen) return;
        confirmRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const confirmCls = variant === 'danger'
        ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200 dark:shadow-none'
        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200 dark:shadow-none';

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Panel */}
            <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-sm p-8 animate-slide-up">
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Close"
                >
                    <X size={18} />
                </button>

                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${
                    variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                }`}>
                    <AlertTriangle size={28} className={variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} />
                </div>

                <h2 id="confirm-modal-title" className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                    {title}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                    {message}
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-5 py-3 rounded-2xl font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmRef}
                        onClick={onConfirm}
                        className={`flex-1 px-5 py-3 rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${confirmCls}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
