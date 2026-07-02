'use client';

import { useState } from 'react';
import { CandidateRegistration } from '@/components/attendance/CandidateRegistration';
import AttendanceBulkImportModal from '@/components/AttendanceBulkImportModal';
import { ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';

export default function CandidateRegisterPage() {
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12">
      <div className="container mx-auto px-4">
        <header className="max-w-6xl mx-auto mb-8 flex justify-between items-center">
          <Link 
            href="/admin/candidates" 
            className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all w-fit"
          >
            <ArrowLeft size={18} /> Back to Candidates
          </Link>
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
          >
            <Users size={18} /> Bulk Import
          </button>
        </header>
        
        <CandidateRegistration />
      </div>

      <AttendanceBulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onSuccess={() => {
          setIsBulkImportOpen(false);
          // Refresh the page or trigger a refresh of the candidates list
          window.location.reload();
        }}
      />
    </div>
  );
}
