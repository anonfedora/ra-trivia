'use client';

import { AttendanceList } from '@/components/attendance/AttendanceList';

export default function AttendanceListPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12">
      <div className="container mx-auto px-4">
        <AttendanceList />
      </div>
    </div>
  );
}
