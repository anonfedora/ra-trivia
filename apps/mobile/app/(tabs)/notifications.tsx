/// <reference types="nativewind/types" />
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Check, CheckCheck, Trash2, BookOpen, ClipboardList, ExternalLink, Inbox, Sparkles, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

// Styling interop is now pre-registered in _layout.tsx

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    quizId?: string | null;
    sessionId?: string | null;
    isRead: boolean;
    createdAt: string;
}

type FilterType = 'ALL' | 'NEW_EXAM_AVAILABLE' | 'RESULT_RELEASED';

const FILTERS: { key: FilterType; label: string; icon: any }[] = [
    { key: 'ALL', label: 'All', icon: Bell },
    { key: 'NEW_EXAM_AVAILABLE', label: 'Exams', icon: BookOpen },
    { key: 'RESULT_RELEASED', label: 'Results', icon: ClipboardList },
];

export default function NotificationsScreen() {
    const { accessToken, api, apiUrl } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await api.get('/notifications?pageSize=100');
            if (res.status === 200) {
                setNotifications(res.data.notifications);
                setUnreadCount(res.data.unreadCount);
            }
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [api]);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const filtered = useMemo(() =>
        notifications.filter(n => activeFilter === 'ALL' || n.type === activeFilter),
        [notifications, activeFilter]
    );

    const markAsRead = async (id: string) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            fetchNotifications();
        } catch (err) {
            console.error('Failed to mark as read', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.post('/notifications/mark-all-read');
            fetchNotifications();
        } catch (err) {
            console.error('Failed to mark all as read', err);
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            await api.delete(`/notifications/${id}`);
            fetchNotifications();
        } catch (err) {
            console.error('Failed to delete notification', err);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            <LinearGradient
                colors={['#0f172a', '#020617']}
                className="flex-1"
            >
                {/* Header */}
                <View className="px-8 pt-10 pb-6 flex-row justify-between items-start">
                    <View>
                        <Text className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Updates</Text>
                        <Text className="text-3xl font-black text-white">Notifications</Text>
                        <Text className="text-slate-500 text-xs font-bold mt-2 uppercase tracking-tighter">
                            {unreadCount > 0 ? `${unreadCount} new alerts pending` : 'System status normal'}
                        </Text>
                    </View>
                    {unreadCount > 0 && (
                        <TouchableOpacity 
                            onPress={markAllAsRead} 
                            className="bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20 flex-row items-center space-x-2"
                        >
                            <CheckCheck size={16} color="#3b82f6" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Bar */}
                <View className="px-8 mb-6">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                        {FILTERS.map((f) => (
                            <TouchableOpacity
                                key={f.key}
                                onPress={() => setActiveFilter(f.key)}
                                className={`flex-row items-center space-x-2.5 px-6 py-3.5 rounded-2xl border ${activeFilter === f.key ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-900 border-white/5'}`}
                            >
                                <f.icon size={14} color={activeFilter === f.key ? '#ffffff' : '#64748b'} />
                                <Text className={`text-xs font-black uppercase tracking-widest ${activeFilter === f.key ? 'text-white' : 'text-slate-400'}`}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
                >
                    {filtered.length === 0 ? (
                        <View className="items-center justify-center py-20 bg-slate-900/20 rounded-[40px] border border-dashed border-slate-800">
                             <Inbox size={64} color="#1e293b" />
                            <Text className="text-white text-xl font-black mt-8">Clear Inbox</Text>
                            <Text className="text-slate-500 font-medium text-center px-12 mt-2 leading-relaxed">
                                No new communication from the selection committee at this time.
                            </Text>
                        </View>
                    ) : (
                        <View className="space-y-4">
                            {filtered.map((n) => (
                                <View key={n.id} className={`p-6 rounded-[32px] border ${!n.isRead ? 'bg-slate-900/60 border-blue-500/30 shadow-2xl' : 'bg-slate-900/30 border-white/5'}`}>
                                    <View className="flex-row">
                                        <View className="flex-1">
                                            <View className="flex-row items-center space-x-3 mb-2">
                                                <Text className="text-lg font-black text-white">{n.title}</Text>
                                                {!n.isRead && <View className="w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-slate-950" />}
                                            </View>
                                            <Text className="text-slate-400 text-sm font-medium leading-relaxed mb-4">{n.message}</Text>
                                            
                                            <View className="flex-row items-center justify-between">
                                                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{formatTime(n.createdAt)}</Text>
                                                
                                                <View className="flex-row items-center space-x-3">
                                                    {!n.isRead && (
                                                        <TouchableOpacity onPress={() => markAsRead(n.id)} className="w-10 h-10 bg-blue-500/10 rounded-xl items-center justify-center border border-blue-500/20">
                                                            <Check size={18} color="#3b82f6" />
                                                        </TouchableOpacity>
                                                    )}
                                                    <TouchableOpacity onPress={() => deleteNotification(n.id)} className="w-10 h-10 bg-rose-500/10 rounded-xl items-center justify-center border border-rose-500/20">
                                                        <Trash2 size={18} color="#f43f5e" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {(n.type === 'RESULT_RELEASED' || n.type === 'NEW_EXAM_AVAILABLE') && (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        if (!n.isRead) markAsRead(n.id);
                                                        const path = n.type === 'RESULT_RELEASED' ? `/results/${n.sessionId}` : `/quiz/${n.quizId}/instructions`;
                                                        router.push(path as any);
                                                    }}
                                                    className="mt-6 flex-row items-center justify-center space-x-2 py-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20"
                                                >
                                                    {n.type === 'RESULT_RELEASED' ? <ClipboardList size={16} color="white" /> : <BookOpen size={16} color="white" />}
                                                    <Text className="text-white font-bold text-sm tracking-wide">
                                                        {n.type === 'RESULT_RELEASED' ? 'View Official Result' : 'Begin Selection Process'}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
}
