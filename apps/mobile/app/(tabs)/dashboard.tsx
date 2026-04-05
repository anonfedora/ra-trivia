/// <reference types="nativewind/types" />
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Users, Calendar, Trophy, Play, BookOpen, TrendingUp, Sparkles, ShieldCheck, RefreshCcw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

// Global interop is now pre-registered in _layout.tsx

interface Quiz {
  id: string;
  title: string;
  description?: string;
  duration: number;
  questionsCount: number;
  startDate?: string;
  endDate?: string;
  retakeLimit?: number | null;
  completedAttempts?: number;
  status?: 'UPCOMING' | 'ACTIVE' | 'ENDED';
}

export default function DashboardScreen() {
  const { user, accessToken, apiUrl } = useAuth();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    completedQuizzes: 0,
    averageScore: 0,
    totalAttempts: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [quizzesRes, statsRes] = await Promise.all([
        fetch(`${apiUrl}/quizzes`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }),
        fetch(`${apiUrl}/quiz/my-sessions`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
      ]);

      if (quizzesRes.ok && statsRes.ok) {
        const quizzesData = await quizzesRes.json();
        const sessionsData = await statsRes.json();

        const now = new Date();
        const processedQuizzes = quizzesData.map((quiz: any) => {
          const start = quiz.startDate ? new Date(quiz.startDate) : null;
          const end = quiz.endDate ? new Date(quiz.endDate) : null;
          const completedAttempts = sessionsData.filter((s: any) =>
            s.quizId === quiz.id && s.status === 'COMPLETED'
          ).length;

          let status: 'UPCOMING' | 'ACTIVE' | 'ENDED' = 'ACTIVE';
          if (start && now < start) status = 'UPCOMING';
          else if (end && now > end) status = 'ENDED';

          return {
            ...quiz,
            questionsCount: quiz._count?.questions || 0,
            completedAttempts,
            status
          };
        });

        setQuizzes(processedQuizzes);

        const completedSessions = sessionsData.filter((s: any) => s.status === 'COMPLETED');
        const totalScore = completedSessions.reduce((sum: number, s: any) => sum + (s.score || 0), 0);
        const averageScore = completedSessions.length > 0 ? totalScore / completedSessions.length : 0;

        setStats({
          totalQuizzes: quizzesData.length,
          completedQuizzes: completedSessions.length,
          averageScore: Math.round(averageScore),
          totalAttempts: sessionsData.length
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleQuizPress = (quiz: Quiz) => {
    if (quiz.status === 'UPCOMING' || quiz.status === 'ENDED') return;

    if (quiz.retakeLimit !== null && quiz.retakeLimit !== undefined && (quiz.completedAttempts || 0) >= quiz.retakeLimit) {
      return;
    }

    router.push(`/quiz/${quiz.id}/instructions` as any);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'UPCOMING': return 'bg-amber-900/20 text-amber-500 border-amber-900/30';
      case 'ACTIVE': return 'bg-emerald-900/20 text-emerald-500 border-emerald-900/30';
      case 'ENDED': return 'bg-rose-900/20 text-rose-500 border-rose-900/30';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#020617']}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
        >
          {/* Header Section */}
          <View className="px-8 pt-10 pb-8 flex-row justify-between items-center">
            <View>
              <Text className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">
                Candidate Dashboard
              </Text>
              <Text className="text-3xl font-black text-white">
                Hi, {user?.name?.split(' ')[0]}
              </Text>
            </View>
            <View className="w-12 h-12 bg-blue-500/10 rounded-2xl items-center justify-center border border-blue-500/20">
              <ShieldCheck size={24} color="#3b82f6" />
            </View>
          </View>

          {/* Stats Grid */}
          <View className="px-8 mb-10">
            <View className="flex-row space-x-4 mb-4">
              <View className="flex-1 bg-slate-900/50 p-6 rounded-[32px] border border-white/5">
                <View className="flex-row items-center space-x-3 mb-4">
                  <View className="w-8 h-8 bg-blue-500/10 rounded-xl items-center justify-center">
                    <BookOpen size={16} color="#3b82f6" />
                  </View>
                  <Text className="text-slate-400 font-bold text-xs uppercase tracking-tighter">Total</Text>
                </View>
                <Text className="text-3xl font-black text-white">{stats.totalQuizzes}</Text>
              </View>

              <View className="flex-1 bg-slate-900/50 p-6 rounded-[32px] border border-white/5">
                <View className="flex-row items-center space-x-3 mb-4">
                  <View className="w-8 h-8 bg-emerald-500/10 rounded-xl items-center justify-center">
                    <Trophy size={16} color="#10b981" />
                  </View>
                  <Text className="text-slate-400 font-bold text-xs uppercase tracking-tighter">Done</Text>
                </View>
                <Text className="text-3xl font-black text-white">{stats.completedQuizzes}</Text>
              </View>
            </View>

            <View className="flex-row space-x-4">
              <View className="flex-1 bg-slate-900/50 p-6 rounded-[32px] border border-white/5">
                <View className="flex-row items-center space-x-3 mb-4">
                  <View className="w-8 h-8 bg-purple-500/10 rounded-xl items-center justify-center">
                    <TrendingUp size={16} color="#a855f7" />
                  </View>
                  <Text className="text-slate-400 font-bold text-xs uppercase tracking-tighter">Avg</Text>
                </View>
                <Text className="text-3xl font-black text-white">{stats.averageScore}%</Text>
              </View>

              <View className="flex-1 bg-slate-900/50 p-6 rounded-[32px] border border-white/5">
                <View className="flex-row items-center space-x-3 mb-4">
                  <View className="w-8 h-8 bg-amber-500/10 rounded-xl items-center justify-center">
                    <Users size={16} color="#f59e0b" />
                  </View>
                  <Text className="text-slate-400 font-bold text-xs uppercase tracking-tighter">Runs</Text>
                </View>
                <Text className="text-3xl font-black text-white">{stats.totalAttempts}</Text>
              </View>
            </View>
          </View>

          {/* Quizzes Section */}
          <View className="px-8 pb-12">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-black text-white px-1">Available Quizzes</Text>
              <Sparkles size={18} color="#3b82f6" />
            </View>

            {quizzes.length === 0 ? (
              <View className="bg-slate-900/30 p-12 rounded-[40px] border border-dashed border-slate-800 items-center">
                <BookOpen size={48} color="#334155" />
                <Text className="text-slate-500 text-center font-bold mt-6 text-base px-4 leading-relaxed">
                  The curriculum is being updated. Your next exam will appear here shortly.
                </Text>
              </View>
            ) : (
              <View className="space-y-6">
                {quizzes.map((quiz) => (
                  <TouchableOpacity
                    key={quiz.id}
                    onPress={() => handleQuizPress(quiz)}
                    disabled={quiz.status !== 'ACTIVE'}
                    activeOpacity={0.8}
                    className={`p-6 rounded-[32px] border ${quiz.status === 'ACTIVE' ? 'bg-slate-900/60 border-white/10 shadow-2xl' : 'bg-slate-900/20 border-transparent opacity-60'}`}
                  >
                    <View className="flex-row justify-between items-start mb-6">
                      <View className="flex-1 mr-4">
                        <Text className="text-xl font-black text-white leading-tight mb-2">{quiz.title}</Text>
                        {quiz.description && (
                          <Text className="text-slate-400 text-sm font-medium leading-relaxed" numberOfLines={2}>
                            {quiz.description}
                          </Text>
                        )}
                      </View>
                      <View className={`px-4 py-1.5 rounded-full border ${getStatusStyle(quiz.status || '')}`}>
                        <Text className="text-[10px] font-black uppercase tracking-widest leading-none">
                          {quiz.status === 'ACTIVE' ? 'Available' : quiz.status}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center space-x-6 mb-6">
                      <View className="flex-row items-center space-x-2.5">
                        <View className="w-6 h-6 bg-slate-800 rounded-full items-center justify-center">
                          <Clock size={12} color="#94a3b8" />
                        </View>
                        <Text className="text-slate-400 font-bold text-xs uppercase tracking-tighter">{quiz.duration}m</Text>
                      </View>
                      <View className="flex-row items-center space-x-2.5">
                        <View className="w-6 h-6 bg-slate-800 rounded-full items-center justify-center">
                          <BookOpen size={12} color="#94a3b8" />
                        </View>
                        <Text className="text-slate-400 font-bold text-xs uppercase tracking-tighter">{quiz.questionsCount} Ques</Text>
                      </View>
                      {quiz.retakeLimit && (
                        <View className="flex-row items-center space-x-2.5">
                          <View className="w-6 h-6 bg-slate-800 rounded-full items-center justify-center">
                            <RefreshCcw size={12} color="#94a3b8" />
                          </View>
                          <Text className="text-slate-400 font-bold text-xs uppercase tracking-tighter">
                            {quiz.retakeLimit - (quiz.completedAttempts || 0)} Lft
                          </Text>
                        </View>
                      )}
                    </View>

                    {quiz.status === 'ACTIVE' && (
                      <View className="bg-emerald-600 h-14 rounded-2xl flex-row items-center justify-center space-x-3 shadow-lg shadow-emerald-500/20">
                        <Play size={16} color="white" fill="white" />
                        <Text className="text-white font-bold text-base">
                          {(quiz.completedAttempts || 0) > 0 ? 'Retake Curriculum' : 'Begin Selection'}
                        </Text>
                      </View>
                    )}
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
