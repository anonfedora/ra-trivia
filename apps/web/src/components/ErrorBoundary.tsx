"use client";

import { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, message: '' };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, message: error.message || 'Something went wrong.' };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
                    <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700 p-10 max-w-md w-full text-center">
                        <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle size={28} className="text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-2">Something went wrong</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{this.state.message}</p>
                        <button
                            onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload(); }}
                            className="px-6 py-3 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
