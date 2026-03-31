"use client";

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Clock, PlayCircle, Plus, Upload, Trash2, Power, PowerOff, FileDown, MoreVertical, CheckCircle, BarChart3, Users, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '../../../components/ThemeToggle';
import NotificationBell from '../../../components/NotificationBell';
import UserTypeSelector, { UserType } from '../../../components/UserTypeSelector';
import { useToast } from '../../../contexts/ToastContext';
import ConfirmModal from '../../../components/ConfirmModal';
import { io, Socket } from 'socket.io-client';

interface Quiz {
    id: string;
    title: string;
    duration: number;
    isActive: boolean;
    retakeLimit?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    _count: {
        questions: number;
    };
    createdBy?: {
        id: string;
        name: string;
        email: string;
    } | null;
}

interface Attempt {
    id: string;
    startTime: string;
    endTime: string | null;
    score: number | null;
    user: {
        name: string;
        email: string;
    };
    quiz: {
        title: string;
    };
}

interface PagedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

export default function AdminDashboard() {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [recentAttempts, setRecentAttempts] = useState<Attempt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [selectedQuizId, setSelectedQuizId] = useState<string>('');
    const [user, setUser] = useState<any>(null);
    const [questionType, setQuestionType] = useState<UserType | null>(null);
    const [questionTypeError, setQuestionTypeError] = useState<string>('');
    const [supportUnreadCount, setSupportUnreadCount] = useState(0);
    const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
    const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);
    const { toast } = useToast();

    // Edit Selected Quiz
    const [editTitle, setEditTitle] = useState('');
    const [editDuration, setEditDuration] = useState('');
    const [editRetakeLimit, setEditRetakeLimit] = useState('2');
    const [editStartDate, setEditStartDate] = useState('');
    const [editEndDate, setEditEndDate] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Create Quiz Form
    const [newTitle, setNewTitle] = useState('');
    const [newDuration, setNewDuration] = useState('30');
    const [isCreating, setIsCreating] = useState(false);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    const fetchSupportUnreadCount = useCallback(async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/support/admin/unread-count`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSupportUnreadCount(data.unreadCount);
            }
        } catch (err) {
            console.error('Failed to fetch support unread count', err);
        }
    }, [apiUrl]);

    const fetchMaintenanceStatus = useCallback(async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/quiz/maintenance/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setIsMaintenanceMode(data.isMaintenanceMode);
            }
        } catch (err) {
            console.error('Failed to fetch maintenance status', err);
        }
    }, [apiUrl]);

    const handleToggleMaintenance = async () => {
        const token = localStorage.getItem('token');
        const nextState = !isMaintenanceMode;
        
        setIsTogglingMaintenance(true);
        try {
            const res = await fetch(`${apiUrl}/quiz/maintenance/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ enabled: nextState })
            });

            if (res.ok) {
                const data = await res.json();
                setIsMaintenanceMode(data.isMaintenanceMode);
                toast(`Maintenance mode ${data.isMaintenanceMode ? 'enabled' : 'disabled'}`, 'success');
            } else {
                toast('Failed to toggle maintenance mode', 'error');
            }
        } catch (err) {
            toast('An error occurred while toggling maintenance mode', 'error');
        } finally {
            setIsTogglingMaintenance(false);
        }
    };

    const fetchData = useCallback(async () => {
        const token = localStorage.getItem('token');
        const userRaw = localStorage.getItem('user');
        const currentUser = userRaw ? JSON.parse(userRaw) : null;
        
        try {
            // Fetch Quizzes — cache-bust to always get fresh data
            const quizRes = await fetch(`${apiUrl}/quizzes?t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Cache-Control': 'no-cache' }
            });
            if (quizRes.ok) {
                const data = await quizRes.json();
                // Filter quizzes based on user role
                const filteredQuizzes = currentUser?.role === 'SUPER_ADMIN' 
                    ? data 
                    : data.filter((q: Quiz) => q.createdBy?.id === currentUser?.id);
                setQuizzes(filteredQuizzes);
                // Only auto-select if nothing is selected yet
                setSelectedQuizId(prev => (prev || (filteredQuizzes.length > 0 ? filteredQuizzes[0].id : '')));
            }

            // Fetch Recent Results
            const resultRes = await fetch(`${apiUrl}/admin/results`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resultRes.ok) {
                const data: PagedResponse<Attempt> = await resultRes.json();
                setRecentAttempts(data.items.slice(0, 5));
            }
        } catch (err) {
            console.error('Failed to fetch data', err);
            toast('Failed to load dashboard data. Please refresh.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl, toast]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
            setUser(JSON.parse(userRaw));
        }
        fetchData();
        fetchSupportUnreadCount();
        fetchMaintenanceStatus();

        if (token) {
            const socketUrl = apiUrl.replace('/api', '');
            const socket = io(socketUrl, {
                auth: { token },
                transports: ['websocket', 'polling'],
            });

            socket.on('support_message', () => {
                fetchSupportUnreadCount();
            });

            socket.on('maintenance_mode', (data: { enabled: boolean }) => {
                setIsMaintenanceMode(data.enabled);
            });

            return () => {
                socket.disconnect();
            };
        }
    }, [fetchData, fetchSupportUnreadCount, fetchMaintenanceStatus, apiUrl]);

    useEffect(() => {
        const selected = quizzes.find(q => q.id === selectedQuizId);
        if (!selected) return;

        // Check if user has permission to edit this quiz
        const canEdit = user?.role === 'SUPER_ADMIN' ||
            (user?.role === 'ADMIN' && selected.createdBy?.id === user?.id);

        if (!canEdit) {
            // Clear form fields if no permission
            setEditTitle('');
            setEditDuration('');
            setEditRetakeLimit('2');
            setEditStartDate('');
            setEditEndDate('');
            return;
        }

        setEditTitle(selected.title ?? '');
        setEditDuration(String(selected.duration ?? ''));
        setEditRetakeLimit(String(selected.retakeLimit ?? 2));

        const toLocalInput = (iso?: string | null) => {
            if (!iso) return '';
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return '';
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        setEditStartDate(toLocalInput(selected.startDate));
        setEditEndDate(toLocalInput(selected.endDate));
    }, [selectedQuizId, quizzes, user]);

    const handleSaveQuizMeta = async () => {
        if (!selectedQuizId) return;
        setIsSavingEdit(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/quizzes/${selectedQuizId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: editTitle,
                    duration: editDuration,
                    retakeLimit: editRetakeLimit,
                    startDate: editStartDate ? new Date(editStartDate).toISOString() : null,
                    endDate: editEndDate ? new Date(editEndDate).toISOString() : null
                })
            });

            if (res.ok) {
                fetchQuizzes();
                toast('Exam updated successfully', 'success');
            } else {
                const errData = await res.json().catch(() => ({}));
                toast(`Update failed: ${errData.message || 'Unknown error'}`, 'error');
            }
        } catch (err) {
            toast('Update error: Could not connect to the server', 'error');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const fetchQuizzes = () => fetchData(); // Alias for backward compatibility if needed

    const handleCreateQuiz = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/quizzes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: newTitle, duration: newDuration }),
            });

            if (res.ok) {
                setNewTitle('');
                fetchQuizzes();
                toast('Quiz created successfully', 'success');
            }
        } catch (err) {
            toast('Creation failed', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggle = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/quizzes/${id}/toggle`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchQuizzes();
        } catch (err) {
            console.error('Toggle failed');
            toast('Failed to toggle exam status', 'error');
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteModal({ id, title });
    };

    const confirmDelete = async () => {
        if (!deleteModal) return;
        const { id } = deleteModal;
        setDeleteModal(null);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${apiUrl}/quizzes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setQuizzes(prev => prev.filter(q => q.id !== id));
                if (selectedQuizId === id) setSelectedQuizId('');
                fetchQuizzes();
            } else {
                const errData = await res.json().catch(() => ({}));
                toast(`Delete failed: ${errData.message || 'Unknown error'}`, 'error');
            }
        } catch (err) {
            console.error('Delete error:', err);
            toast('Could not connect to server for deletion', 'error');
        }
    };

    const [importToExisting, setImportToExisting] = useState(true);
    const [importTitle, setImportTitle] = useState('');
    const [importDuration, setImportDuration] = useState('30');

    // Delete confirmation modal
    const [deleteModal, setDeleteModal] = useState<{ id: string; title: string } | null>(null);

    const handleUpload = async () => {
        // Clear previous errors
        setQuestionTypeError('');

        // Validate question type is selected
        if (!questionType) {
            setQuestionTypeError('Please select a question type');
            return;
        }

        if (!file || (importToExisting && !selectedQuizId)) {
            toast('Please select a file and a quiz', 'warning');
            return;
        }
        if (!importToExisting && (!importTitle || !importDuration)) {
            toast('Please provide a title and duration for the new exam', 'warning');
            return;
        }
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('questionType', questionType); // Add question type to form data
        if (importToExisting) {
            formData.append('quizId', selectedQuizId);
        } else {
            formData.append('title', importTitle);
            formData.append('duration', importDuration);
        }

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiUrl}/questions/import`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (res.ok) {
                toast('Import successful', 'success');
                setImportTitle('');
                setFile(null);
                setQuestionType(null); // Reset question type selection
                fetchQuizzes();
            } else {
                const errorData = await res.json();
                toast(`Import failed: ${errorData.message || 'Unknown error'}`, 'error');
            }
        } catch (err) {
            toast('Upload error: Could not connect to the server', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Calculate selected quiz for use in JSX
    const selected = quizzes.find(q => q.id === selectedQuizId);

    return (
        <>
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 md:p-12 transition-colors duration-200">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 animate-fade-in">
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">Admin Dashboard</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Manage your exam sessions and candidate records.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <button
                            onClick={handleToggleMaintenance}
                            disabled={isTogglingMaintenance}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border shadow-lg ${
                                isMaintenanceMode 
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' 
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                            } ${isTogglingMaintenance ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                            title={isMaintenanceMode ? 'Maintenance Mode is ON' : 'Maintenance Mode is OFF'}
                        >
                            {isTogglingMaintenance ? (
                                <span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                            ) : isMaintenanceMode ? (
                                <Power size={16} />
                            ) : (
                                <PowerOff size={16} />
                            )}
                            <span className="hidden lg:inline">{isMaintenanceMode ? 'Maintenance ON' : 'Maintenance OFF'}</span>
                        </button>
                        <Link 
                            href="/admin/support"
                            className="p-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm flex items-center gap-2 font-semibold relative"
                            title="Support Center"
                        >
                            <MessageCircle size={20} className="text-primary" />
                            <span className="hidden sm:inline">Support</span>
                            {supportUnreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-bounce shadow-lg">
                                    {supportUnreadCount > 9 ? '9+' : supportUnreadCount}
                                </span>
                            )}
                        </Link>
                        <NotificationBell />
                        <ThemeToggle />
                        <Link href="/admin/results" className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:shadow-xl transition-all text-sm">
                            <BookOpen size={16} />
                            Results
                        </Link>
                        <Link href="/admin/analytics" className="flex items-center gap-2 bg-slate-600 dark:bg-slate-700 text-white px-4 py-2.5 rounded-2xl font-bold shadow-lg hover:bg-slate-700 dark:hover:bg-slate-800 transition-all text-sm">
                            <BarChart3 size={16} />
                            Analytics
                        </Link>
                        <Link
                            href={user?.role === 'SUPER_ADMIN' ? '/admin/candidates' : '/admin/my-exam-takers'}
                            className="flex items-center gap-2 bg-slate-600 dark:bg-slate-700 text-white px-4 py-2.5 rounded-2xl font-bold shadow-lg hover:bg-slate-700 dark:hover:bg-slate-800 transition-all text-sm">
                            <Users size={16} />
                            {user?.role === 'SUPER_ADMIN' ? 'Candidates' : 'Exam Takers'}
                        </Link>
                    </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    {/* Left Column: Quiz List & Recent Activity */}
                    <div className="xl:col-span-3 space-y-8">
                        {/* Exam Sessions List */}
                        <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-slide-up">
                            <div className="p-8 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Exam Sessions</h3>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{quizzes.length} Total</span>
                            </div>

                            {/* Mobile card list — shown below md */}
                            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
                                {quizzes.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                                                <BookOpen size={32} className="text-slate-300 dark:text-slate-700" />
                                            </div>
                                            <p className="text-slate-400 dark:text-slate-500 font-bold">No exam sessions yet</p>
                                            <p className="text-slate-400 dark:text-slate-600 text-sm">Create your first exam using the form below.</p>
                                        </div>
                                    </div>
                                ) : quizzes.map((quiz) => (
                                    <div
                                        key={quiz.id}
                                        onClick={() => setSelectedQuizId(quiz.id)}
                                        className={`p-5 cursor-pointer transition-colors ${selectedQuizId === quiz.id ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{quiz.title}</p>
                                                <p className="text-xs text-slate-400 mt-0.5 font-mono">ID: {quiz.id.slice(0, 8)}</p>
                                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                                    <span>{quiz._count.questions} questions</span>
                                                    <span>·</span>
                                                    <span>{quiz.duration} min</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${quiz.isActive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${quiz.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                    {quiz.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleToggle(e, quiz.id)}
                                                        className={`p-2 rounded-xl border transition-all ${quiz.isActive ? 'bg-amber-50 border-amber-100 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}
                                                        title={quiz.isActive ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {quiz.isActive ? <PowerOff size={16} /> : <Power size={16} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDelete(e, quiz.id, quiz.title)}
                                                        className="p-2 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop table — hidden below md */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest border-b border-slate-50 dark:border-slate-700">
                                            <th className="px-8 py-6">Exam Title</th>
                                            <th className="px-8 py-6">Questions</th>
                                            <th className="px-8 py-6">Duration</th>
                                            <th className="px-8 py-6">Status</th>
                                            <th className="px-8 py-6">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {quizzes.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-8 py-20 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                                                            <BookOpen size={32} className="text-slate-300 dark:text-slate-700" />
                                                        </div>
                                                        <p className="text-slate-400 dark:text-slate-500 font-bold text-lg">No exam sessions yet</p>
                                                        <p className="text-slate-400 dark:text-slate-600 text-sm">Create your first exam using the form on the right.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : quizzes.map((quiz) => (
                                            <tr
                                                key={quiz.id}
                                                onClick={() => setSelectedQuizId(quiz.id)}
                                                className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${selectedQuizId === quiz.id ? 'bg-primary/5 dark:bg-primary/10' : ''}`}
                                            >
                                                <td className="px-8 py-6">
                                                    <div className="font-bold text-slate-900 dark:text-slate-100">{quiz.title}</div>
                                                    <div className="text-xs text-slate-400 mt-1 uppercase tracking-tighter font-bold">ID: {quiz.id.slice(0, 8)}</div>
                                                </td>
                                                <td className="px-8 py-6 font-semibold text-slate-600 dark:text-slate-400">{quiz._count.questions} Items</td>
                                                <td className="px-8 py-6 font-semibold text-slate-600 dark:text-slate-400">{quiz.duration} min</td>
                                                <td className="px-8 py-6">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${quiz.isActive ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${quiz.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                        {quiz.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleToggle(e, quiz.id)}
                                                            className={`p-2 rounded-xl border transition-all ${quiz.isActive ? 'bg-amber-50 border-amber-100 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'}`}
                                                            title={quiz.isActive ? "Deactivate" : "Activate"}
                                                        >
                                                            {quiz.isActive ? <PowerOff size={18} /> : <Power size={18} />}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDelete(e, quiz.id, quiz.title)}
                                                            className="p-2 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all font-bold"
                                                            title="Delete Exam"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Recent Activity Table */}
                        <section className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
                            <div className="p-8 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Recent Candidate Activity</h3>
                                <Link href="/admin/results" className="text-xs font-bold text-primary uppercase tracking-widest hover:underline">View All</Link>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest border-b border-slate-50 dark:border-slate-700">
                                            <th className="px-8 py-6">Candidate</th>
                                            <th className="px-8 py-6">Exam</th>
                                            <th className="px-8 py-6">Score</th>
                                            <th className="px-8 py-6">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                        {recentAttempts.length > 0 ? recentAttempts.map((attempt) => (
                                            <tr key={attempt.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                <td className="px-8 py-6">
                                                    <div className="font-bold text-slate-900 dark:text-slate-100">{attempt.user.name}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">{attempt.user.email}</div>
                                                </td>
                                                <td className="px-8 py-6 font-semibold text-slate-600 dark:text-slate-400">{attempt.quiz.title}</td>
                                                <td className="px-8 py-6 font-bold">
                                                    {attempt.score !== null ? (
                                                        <span className={attempt.score >= 50 ? 'text-emerald-500' : 'text-rose-500'}>
                                                            {attempt.score.toFixed(1)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-600 font-medium italic text-sm">N/A</span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${attempt.endTime ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                                        }`}>
                                                        {attempt.endTime ? 'Completed' : 'Running'}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="px-8 py-10 text-center text-slate-400 dark:text-slate-500 italic">No recent activity.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Sidebar Actions */}
                    <div className="space-y-8">
                        {/* Edit Selected Quiz */}
                        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-xl animate-fade-in">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <CheckCircle className="text-primary" size={20} />
                                Edit Selected Exam
                            </h3>

                            {!selectedQuizId ? (
                                <p className="text-slate-400 font-medium">Select an exam from the table to edit.</p>
                            ) : (
                                <div className="space-y-4">
                                    {/* Permission Check */}
                                    {user?.role === 'ADMIN' && selected?.createdBy?.id !== user?.id && (
                                        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl mb-4">
                                            <div className="flex items-center gap-2">
                                                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-7.422 8-8 8 8 8 8-8 8-8 8-4.422L2 10z" clipRule="evenodd" />
                                                </svg>
                                                <span className="font-medium">You can only edit quizzes you created</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Title</label>
                                        <input
                                            type="text"
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            disabled={user?.role === 'ADMIN' && selected?.createdBy?.id !== user?.id}
                                            className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm text-slate-900 dark:text-slate-100"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Duration (min)</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={300}
                                                value={editDuration}
                                                onChange={(e) => setEditDuration(e.target.value)}
                                                disabled={user?.role === 'ADMIN' && selected?.createdBy?.id !== user?.id}
                                                className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm text-slate-900 dark:text-slate-100"
                                            />
                                            <p className="text-[10px] text-slate-400 ml-1">1 – 300 minutes</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Retake Limit</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={10}
                                                value={editRetakeLimit}
                                                onChange={(e) => setEditRetakeLimit(e.target.value)}
                                                disabled={user?.role === 'ADMIN' && selected?.createdBy?.id !== user?.id}
                                                className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm text-slate-900 dark:text-slate-100"
                                            />
                                            <p className="text-[10px] text-slate-400 ml-1">1 – 10 attempts</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Start Date (optional)</label>
                                        <input
                                            type="datetime-local"
                                            value={editStartDate}
                                            onChange={(e) => setEditStartDate(e.target.value)}
                                            disabled={user?.role === 'ADMIN' && selected?.createdBy?.id !== user?.id}
                                            className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm text-slate-900 dark:text-slate-100"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">End Date (optional)</label>
                                        <input
                                            type="datetime-local"
                                            value={editEndDate}
                                            onChange={(e) => setEditEndDate(e.target.value)}
                                            disabled={user?.role === 'ADMIN' && selected?.createdBy?.id !== user?.id}
                                            className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm text-slate-900 dark:text-slate-100"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={handleSaveQuizMeta}
                                            disabled={isSavingEdit}
                                            className="flex-1 px-6 py-3 rounded-2xl font-bold text-white bg-primary hover:bg-primary/90 transition-all disabled:opacity-60"
                                        >
                                            {isSavingEdit ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <Link
                                            href={`/admin/quizzes/${selectedQuizId}/preview`}
                                            className="px-6 py-3 rounded-2xl font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                                        >
                                            Preview
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Create Quiz Form */}
                        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-xl animate-fade-in" style={{ animationDelay: '150ms' }}>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <Plus className="text-primary" size={20} />
                                New Exam Session
                            </h3>
                            <form onSubmit={handleCreateQuiz} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Title</label>
                                    <input
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        placeholder="e.g. Mathematics Q1"
                                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm text-slate-900 dark:text-slate-100"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Duration (min)</label>
                                    <input
                                        type="number"
                                        value={newDuration}
                                        onChange={(e) => setNewDuration(e.target.value)}
                                        className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm text-slate-900 dark:text-slate-100"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="w-full bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white py-4 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 mt-2 shadow-lg shadow-slate-200 dark:shadow-none"
                                >
                                    {isCreating ? 'Creating...' : 'Create Exam'}
                                </button>
                            </form>
                        </section>

                        {/* Import Questions */}
                        <section className="bg-primary p-10 rounded-[2.5rem] text-white shadow-xl shadow-primary/20 animate-fade-in dark:shadow-none" style={{ animationDelay: '200ms' }}>
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Upload size={20} />
                                Bulk Import
                            </h3>
                            <p className="text-primary-foreground/70 mb-8 text-sm leading-relaxed">
                                {importToExisting ? (
                                    selectedQuizId ? (
                                        <>Target Exam: <span className="font-bold text-white">{quizzes.find(q => q.id === selectedQuizId)?.title}</span></>
                                    ) : (
                                        'Select an exam from the list to import questions.'
                                    )
                                ) : (
                                    'A new exam will be created from your file.'
                                )}
                            </p>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl cursor-pointer hover:bg-white/20 transition-all mb-4" onClick={() => setImportToExisting(!importToExisting)}>
                                    <div className={`w-5 h-5 rounded-md border-2 border-white flex items-center justify-center transition-all ${!importToExisting ? 'bg-white' : ''}`}>
                                        {!importToExisting && <CheckCircle size={14} className="text-primary" />}
                                    </div>
                                    <span className="text-sm font-bold">Create new exam from this file</span>
                                </div>

                                {!importToExisting && (
                                    <div className="space-y-4 animate-slide-up">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest ml-1">New Exam Title</label>
                                            <input
                                                type="text"
                                                value={importTitle}
                                                onChange={(e) => setImportTitle(e.target.value)}
                                                placeholder="e.g. Science Part 1"
                                                className="w-full px-5 py-3 rounded-2xl bg-white/10 border border-white/20 focus:border-white focus:ring-4 focus:ring-white/10 transition-all outline-none text-sm text-white placeholder:text-white/40"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest ml-1">Duration (min)</label>
                                            <input
                                                type="number"
                                                value={importDuration}
                                                onChange={(e) => setImportDuration(e.target.value)}
                                                className="w-full px-5 py-3 rounded-2xl bg-white/10 border border-white/20 focus:border-white focus:ring-4 focus:ring-white/10 transition-all outline-none text-sm text-white"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-white/60 uppercase tracking-widest ml-1">Question Type *</label>
                                    <UserTypeSelector
                                        value={questionType}
                                        onChange={(type) => {
                                            setQuestionType(type);
                                            setQuestionTypeError('');
                                        }}
                                        required={true}
                                        className="[&>div]:bg-white/10 [&>div]:border-white/20 [&>div]:text-white [&>div]:placeholder:text-white/40 [&>div:focus]:border-white [&>div:focus]:ring-white/10"
                                        error={questionTypeError}
                                    />
                                </div>

                                <input
                                    key={file ? 'file-present' : 'file-empty'}
                                    type="file"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs text-primary-foreground file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white/20 file:text-white hover:file:bg-white/30"
                                />
                                <button
                                    onClick={handleUpload}
                                    disabled={isUploading || (importToExisting && !selectedQuizId) || !questionType}
                                    className="w-full bg-white text-primary py-4 rounded-2xl font-bold shadow-lg transform transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                                >
                                    {isUploading ? 'Importing...' : 'Upload Excel'}
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </main>
        <ConfirmModal
            isOpen={!!deleteModal}
            title="Delete Exam"
            message={`Are you sure you want to delete "${deleteModal?.title}"? This will also delete all associated questions and candidate sessions.`}
            confirmLabel="Delete"
            onConfirm={confirmDelete}
            onCancel={() => setDeleteModal(null)}
        />
        </>
    );
}
