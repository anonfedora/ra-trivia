"use client";

import { useToast, ToastType } from '../contexts/ToastContext';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

const ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />,
    error:   <AlertCircle  size={16} className="text-red-500 flex-shrink-0" />,
    warning: <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />,
    info:    <Info          size={16} className="text-blue-500 flex-shrink-0" />,
};

const STYLES: Record<ToastType, string> = {
    success: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30',
    error:   'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30',
    warning: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30',
    info:    'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30',
};

export default function Toaster() {
    const { toasts, dismiss } = useToast();
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;

    return createPortal(
        <div
            aria-live="polite"
            className="fixed bottom-4 right-4 z-[99999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
        >
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-lg pointer-events-auto animate-slide-up ${STYLES[t.type]}`}
                >
                    {ICONS[t.type]}
                    <p className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
                        {t.message}
                    </p>
                    <button
                        onClick={() => dismiss(t.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
                        aria-label="Dismiss"
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>,
        document.body
    );
}
