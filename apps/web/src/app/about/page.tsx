"use client";

import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Shield, Zap, BarChart3, Users, Mail } from 'lucide-react';
import { ThemeToggle } from '../../components/ThemeToggle';

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="p-2 bg-primary rounded-lg group-hover:scale-110 transition-transform">
                            <ArrowLeft className="text-white" size={20} />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">Back to Home</span>
                    </Link>
                    <ThemeToggle />
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-40 pb-20 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white mb-8 tracking-tight">
                        About <span className="text-primary">RA Trivia</span>
                    </h1>
                    <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-12">
                        RA Trivia is a professional candidate assessment platform designed to streamline the examination process for organizations and provide a seamless experience for candidates.
                    </p>
                </div>
            </section>

            {/* Core Pillars */}
            <section className="py-20 bg-white dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Shield size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Integrity First</h3>
                            <p className="text-slate-600 dark:text-slate-400">
                                Advanced anti-cheat measures including tab-switching detection and copy-paste prevention ensure fair examinations for everyone.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <Zap size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Real-time Performance</h3>
                            <p className="text-slate-600 dark:text-slate-400">
                                Experience zero-latency answering with automatic progress saving. Your data is secure and always synced.
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <BarChart3 size={24} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Detailed Insights</h3>
                            <p className="text-slate-600 dark:text-slate-400">
                                Comprehensive analytics for admins and detailed result breakdowns for candidates once results are released.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section className="py-24 px-6 bg-white dark:bg-slate-800/50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">How it Works</h2>
                        <p className="text-slate-500 dark:text-slate-400">Four simple steps to get started with your assessment journey.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {[
                            { step: "01", title: "Registration", desc: "Create your account and verify your email via a 6-digit secure OTP." },
                            { step: "02", title: "Assignment", desc: "Admins assign relevant exams based on your rank or user category." },
                            { step: "03", title: "Examination", desc: "Complete your assessment within the allocated time in a secure environment." },
                            { step: "04", title: "Certification", desc: "Receive detailed results and verified certificates once results are released." }
                        ].map((item, i) => (
                            <div key={i} className="relative p-8 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 group hover:border-primary transition-all">
                                <div className="text-5xl font-black text-primary/10 group-hover:text-primary/20 transition-colors mb-4">{item.step}</div>
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{item.title}</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                                {i < 3 && <ArrowRight className="hidden md:block absolute -right-6 top-1/2 -translate-y-1/2 text-slate-200 dark:text-slate-700" size={24} />}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Detail */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                        <div>
                            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-8">Empowering Administrators</h2>
                            <ul className="space-y-6">
                                {[
                                    { title: "Bulk Candidate Import", desc: "Register hundreds of candidates in seconds using our Excel import tool." },
                                    { title: "Advanced Analytics", desc: "Monitor pass/fail ratios, average scores, and performance extremes in real-time." },
                                    { title: "Automated Result Release", desc: "Schedule when candidates can see their results, with automated email notifications." },
                                    { title: "Support Center", desc: "Integrated real-time chat to provide instant assistance to exam takers." }
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-4">
                                        <div className="mt-1 shrink-0">
                                            <CheckCircle2 className="text-primary" size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">{item.title}</h4>
                                            <p className="text-slate-600 dark:text-slate-400">{item.desc}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-slate-200 dark:bg-slate-800 rounded-[3rem] p-12 aspect-square flex items-center justify-center">
                            <div className="text-center">
                                <Users size={120} className="text-primary/20 mx-auto mb-6" />
                                <p className="text-2xl font-bold text-slate-400">Admin Dashboard Preview</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Candidate Experience */}
            <section className="py-20 px-6 bg-primary/5 dark:bg-primary/10">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                        <div className="order-2 lg:order-1 bg-white dark:bg-slate-900 rounded-[3rem] p-12 aspect-square flex items-center justify-center shadow-xl">
                            <div className="text-center">
                                <Zap size={120} className="text-primary/20 mx-auto mb-6" />
                                <p className="text-2xl font-bold text-slate-400">Quiz Interface Preview</p>
                            </div>
                        </div>
                        <div className="order-1 lg:order-2">
                            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-8">Seamless Candidate Journey</h2>
                            <ul className="space-y-6">
                                {[
                                    { title: "Simple Registration", desc: "Quick sign-up with email verification via 6-digit OTP." },
                                    { title: "Tailored Exams", desc: "Only see exams specifically assigned to your rank or category." },
                                    { title: "Intuitive Interface", desc: "Clean, distraction-free environment with clear timers and navigation." },
                                    { title: "Result Notifications", desc: "Receive immediate notifications and emails when your results are ready." }
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-4">
                                        <div className="mt-1 shrink-0">
                                            <CheckCircle2 className="text-primary" size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">{item.title}</h4>
                                            <p className="text-slate-600 dark:text-slate-400">{item.desc}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Call to Action */}
            <section className="py-32 px-6 text-center">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-8">Ready to Get Started?</h2>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/register" className="bg-primary hover:bg-primary/90 text-white px-10 py-5 rounded-2xl font-bold shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1">
                            Create Account
                        </Link>
                        <Link href="/login" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-10 py-5 rounded-2xl font-bold shadow-lg border border-slate-100 dark:border-slate-700 transition-all transform hover:-translate-y-1">
                            Login
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-slate-200 dark:border-slate-800 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        © {new Date().getFullYear()} RA Trivia. All rights reserved.
                    </p>
                    <div className="flex gap-8">
                        <Link href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">Privacy Policy</Link>
                        <Link href="#" className="text-slate-400 hover:text-primary transition-colors text-sm">Terms of Service</Link>
                        <Link href="#" className="text-slate-400 hover:text-primary transition-colors text-sm flex items-center gap-2">
                            <Mail size={16} /> Contact Support
                        </Link>
                    </div>
                </div>
            </footer>
        </main>
    );
}
