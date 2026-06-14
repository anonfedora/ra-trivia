'use client';

import { CandidateRegistration } from '@/components/attendance/CandidateRegistration';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CandidateRegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12">
      <div className="container mx-auto px-4">
        <header className="max-w-6xl mx-auto mb-8">
          <Link 
            href="/admin/candidates" 
            className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all w-fit"
          >
            <ArrowLeft size={18} /> Back to Candidates
          </Link>
        </header>
        
        <CandidateRegistration />
      </div>
    </div>
  );
}
