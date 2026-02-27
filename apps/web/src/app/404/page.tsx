"use client";

import Link from 'next/link';
import { useEffect } from 'react';

export default function NotFound() {
    useEffect(() => {
        // Log access attempts to protected pages
        if (typeof window !== 'undefined') {
            console.warn('Access to protected page attempted:', window.location.pathname);
        }
    }, []);

    return (
        <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-200 rounded-full mb-6">
                    <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-4xl font-bold text-slate-900 mb-4">Page Not Found</h1>
                <p className="text-slate-500 mb-8">The page you&apos;re looking for doesn&apos;t exist or is not accessible.</p>
                <Link 
                    href="/"
                    className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-2xl font-medium hover:bg-primary/90 transition-colors"
                >
                    Go Home
                </Link>
            </div>
        </main>
    );
}
