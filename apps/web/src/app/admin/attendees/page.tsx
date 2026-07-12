"use client";

import { useState, useEffect, useCallback } from 'react';
import { Search, ArrowLeft, Trash2, CheckCircle, XCircle, Filter, MoreVertical, Calendar, Clock, User, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '../../../components/ThemeToggle';
import NotificationBell from '../../../components/NotificationBell';
import { useToast } from '../../../contexts/ToastContext';
import { attendanceAPI, Attendee } from '../../../lib/api/attendance';

const CHURCHES = [
  "Aniya Baptist Church",
  "Alheri Baptist Church",
  "First Baptist Church",
  "Gaskiya Baptist Church",
  "Glory Baptist Church",
  "Nagarta Baptist Church",
  "Praise Baptist Church",
  "United English Baptist Church",
  "Wisdom Baptist Church",
  "Zion Baptist Church",
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'MARKED', label: 'Marked' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export default function AttendeesPage() {
  const router = useRouter();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [churchFilter, setChurchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedAttendees, setSelectedAttendees] = useState<Set<string>>(new Set());
  const [selectedAttendeeForView, setSelectedAttendeeForView] = useState<Attendee | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any>(null);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const pageSize = 25;
  const { toast } = useToast();

  const fetchAttendees = useCallback(async (overridePage?: number) => {
    const effectivePage = overridePage ?? page;
    try {
      const data = await attendanceAPI.getAttendees({
        page: effectivePage,
        pageSize,
        ...(searchTerm.trim() && { search: searchTerm.trim() }),
        ...(statusFilter && { status: statusFilter }),
        ...(churchFilter && { church: churchFilter }),
      });
      setAttendees(data.items);
      setTotal(data.total);
    } catch {
      toast('Failed to load attendees', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, searchTerm, statusFilter, churchFilter, toast]);

  useEffect(() => { fetchAttendees(); }, [fetchAttendees]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchAttendees(1); }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, statusFilter, churchFilter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attendee?')) return;
    
    try {
      await attendanceAPI.deleteAttendee(id);
      toast('Attendee deleted successfully', 'success');
      fetchAttendees();
    } catch {
      toast('Failed to delete attendee', 'error');
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await attendanceAPI.updateAttendeeStatus(id, status);
      toast('Attendee status updated successfully', 'success');
      fetchAttendees();
    } catch {
      toast('Failed to update attendee status', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAttendees.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedAttendees.size} attendees?`)) return;
    
    try {
      await Promise.all(Array.from(selectedAttendees).map(id => attendanceAPI.deleteAttendee(id)));
      toast(`${selectedAttendees.size} attendees deleted successfully`, 'success');
      setSelectedAttendees(new Set());
      fetchAttendees();
    } catch {
      toast('Failed to delete some attendees', 'error');
    }
  };

  const handleBulkMark = async (status: string) => {
    if (selectedAttendees.size === 0) return;
    
    try {
      await Promise.all(Array.from(selectedAttendees).map(id => attendanceAPI.updateAttendeeStatus(id, status)));
      toast(`${selectedAttendees.size} attendees marked successfully`, 'success');
      setSelectedAttendees(new Set());
      fetchAttendees();
    } catch {
      toast('Failed to mark some attendees', 'error');
    }
  };

  const handleViewAttendance = async (attendee: Attendee) => {
    setSelectedAttendeeForView(attendee);
    setIsLoadingAttendance(true);
    try {
      const data = await attendanceAPI.getAttendeeAttendance(attendee.id);
      setAttendanceHistory(data);
    } catch {
      toast('Failed to load attendance history', 'error');
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedAttendees.size === attendees.length) {
      setSelectedAttendees(new Set());
    } else {
      setSelectedAttendees(new Set(attendees.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedAttendees);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedAttendees(newSet);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      MARKED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      INACTIVE: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${styles[status as keyof typeof styles] || styles.INACTIVE}`}>
        {status}
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <Link href="/admin/dashboard" className="flex items-center gap-2 text-primary font-bold mb-4 hover:gap-3 transition-all">
              <ArrowLeft size={18} /> Back to Dashboard
            </Link>
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">Attendance Management</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Manage all attendance candidates and their status.</p>
          </div>
          <div className="flex gap-3 items-center">
            {selectedAttendees.size > 0 && (
              <>
                <button
                  onClick={() => handleBulkMark('MARKED')}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all"
                >
                  <CheckCircle size={16} /> Mark ({selectedAttendees.size})
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all"
                >
                  <Trash2 size={16} /> Delete ({selectedAttendees.size})
                </button>
              </>
            )}
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all text-slate-600 dark:text-slate-300"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all text-slate-600 dark:text-slate-300"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={churchFilter}
            onChange={(e) => setChurchFilter(e.target.value)}
            className="px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all text-slate-600 dark:text-slate-300"
          >
            <option value="">All Churches</option>
            {CHURCHES.map(church => (
              <option key={church} value={church}>{church}</option>
            ))}
          </select>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedAttendees.size === attendees.length && attendees.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Church</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Identity Code</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Registered By</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">Loading...</td>
                  </tr>
                ) : attendees.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">No attendees found</td>
                  </tr>
                ) : (
                  attendees.map((attendee) => (
                    <tr key={attendee.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedAttendees.has(attendee.id)}
                          onChange={() => toggleSelect(attendee.id)}
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{attendee.fullName}</div>
                        {attendee.notes && (
                          <div className="text-xs text-slate-500 mt-1">{attendee.notes}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{attendee.email || '-'}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{attendee.church || '-'}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{attendee.phoneNumber || '-'}</td>
                      <td className="px-6 py-4">
                        <code className="px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded text-xs font-mono">{attendee.identityCode}</code>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(attendee.status)}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{attendee.registeredBy.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewAttendance(attendee)}
                            className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-blue-600 dark:text-blue-400"
                            title="View Attendance"
                          >
                            <Calendar size={16} />
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(attendee.id, attendee.status === 'ACTIVE' ? 'MARKED' : 'ACTIVE')}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
                            title={attendee.status === 'ACTIVE' ? 'Mark' : 'Unmark'}
                          >
                            {attendee.status === 'ACTIVE' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                          </button>
                          <button
                            onClick={() => handleDelete(attendee.id)}
                            className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition-colors text-rose-600 dark:text-rose-400"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} attendees
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Attendance History Modal */}
        {selectedAttendeeForView && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Attendance History</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">{selectedAttendeeForView.fullName}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedAttendeeForView(null);
                    setAttendanceHistory(null);
                  }}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {isLoadingAttendance ? (
                  <div className="text-center py-12 text-slate-500">Loading attendance history...</div>
                ) : attendanceHistory ? (
                  <>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Events</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{attendanceHistory.totalAttendance}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Church</div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedAttendeeForView.church || 'N/A'}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Status</div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedAttendeeForView.status}</div>
                      </div>
                    </div>

                    {attendanceHistory.attendanceRecords.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">No attendance records found</div>
                    ) : (
                      <div className="space-y-3">
                        {attendanceHistory.attendanceRecords.map((record: any) => (
                          <div key={record.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="font-bold text-slate-900 dark:text-slate-100">
                                  {record.quiz ? record.quiz.title : record.eventName || 'Unknown Event'}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-4">
                                  <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {new Date(record.checkedInAt).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock size={14} />
                                    {new Date(record.checkedInAt).toLocaleTimeString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <User size={14} />
                                    {record.checkedInBy.name}
                                  </span>
                                </div>
                              </div>
                              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold">
                                {record.method}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
