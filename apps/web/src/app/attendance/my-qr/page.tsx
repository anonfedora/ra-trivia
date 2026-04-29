'use client';

import { CandidateQRCode } from '@/components/attendance/CandidateQRCode';

export default function MyQRPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Attendance QR Code</h1>
          <p className="text-muted-foreground">
            Generate your QR code for exam attendance check-in. Show this QR code to the exam administrator to be marked as present.
          </p>
        </div>
        
        <CandidateQRCode />
      </div>
    </div>
  );
}
