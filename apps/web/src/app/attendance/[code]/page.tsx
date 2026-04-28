'use client';

import { useState, useEffect } from 'react';
import { AttendanceVerification } from '@/components/attendance/AttendanceVerification';

export default function AttendancePage({ params }: { params: Promise<{ code: string }> }) {
  const [code, setCode] = useState<string>('');
  
  useEffect(() => {
    params.then(p => setCode(p.code));
  }, [params]);

  if (!code) {
    return <div className="container mx-auto py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <AttendanceVerification attendanceCode={code} />
    </div>
  );
}
