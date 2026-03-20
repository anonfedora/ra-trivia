"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBoundary from './ErrorBoundary';
import { useToast } from '../contexts/ToastContext';

// Public paths that should never trigger session-expiry redirect
const AUTH_PATHS = ['/login', '/register', '/verify-otp', '/forgot-password', '/reset-password'];

export default function ClientProviders({ children }: { children: any }) {
    const router = useRouter();
    const { toast } = useToast();
    const handledRef = useRef(false);

    useEffect(() => {
        const handleExpired = () => {
            // Don't fire on auth pages themselves
            if (AUTH_PATHS.some(p => window.location.pathname.startsWith(p))) return;
            // Debounce — only handle once per page load
            if (handledRef.current) return;
            handledRef.current = true;

            localStorage.removeItem('token');
            localStorage.removeItem('user');
            toast('Your session has expired. Please sign in again.', 'warning');
            setTimeout(() => router.push('/login'), 800);
        };

        // Listen for event fired by apiJson
        window.addEventListener('auth:expired', handleExpired);

        // Also patch window.fetch to catch raw fetch() 401s across all pages
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
            const res = await originalFetch(...args);
            if (res.status === 401) {
                // Clone so the caller can still read the body
                handleExpired();
                return res.clone();
            }
            return res;
        };

        return () => {
            window.removeEventListener('auth:expired', handleExpired);
            window.fetch = originalFetch;
        };
    }, [router, toast]);

    return <ErrorBoundary>{children}</ErrorBoundary>;
}
