'use client';

import { ManualAttendance } from '@/components/attendance/ManualAttendance';

export default function ManualAttendancePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12">
      <div className="container mx-auto px-4">
        <ManualAttendance />
      </div>
    </div>
  );
}
