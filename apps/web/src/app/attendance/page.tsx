'use client';

import Link from 'next/link';
import { AttendanceVerification } from '@/components/attendance/AttendanceVerification';
import { Button } from '@/components/ui/button';

export default function AttendanceGeneralPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-center gap-4 mb-8">
        <Link href="/attendance/manual">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            Manual Attendance Entry
          </Button>
        </Link>
        <Link href="/attendance/list">
          <Button className="bg-blue-600 hover:bg-blue-700">
            View Attendance Records
          </Button>
        </Link>
      </div>
      <AttendanceVerification />
    </div>
  );
}
