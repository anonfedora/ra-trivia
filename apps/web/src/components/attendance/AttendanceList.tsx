'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { attendanceAPI } from '@/lib/api/attendance';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash2, Download, ExternalLink, RefreshCw } from 'lucide-react';

export function AttendanceList() {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const googleSheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID;

  useEffect(() => {
    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    try {
      const response = await attendanceAPI.getManualAttendanceRecords();
      setAttendance(response.attendanceRecords);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to load attendance', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    
    try {
      await attendanceAPI.deleteManualAttendance(id);
      toast('Attendance record deleted successfully!', 'success');
      fetchAttendance();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to delete attendance', 'error');
    }
  };

  const downloadCSV = () => {
    if (attendance.length === 0) {
      toast('No records to download', 'warning');
      return;
    }

    const headers = ['Full Name', 'Church', 'Event Name', 'Notes', 'Check In Time', 'Checked In By'];
    const csvContent = [
      headers.join(','),
      ...attendance.map(record => [
        `"${record.fullName?.replace(/"/g, '""') || ''}"`,
        `"${record.church?.replace(/"/g, '""') || ''}"`,
        `"${record.eventName?.replace(/"/g, '""') || ''}"`,
        `"${record.notes?.replace(/"/g, '""') || ''}"`,
        new Date(record.checkInTime).toLocaleString(),
        `"${record.checkedInBy?.replace(/"/g, '""') || ''}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast('CSV downloaded successfully!', 'success');
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Attendance Records
          </h2>
        </div>
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Attendance Records
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={fetchAttendance} className="bg-primary hover:bg-primary/90 flex items-center gap-2">
            <RefreshCw size={16} />
            Refresh
          </Button>
          {googleSheetId && (
            <Link href={`https://docs.google.com/spreadsheets/d/${googleSheetId}`} target="_blank" rel="noopener noreferrer">
              <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2">
                <ExternalLink size={16} />
                Open Google Sheet
              </Button>
            </Link>
          )}
          <Button onClick={downloadCSV} className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2">
            <Download size={16} />
            Download CSV
          </Button>
        </div>
      </div>

      {attendance.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl">
          <p className="text-slate-500 dark:text-slate-400">No attendance records yet</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                    Full Name
                  </th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                    Church
                  </th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                    Event Name
                  </th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                    Check In Time
                  </th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                    Checked In By
                  </th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                    Notes
                  </th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                {attendance.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {record.fullName}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {record.church || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {record.eventName || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {new Date(record.checkInTime).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {record.checkedInBy || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {record.notes || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(record.id)}
                        className="text-sm p-2"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
