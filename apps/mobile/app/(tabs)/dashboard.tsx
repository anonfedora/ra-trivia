import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Users, Calendar, Trophy, Play, BookOpen, TrendingUp } from 'lucide-react-native';

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
  const { user, token, apiUrl } = useAuth();
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
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${apiUrl}/quiz/my-sessions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (quizzesRes.ok && statsRes.ok) {
        const quizzesData = await quizzesRes.json();
        const sessionsData = await statsRes.json();

        // Process quizzes with status
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

        // Calculate stats
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
    if (quiz.status === 'UPCOMING') {
      // Show upcoming quiz details
      return;
    }
    
    if (quiz.status === 'ENDED') {
      // Show ended quiz message
      return;
    }

    // Check retake limit
    if (quiz.retakeLimit !== null && quiz.retakeLimit !== undefined && (quiz.completedAttempts || 0) >= quiz.retakeLimit) {
      // Show max attempts reached
      return;
    }

    router.push(`/quiz/${quiz.id}/instructions` as any);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UPCOMING': return { backgroundColor: '#fef3c7', color: '#d97706' };
      case 'ACTIVE': return { backgroundColor: '#d1fae5', color: '#059669' };
      case 'ENDED': return { backgroundColor: '#fee2e2', color: '#dc2626' };
      default: return { backgroundColor: '#f3f4f6', color: '#6b7280' };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'UPCOMING': return 'Starts Soon';
      case 'ACTIVE': return 'Available';
      case 'ENDED': return 'Ended';
      default: return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Welcome back, {user?.name?.split(' ')[0]}!
          </Text>
          <Text style={styles.headerSubtitle}>
            Ready to test your knowledge?
          </Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#eff6ff' }]}>
              <View style={styles.statHeader}>
                <BookOpen size={20} color="#3b82f6" />
                <Text style={[styles.statTitle, { color: '#3b82f6' }]}>Total Quizzes</Text>
              </View>
              <Text style={[styles.statValue, { color: '#1e40af' }]}>
                {stats.totalQuizzes}
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
              <View style={styles.statHeader}>
                <Trophy size={20} color="#22c55e" />
                <Text style={[styles.statTitle, { color: '#22c55e' }]}>Completed</Text>
              </View>
              <Text style={[styles.statValue, { color: '#16a34a' }]}>
                {stats.completedQuizzes}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#faf5ff' }]}>
              <View style={styles.statHeader}>
                <TrendingUp size={20} color="#a855f7" />
                <Text style={[styles.statTitle, { color: '#a855f7' }]}>Avg Score</Text>
              </View>
              <Text style={[styles.statValue, { color: '#7c3aed' }]}>
                {stats.averageScore}%
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#fff7ed' }]}>
              <View style={styles.statHeader}>
                <Users size={20} color="#f97316" />
                <Text style={[styles.statTitle, { color: '#f97316' }]}>Attempts</Text>
              </View>
              <Text style={[styles.statValue, { color: '#ea580c' }]}>
                {stats.totalAttempts}
              </Text>
            </View>
          </View>
        </View>

        {/* Quizzes List */}
        <View style={styles.quizzesContainer}>
          <Text style={styles.quizzesTitle}>Available Quizzes</Text>

          {quizzes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <BookOpen size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>
                No quizzes available right now. Check back later!
              </Text>
            </View>
          ) : (
            <View style={styles.quizzesList}>
              {quizzes.map((quiz) => (
                <TouchableOpacity
                  key={quiz.id}
                  onPress={() => handleQuizPress(quiz)}
                  disabled={quiz.status !== 'ACTIVE'}
                  style={[
                    styles.quizCard,
                    quiz.status === 'ACTIVE' 
                      ? styles.quizCardActive 
                      : styles.quizCardInactive
                  ]}
                >
                  <View style={styles.quizHeader}>
                    <View style={styles.quizInfo}>
                      <Text style={styles.quizTitle}>{quiz.title}</Text>
                      {quiz.description && (
                        <Text style={styles.quizDescription}>{quiz.description}</Text>
                      )}
                    </View>
                    <View style={[styles.statusBadge, getStatusColor(quiz.status || '')]}>
                      <Text style={[styles.statusText, { color: getStatusColor(quiz.status || '').color }]}>
                        {getStatusText(quiz.status || '')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.quizMeta}>
                    <View style={styles.metaItem}>
                      <Clock size={16} color="#6b7280" />
                      <Text style={styles.metaText}>{quiz.duration} min</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <BookOpen size={16} color="#6b7280" />
                      <Text style={styles.metaText}>{quiz.questionsCount} questions</Text>
                    </View>
                    {quiz.retakeLimit && (
                      <View style={styles.metaItem}>
                        <Users size={16} color="#6b7280" />
                        <Text style={styles.metaText}>
                          {quiz.retakeLimit ? quiz.retakeLimit - (quiz.completedAttempts || 0) : 0} attempts left
                        </Text>
                      </View>
                    )}
                  </View>

                  {quiz.status === 'ACTIVE' && (
                    <TouchableOpacity
                      onPress={() => handleQuizPress(quiz)}
                      style={styles.startButton}
                    >
                      <Play size={16} color="white" />
                      <Text style={styles.startButtonText}>
                        {(quiz.completedAttempts || 0) > 0 ? 'Retake Quiz' : 'Start Quiz'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  statsContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    minWidth: '45%',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  quizzesContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  quizzesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  emptyContainer: {
    backgroundColor: '#f9fafb',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
  },
  quizzesList: {
    gap: 16,
  },
  quizCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  quizCardActive: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  quizCardInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#f3f4f6',
    opacity: 0.6,
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  quizInfo: {
    flex: 1,
  },
  quizTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  quizDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quizMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#6b7280',
  },
  startButton: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});
