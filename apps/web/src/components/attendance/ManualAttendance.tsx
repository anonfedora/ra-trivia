'use client';

import { useState } from 'react';
import Link from 'next/link';
import { attendanceAPI, ManualAttendanceRequest } from '@/lib/api/attendance';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

const CHURCHES = [
  'Aniya Baptist Church',
  'Alheri Baptist Church',
  'First Baptist Church',
  'Gaskiya Baptist Church',
  'Glory Baptist Church',
  'Nagarta Baptist Church',
  'Praise Baptist Church',
  'United English Baptist Church',
  'Wisdom Baptist Church',
  'Zion Baptist Church',
];

export function ManualAttendance() {
  const [formData, setFormData] = useState<ManualAttendanceRequest>({
    fullName: '',
    church: '',
    eventName: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await attendanceAPI.createManualAttendance(formData);
      toast('Attendance recorded successfully!', 'success');
      setFormData({
        fullName: '',
        church: '',
        eventName: '',
        notes: '',
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to record attendance', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Manual Attendance Entry
        </h2>
        <Link href="/attendance/list">
          <Button className="bg-blue-600 hover:bg-blue-700 text-sm">
            View Records
          </Button>
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="fullName" className="text-sm font-medium">
            Full Name *
          </Label>
          <Input
            id="fullName"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="Enter full name"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="church" className="text-sm font-medium">
            Church
          </Label>
          <Select
            id="church"
            value={formData.church}
            onChange={(e) => setFormData({ ...formData, church: e.target.value })}
            className="mt-1"
          >
            <option value="">Select a church</option>
            {CHURCHES.map((church) => (
              <option key={church} value={church}>
                {church}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="eventName" className="text-sm font-medium">
            Event Name
          </Label>
          <Input
            id="eventName"
            value={formData.eventName}
            onChange={(e) => setFormData({ ...formData, eventName: e.target.value })}
            placeholder="Enter event name"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="notes" className="text-sm font-medium">
            Notes
          </Label>
          <Input
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes (optional)"
            className="mt-1"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full mt-6 bg-primary hover:bg-primary/90"
        >
          {isSubmitting ? 'Recording...' : 'Record Attendance'}
        </Button>
      </form>
    </div>
  );
}
