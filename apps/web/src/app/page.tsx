"use client";

import Link from 'next/link';
import { ThemeToggle } from '../components/ThemeToggle';

export default function LandingPage() {
    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center transition-colors duration-200">
            <div className="absolute top-0 right-0 p-8 flex items-center gap-6">
                <ThemeToggle />
                <Link href="/login" className="text-slate-600 dark:text-slate-400 hover:text-primary transition-colors font-medium">
                    Login
                </Link>
            </div>

            <div className="max-w-3xl w-full">
                <div className="mb-10 animate-fade-in">
                    <img
                        src="/favicon.png"
                        alt="RA Logo"
                        className="w-20 h-20 mx-auto mb-6 rounded-xl shadow-lg"
                    />
                    <h1 className="text-6xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight mb-6">
                        Unlock Your <span className="text-primary italic">Potential</span>
                    </h1>
                    <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
                        The ultimate quiz platform for candidates. Challenge yourself, track your progress, and excel in your exams.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
                    <Link href="/login" className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full font-bold shadow-lg transform transition-all hover:scale-105 active:scale-95">
                        Get Started
                    </Link>
                    <button className="border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 px-8 py-4 rounded-full font-bold text-slate-600 dark:text-slate-400 transition-all">
                        Learn More
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
                    {[
                        { title: "Real-time Timers", desc: "Keep track of your time per question with our precision timer system." },
                        { title: "Progress Saving", desc: "Never lose your answers. We auto-save everything as you go." },
                        { title: "Instant Feedback", desc: "Get your results immediately after submission with detailed breakdown." }
                    ].map((feature, i) => (
                        <div key={i} className="p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
                            <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-slate-100">{feature.title}</h3>
                            <p className="text-slate-500 dark:text-slate-400">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
