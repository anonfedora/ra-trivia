"use client";

import ErrorBoundary from './ErrorBoundary';

export default function ClientProviders({ children }: { children: any }) {
    return <ErrorBoundary>{children}</ErrorBoundary>;
}
