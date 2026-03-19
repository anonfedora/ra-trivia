"use client";

import ErrorBoundary from './ErrorBoundary';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
    return <ErrorBoundary>{children}</ErrorBoundary>;
}
