"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Calendar, Award, GraduationCap, Trophy, ShieldCheck, MapPin, Users } from 'lucide-react';
import Image from 'next/image';
import { useMemo } from 'react';

interface VerificationData {
    candidateName: string;
    examTitle: string;
    score: number;
    completedAt: string;
    status: string;
    church: string | null;
    association: string | null;
    userType: string;
}

export default function VerificationPage() {
    const params = useParams();
    const id = params?.id as string;
    const [data, setData] = useState<VerificationData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const formatUserType = (type: string) => {
        return type
            .replace(/_/g, ' ')
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    useEffect(() => {
        const verifyResult = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
                const res = await fetch(`${apiUrl}/quiz/verify/${id}`);
                
                if (res.ok) {
                    const result = await res.json();
                    setData(result);
                } else {
                    setError('This result could not be verified. Please check the link or QR code.');
                }
            } catch (err) {
                setError('A connection error occurred. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        if (id) verifyResult();
    }, [id]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-xl border border-rose-100">
                    <AlertCircle size={64} className="text-rose-500 mx-auto mb-6" />
                    <h1 className="text-2xl font-bold text-slate-900 mb-4">Verification Failed</h1>
                    <p className="text-slate-500 mb-8 font-medium leading-relaxed">{error}</p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95"
                    >
                        Try Again
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors duration-200">
            <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-scale-in">
                {/* Header Decoration */}
                <div className="h-4 bg-gradient-to-r from-primary via-emerald-500 to-primary" />
                
                <div className="p-10 md:p-16 text-center">
                    <div className="flex justify-center mb-8">
                        <div className="relative">
                            <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center">
                                <ShieldCheck size={56} />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-900 p-1.5 rounded-full shadow-lg">
                                <div className="bg-emerald-500 text-white p-1 rounded-full">
                                    <CheckCircle2 size={16} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 mb-12">
                        <h1 className="text-slate-400 dark:text-slate-500 text-xs font-black uppercase tracking-[0.3em]">Official Examination Record</h1>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50">Verified Result</h2>
                    </div>

                    <div className="space-y-10">
                        {/* Candidate Section */}
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Candidate Name</span>
                            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{data.candidateName}</p>
                            {data.church && (
                                <div className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                                    <MapPin size={14} className="text-primary" />
                                    {data.church}
                                </div>
                            )}
                        </div>

                        {/* Exam Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-10 border-y border-slate-50 dark:border-slate-800">
                            <div className="text-center md:text-left space-y-4">
                                <div className="flex items-center gap-3 justify-center md:justify-start">
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-primary">
                                        <GraduationCap size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Examination</p>
                                        <p className="text-base font-bold text-slate-800 dark:text-slate-200">{data.examTitle}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 justify-center md:justify-start">
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-primary">
                                        <Calendar size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Completion Date</p>
                                        <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                                            {new Date(data.completedAt).toLocaleDateString(undefined, { 
                                                year: 'numeric', 
                                                month: 'long', 
                                                day: 'numeric' 
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="text-center md:text-left space-y-4">
                                <div className="flex items-center gap-3 justify-center md:justify-start">
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-emerald-500">
                                        <Trophy size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Exam Type</p>
                                        <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                                            {formatUserType(data.userType)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 justify-center md:justify-start">
                                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-amber-500">
                                        <Users size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Association</p>
                                        <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                                            {data.association || 'Not Specified'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center">
                            <div className="relative inline-block">
                                <svg className="w-32 h-32 transform -rotate-90">
                                    <circle
                                        cx="64"
                                        cy="64"
                                        r="56"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        className="text-slate-100 dark:text-slate-800"
                                    />
                                    <circle
                                        cx="64"
                                        cy="64"
                                        r="56"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        strokeDasharray={351.8}
                                        strokeDashoffset={351.8 - (351.8 * data.score) / 100}
                                        className="text-emerald-500 transition-all duration-1000"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{data.score.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className={`mt-3 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
                                data.status === 'Cleared' 
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
                                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                            }`}>
                                {data.status}
                            </div>
                        </div>

                        {/* Verification Identity */}
                        <div className="space-y-6 pt-4">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">Verification ID</span>
                                <code className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950 rounded-2xl text-[10px] text-slate-400 dark:text-slate-500 font-mono shadow-inner border border-slate-100 dark:border-slate-800">
                                    {id}
                                </code>
                            </div>
                            
                            <p className="text-xs text-slate-400 dark:text-slate-600 italic">
                                This examination record is authentic and was generated by the RA Trivia automated examination system.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-50 dark:border-slate-900 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all cursor-pointer">
                        <Image
                            src="/favicon.png"
                            alt="RA Logo"
                            width={24}
                            height={24}
                            className="w-6 h-6 rounded"
                        />
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">RA TRIVIA</span>
                    </div>
                </div>
            </div>
        </main>
    );
}
