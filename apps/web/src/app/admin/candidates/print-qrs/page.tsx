"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { attendanceAPI, CandidateIdentity } from "@/lib/api/attendance";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function PrintQRsPage() {
  const [candidates, setCandidates] = useState<CandidateIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await attendanceAPI.getCandidateIdentities();
        setCandidates(data);
      } catch (error) {
        toast("Failed to load candidates", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 print:bg-white print:py-0 print:px-0">
      <div className="max-w-6xl mx-auto print:max-w-none">
        <header className="flex justify-between items-center mb-8 print:hidden">
          <div>
            <Link
              href="/admin/candidates"
              className="flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all mb-2"
            >
              <ArrowLeft size={18} /> Back to Candidates
            </Link>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              Print Candidate IDs
            </h1>
            <p className="text-slate-500">
              {candidates.length} candidates ready for printing (8 per page)
            </p>
          </div>
          <Button
            onClick={handlePrint}
            className="gap-2 bg-slate-900 hover:bg-slate-800 h-12 px-6"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9V4h12v5" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect width="12" height="8" x="6" y="14" />
            </svg>
            Print All
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-0 print:block">
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className={`
                bg-white border-2 border-slate-200 rounded-xl p-4 flex flex-col items-center text-center
                print:border-slate-300 print:rounded-none print:w-[105mm] print:h-[74.25mm] print:float-left print:box-sizing
                print:break-inside-avoid print:page-break-inside-avoid
              `}
            >
              <div className="w-32 h-32 mb-2 flex items-center justify-center print:w-40 print:h-40">
                <Image
                  src={candidate.qrCode}
                  alt={candidate.fullName}
                  width={128} // Set a default width
                  height={128} // Set a default height
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-lg font-bold text-slate-900 truncate w-full print:text-xl">
                {candidate.fullName}
              </h3>
              <p className="text-xs text-slate-500 truncate w-full print:text-sm">
                {candidate.church || "No Church"}
              </p>
              <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest print:text-xs">
                ID: {candidate.identityCode}
              </p>
            </div>
          ))}
          <div className="clear-both"></div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 0.5cm;
          }
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
          }
          /* Ensure exactly 8 cards per page */
          .print\\:break-inside-avoid {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
