/// <reference types="nativewind/types" />
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Clock, CheckCircle, XCircle, TrendingUp, Calendar, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

// Global interop is now pre-registered in _layout.tsx

interface QuizSession {
  id: string;
  quizId: string;
  quiz: {
    id: string;
    title: string;
  };
  score: number | null;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  startTime: string;
  endTime?: string | null;
  status: 'RUNNING' | 'COMPLETED' | 'ABANDONED';
  duration?: number;
}

export default function ResultsScreen() {
  const { user, accessToken, apiUrl } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'running'>('all');

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const response = await fetch(`${apiUrl}/quiz/my-sessions`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchResults();
  };

  const filteredSessions = sessions.filter(session => {
    if (filter === 'completed') return session.status === 'COMPLETED';
    if (filter === 'running') return session.status === 'RUNNING';
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' @ ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getScoreStyle = (score: number | null) => {
    if (score === null) return 'text-slate-500';
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle size={18} color="#10b981" />;
      case 'RUNNING': return <Clock size={18} color="#3b82f6" />;
      case 'ABANDONED': return <XCircle size={18} color="#f43f5e" />;
      default: return null;
    }
  };

  const calculateStats = () => {
    const completed = sessions.filter(s => s.status === 'COMPLETED');
    const totalScore = completed.reduce((sum, s) => sum + (s.score || 0), 0);
    const avgScore = completed.length > 0 ? totalScore / completed.length : 0;
    
    return {
      totalSessions: sessions.length,
      completedSessions: completed.length,
      averageScore: Math.round(avgScore),
      bestScore: completed.length > 0 ? Math.max(...completed.map(s => s.score || 0)) : 0
    };
  };

  const stats = calculateStats();

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
        <ScrollView 
          className="flex-1"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        >
          {/* Header */}
          <View className="px-8 pt-10 pb-8 flex-row justify-between items-center">
            <View>
              <Text className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Performance</Text>
              <Text className="text-3xl font-black text-white">Archives</Text>
            </View>
            <View className="w-12 h-12 bg-amber-500/10 rounded-2xl items-center justify-center border border-amber-500/20">
               <Trophy size={24} color="#f59e0b" />
            </View>
          </View>

          {/* Stats Summary Panel */}
          <View className="px-8 mb-10">
            <View className="bg-slate-900/40 p-8 rounded-[40px] border border-white/5 flex-row">
              <View className="flex-1 items-center border-r border-white/10">
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Efficiency</Text>
                <Text className="text-3xl font-black text-white">{stats.averageScore}%</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Top Record</Text>
                <Text className="text-3xl font-black text-blue-500">{stats.bestScore}%</Text>
              </View>
            </View>
          </View>

          {/* Filter Bar */}
          <View className="px-8 mb-8">
             <View className="flex-row bg-slate-900/80 p-1.5 rounded-2xl border border-white/5">
                {(['all', 'completed', 'running'] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setFilter(opt)}
                    className={`flex-1 py-3.5 rounded-xl items-center ${filter === opt ? 'bg-blue-600 shadow-lg' : ''}`}
                  >
                    <Text className={`text-[10px] font-black uppercase tracking-widest ${filter === opt ? 'text-white' : 'text-slate-500'}`}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>

          {/* Content List */}
          <View className="px-8 pb-12">
            <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-black text-white px-1">Detailed History</Text>
                <TrendingUp size={18} color="#3b82f6" />
            </View>

            {filteredSessions.length === 0 ? (
              <View className="bg-slate-900/30 p-16 rounded-[40px] border border-dashed border-slate-800 items-center">
                <Trophy size={48} color="#1e293b" />
                <Text className="text-slate-500 text-center font-bold mt-6 text-base">No records found for this criteria.</Text>
              </View>
            ) : (
              <View className="space-y-4">
                {filteredSessions.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    onPress={() => {
                      if (session.status === 'COMPLETED') {
                        router.push(`/results/${session.id}` as any);
                      }
                    }}
                    disabled={session.status !== 'COMPLETED'}
                    activeOpacity={0.8}
                    className={`p-6 rounded-[32px] border ${session.status === 'COMPLETED' ? 'bg-slate-900/60 border-white/10 shadow-xl' : 'bg-slate-900/20 border-transparent opacity-60'}`}
                  >
                    <View className="flex-row justify-between items-start mb-6">
                      <View className="flex-1 mr-4">
                        <Text className="text-lg font-black text-white mb-2 leading-tight">{session.quiz.title}</Text>
                        <View className="flex-row items-center space-x-2">
                           {getStatusIcon(session.status)}
                           <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                             {session.status}
                           </Text>
                        </View>
                      </View>
                      
                      {session.score !== null && (
                        <View className="items-end">
                           <Text className={`text-3xl font-black ${getScoreStyle(session.score)}`}>{session.score}%</Text>
                           <Text className="text-slate-600 text-[8px] font-bold uppercase tracking-tighter">Certified Score</Text>
                        </View>
                      )}
                    </View>

                    <View className="flex-row items-center justify-between">
                       <View className="flex-row items-center space-x-5">
                          <View className="flex-row items-center space-x-2">
                              <Calendar size={12} color="#64748b" />
                              <Text className="text-slate-400 font-bold text-[10px] uppercase">{formatDate(session.startTime)}</Text>
                          </View>
                          <View className="flex-row items-center space-x-2">
                              <CheckCircle size={12} color="#64748b" />
                              <Text className="text-slate-400 font-bold text-[10px] uppercase">{session.correctCount}/{session.totalQuestions}</Text>
                          </View>
                       </View>

                       {session.status === 'COMPLETED' && (
                          <View className="w-8 h-8 bg-blue-500/10 rounded-lg items-center justify-center border border-blue-500/20">
                             <ArrowRight size={16} color="#3b82f6" />
                          </View>
                       )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
