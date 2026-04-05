"use client";

import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '../components/ThemeToggle';
import { Shield, Users, BarChart3, MessageSquare, Zap, MonitorSmartphone, ArrowRight } from 'lucide-react';

export default function LandingPage() {
    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center p-6 transition-colors duration-200 overflow-x-hidden">
            <div className="absolute top-0 right-0 p-8 flex items-center gap-6 z-50">
                <ThemeToggle />
                <Link href="/login" className="text-slate-600 dark:text-slate-400 hover:text-primary transition-colors font-bold text-sm tracking-wide uppercase">
                    Login
                </Link>
            </div>

            {/* Hero Section */}
            <div className="max-w-6xl w-full pt-24 pb-16 md:pt-40 md:pb-32 text-center">
                <div className="mb-12 animate-fade-in px-4">
                    <Image
                        src="/favicon.png"
                        alt="RA Logo"
                        width={100}
                        height={100}
                        className="w-24 h-24 mx-auto mb-8 rounded-2xl shadow-xl transform hover:rotate-6 transition-transform"
                    />
                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-slate-50 tracking-tight mb-8 leading-[1.1]">
                        The <span className="text-primary italic">Professional</span> <br className="hidden md:block" />
                        Quiz Assessment Platform
                    </h1>
                    <p className="text-lg md:text-2xl text-slate-600 dark:text-slate-400 mb-12 leading-relaxed max-w-3xl mx-auto font-medium">
                        A high-integrity platform built for organizations to administer secure, <br className="hidden md:block" /> 
                        fair, and insight-driven examinations to candidates globally.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-5 justify-center">
                        <Link href="/register" className="bg-primary hover:bg-primary/90 text-white px-10 py-5 rounded-[2rem] font-bold shadow-xl shadow-primary/20 transform transition-all hover:scale-105 active:scale-95 text-lg">
                            Get Started
                        </Link>
                        <Link href="/about" className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 px-10 py-5 rounded-[2rem] font-bold text-slate-600 dark:text-slate-400 transition-all flex items-center justify-center text-lg gap-2 shadow-sm">
                            Learn More <ArrowRight size={20} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Platform Highlights */}
            <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-32 px-4">
                {[
                    { 
                        title: "Anti-Cheat Integrity", 
                        desc: "Advanced proctoring with tab-switch detection, copy-paste blocking, and automated submission on violations.",
                        icon: <Shield className="text-blue-500" size={32} />,
                        bg: "bg-blue-500/10"
                    },
                    { 
                        title: "Bulk Candidate Import", 
                        desc: "Register hundreds of candidates instantly via Excel with automated onboarding emails and 24h verification.",
                        icon: <Users className="text-primary" size={32} />,
                        bg: "bg-primary/10"
                    },
                    { 
                        title: "Deep Analytics", 
                        desc: "Real-time insights into pass/fail ratios, average scores, and performance extremes with dynamic reporting.",
                        icon: <BarChart3 className="text-emerald-500" size={32} />,
                        bg: "bg-emerald-500/10"
                    },
                    { 
                        title: "Real-time Support", 
                        desc: "Integrated chat system allowing admins to provide instant, synchronized assistance to active exam takers.",
                        icon: <MessageSquare className="text-amber-500" size={32} />,
                        bg: "bg-amber-500/10"
                    },
                    { 
                        title: "Precision Timers", 
                        desc: "Zero-latency countdown timers per exam with cloud-synced progress saving to ensure zero data loss.",
                        icon: <Zap className="text-rose-500" size={32} />,
                        bg: "bg-rose-500/10"
                    },
                    { 
                        title: "Mobile Optimized", 
                        desc: "A responsive experience designed for smartphones and tablets, ensuring candidates can excel on any device.",
                        icon: <MonitorSmartphone className="text-indigo-500" size={32} />,
                        bg: "bg-indigo-500/10"
                    }
                ].map((feature, i) => (
                    <div key={i} className="group p-10 bg-white dark:bg-slate-800 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 transform hover:-translate-y-2">
                        <div className={`w-16 h-16 rounded-[1.5rem] ${feature.bg} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                            {feature.icon}
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-100">{feature.title}</h3>
                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{feature.desc}</p>
                    </div>
                ))}
            </div>

            {/* Role Specific Section */}
            <div className="max-w-6xl w-full mb-32 px-4">
                <div className="bg-slate-900 dark:bg-primary/5 rounded-[4rem] p-12 md:p-20 overflow-hidden relative border border-slate-800 dark:border-primary/10">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 blur-[120px] rounded-full -mr-48 -mt-48" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full -ml-32 -mb-32" />
                    
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-16">
                        <div>
                            <span className="text-primary font-bold tracking-[0.2em] uppercase text-xs mb-4 block">For Candidates</span>
                            <h2 className="text-4xl font-bold text-white mb-6">Experience Seamless Assessments</h2>
                            <p className="text-slate-400 mb-8 leading-relaxed">
                                Register once and gain access to all examinations tailored to your rank or category. 
                                Our intuitive interface lets you focus purely on your answers while we handle the rest.
                            </p>
                            <Link href="/register" className="text-primary font-bold flex items-center gap-2 group hover:gap-4 transition-all">
                                Join as Candidate <ArrowRight size={20} />
                            </Link>
                        </div>
                        <div className="pt-10 md:pt-0 border-t md:border-t-0 md:border-l border-slate-800 md:pl-16">
                            <span className="text-primary font-bold tracking-[0.2em] uppercase text-xs mb-4 block">For Administrators</span>
                            <h2 className="text-4xl font-bold text-white mb-6">Command Your Assessment Data</h2>
                            <p className="text-slate-400 mb-8 leading-relaxed">
                                Manage thousands of candidates with ease. From bulk importing to automated result releases 
                                and real-time support threads, RA Trivia is your complete command center.
                            </p>
                            <Link href="/login" className="text-primary font-bold flex items-center gap-2 group hover:gap-4 transition-all">
                                Explore Admin Tools <ArrowRight size={20} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="w-full max-w-7xl py-12 border-t border-slate-200 dark:border-slate-800 px-4 flex flex-col md:flex-row justify-between items-center gap-6">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                    © {new Date().getFullYear()} RA Trivia. Professional Candidate Assessment.
                </p>
                <div className="flex gap-8">
                    <Link href="/about" className="text-slate-400 hover:text-primary transition-colors text-sm font-bold uppercase tracking-wider">About</Link>
                    <Link href="/login" className="text-slate-400 hover:text-primary transition-colors text-sm font-bold uppercase tracking-wider">Support</Link>
                    <Link href="/register" className="text-slate-400 hover:text-primary transition-colors text-sm font-bold uppercase tracking-wider">Join</Link>
                </div>
            </footer>
        </main>
    );
}
