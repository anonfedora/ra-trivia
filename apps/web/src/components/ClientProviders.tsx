"use client";

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBoundary from './ErrorBoundary';
import { useToast } from '../contexts/ToastContext';
import { logout, isAuthenticated } from '../lib/auth';
import { getAccessToken } from '../lib/auth';

// Public paths that should never trigger session-expiry redirect
const AUTH_PATHS = ['/login', '/register', '/verify-otp', '/forgot-password', '/reset-password'];

export default function ClientProviders({ children }: { children: any }) {
    const router = useRouter();
    const { toast } = useToast();
    const handledRef = useRef(false);

    useEffect(() => {
        const handleExpired = async () => {
            // Don't fire on auth pages themselves
            if (AUTH_PATHS.some(p => window.location.pathname.startsWith(p))) return;
            // Debounce — only handle once per page load
            if (handledRef.current) return;
            handledRef.current = true;

            console.log('Final auth expiry reached, redirecting to login...');

            // Clear local storage and redirect
            await logout();
            toast('Your session has expired. Please sign in again.', 'warning');
            setTimeout(() => router.push('/login'), 800);
        };

        // Listen for event fired by centralized axios instance if refresh fails definitively
        window.addEventListener('auth:expired', handleExpired);

        return () => {
            window.removeEventListener('auth:expired', handleExpired);
        };
    }, [router, toast]);

    return <ErrorBoundary>{children}</ErrorBoundary>;
}
