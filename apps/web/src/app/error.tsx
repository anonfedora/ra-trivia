"use client";

import Link from 'next/link';

export default function Error({ reset }: { reset: () => void }) {
    return (
        <main className="min-h-screen bg-slate-50 p-6 md:p-12 flex items-center justify-center">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-100">
                <h1 className="text-2xl font-extrabold text-slate-900">Something went wrong</h1>
                <p className="text-slate-500 mt-2 font-medium">An unexpected error occurred. You can try again or go back home.</p>
                <div className="flex gap-3 mt-8">
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all active:scale-95"
                    >
                        Try again
                    </button>
                    <Link
                        href="/"
                        className="flex-1 text-center bg-white border border-slate-200 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                    >
                        Home
                    </Link>
                </div>
            </div>
        </main>
    );
}
