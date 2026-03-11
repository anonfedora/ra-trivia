import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Clock, CheckCircle, XCircle, TrendingUp, Calendar } from 'lucide-react-native';

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
  const { user, token, apiUrl } = useAuth();
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
        headers: { 'Authorization': `Bearer ${token}` }
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
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return '#6b7280';
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle size={20} color="#10b981" />;
      case 'RUNNING':
        return <Clock size={20} color="#3b82f6" />;
      case 'ABANDONED':
        return <XCircle size={20} color="#ef4444" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Completed';
      case 'RUNNING': return 'In Progress';
      case 'ABANDONED': return 'Abandoned';
      default: return status;
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
          <Text style={styles.headerTitle}>Your Results</Text>
          <Text style={styles.headerSubtitle}>Track your quiz performance</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#eff6ff' }]}>
              <View style={styles.statHeader}>
                <Trophy size={20} color="#3b82f6" />
                <Text style={[styles.statTitle, { color: '#3b82f6' }]}>Total Attempts</Text>
              </View>
              <Text style={[styles.statValue, { color: '#1e40af' }]}>
                {stats.totalSessions}
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#f0fdf4' }]}>
              <View style={styles.statHeader}>
                <CheckCircle size={20} color="#22c55e" />
                <Text style={[styles.statTitle, { color: '#22c55e' }]}>Completed</Text>
              </View>
              <Text style={[styles.statValue, { color: '#16a34a' }]}>
                {stats.completedSessions}
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
                <Trophy size={20} color="#f97316" />
                <Text style={[styles.statTitle, { color: '#f97316' }]}>Best Score</Text>
              </View>
              <Text style={[styles.statValue, { color: '#ea580c' }]}>
                {stats.bestScore}%
              </Text>
            </View>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <View style={styles.filterTabs}>
            {(['all', 'completed', 'running'] as const).map((filterOption) => (
              <TouchableOpacity
                key={filterOption}
                onPress={() => setFilter(filterOption)}
                style={[
                  styles.filterTab,
                  filter === filterOption ? styles.filterTabActive : styles.filterTabInactive
                ]}
              >
                <Text style={[
                  styles.filterTabText,
                  filter === filterOption ? styles.filterTabTextActive : styles.filterTabTextInactive
                ]}>
                  {filterOption}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Results List */}
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Quiz History</Text>

          {filteredSessions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Trophy size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>
                No quiz results yet. Start a quiz to see your performance!
              </Text>
            </View>
          ) : (
            <View style={styles.resultsList}>
              {filteredSessions.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  onPress={() => {
                    if (session.status === 'COMPLETED') {
                      router.push(`/results/${session.id}` as any);
                    }
                  }}
                  disabled={session.status !== 'COMPLETED'}
                  style={[
                    styles.resultCard,
                    session.status === 'COMPLETED' 
                      ? styles.resultCardActive 
                      : styles.resultCardInactive
                  ]}
                >
                  <View style={styles.resultHeader}>
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle}>{session.quiz.title}</Text>
                      <View style={styles.resultStatus}>
                        {getStatusIcon(session.status)}
                        <Text style={styles.resultStatusText}>
                          {getStatusText(session.status)}
                        </Text>
                      </View>
                    </View>
                    {session.score !== null && (
                      <View style={styles.scoreBadge}>
                        <Text style={[styles.scoreText, { color: getScoreColor(session.score) }]}>
                          {session.score}%
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.resultMeta}>
                    <View style={styles.metaItem}>
                      <Calendar size={16} color="#6b7280" />
                      <Text style={styles.metaText}>{formatDate(session.startTime)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <CheckCircle size={16} color="#6b7280" />
                      <Text style={styles.metaText}>{session.correctCount}/{session.totalQuestions}</Text>
                    </View>
                    {session.endTime && (
                      <View style={styles.metaItem}>
                        <Clock size={16} color="#6b7280" />
                        <Text style={styles.metaText}>
                          {Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)} min
                        </Text>
                      </View>
                    )}
                  </View>

                  {session.status === 'COMPLETED' && (
                    <TouchableOpacity
                      onPress={() => router.push(`/results/${session.id}` as any)}
                      style={styles.detailsButton}
                    >
                      <Trophy size={16} color="#3b82f6" />
                      <Text style={styles.detailsButtonText}>View Details</Text>
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
  filterContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 4,
    borderRadius: 12,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#3b82f6',
  },
  filterTabInactive: {
    backgroundColor: 'transparent',
  },
  filterTabText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: 'white',
  },
  filterTabTextInactive: {
    color: '#6b7280',
  },
  resultsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  resultsTitle: {
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
  resultsList: {
    gap: 16,
  },
  resultCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  resultCardActive: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  resultCardInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#f3f4f6',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  resultStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultStatusText: {
    fontSize: 14,
    color: '#6b7280',
  },
  scoreBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultMeta: {
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
  detailsButton: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  detailsButtonText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});
