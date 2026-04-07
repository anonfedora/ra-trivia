import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, AlertCircle, CheckCircle, Info, ArrowLeft, Play, Calendar, Repeat, Lock } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';

interface Quiz {
    id: string;
    title: string;
    duration: number;
    examCode?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    retakeLimit?: number | null;
    completedAttempts?: number;
    _count: {
        questions: number;
    };
}

export default function InstructionsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { api, apiUrl } = useAuth();
    const router = useRouter();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userExamCode, setUserExamCode] = useState('');

    useEffect(() => {
        fetchQuizDetails();
    }, [id]);

    const fetchQuizDetails = async () => {
        if (!id) return;
        
        try {
            const [quizRes, sessionRes] = await Promise.all([
                api.get(`/quizzes/${id}`),
                api.get('/quiz/my-sessions')
            ]);

            const quizData = quizRes.data;
            const sessionsData = sessionRes.data;

            // Check scheduling
            const now = new Date();
            if (quizData.startDate && now < new Date(quizData.startDate)) {
                Alert.alert('Not Started', 'This quiz has not started yet. Please check back later.');
                router.back();
                return;
            }

            if (quizData.endDate && now > new Date(quizData.endDate)) {
                Alert.alert('Ended', 'This quiz has ended. You can no longer take this exam.');
                router.back();
                return;
            }

            // Check retake limit
            const completedAttempts = sessionsData.filter((s: any) => s.quizId === id && s.status === 'COMPLETED').length;
            if (quizData.retakeLimit !== null && quizData.retakeLimit !== undefined && completedAttempts >= quizData.retakeLimit) {
                Alert.alert('Limit Reached', 'You have reached the maximum number of attempts for this quiz.');
                router.back();
                return;
            }

            setQuiz({ ...quizData, completedAttempts });
        } catch (err) {
            console.error('Failed to fetch quiz details:', err);
            Alert.alert('Error', 'Could not load quiz details. Please try again.');
            router.back();
        } finally {
            setIsLoading(false);
        }
    };

    const formatDateTime = (value: string) => {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getScheduleLabel = () => {
        if (!quiz) return '';
        const start = quiz.startDate ? formatDateTime(quiz.startDate) : null;
        const end = quiz.endDate ? formatDateTime(quiz.endDate) : null;

        if (start && end) return `${start} - ${end}`;
        if (start) return `From ${start}`;
        if (end) return `Until ${end}`;
        return 'Anytime';
    };

    const getTriesLabel = () => {
        if (!quiz) return '';
        if (quiz.retakeLimit === null || quiz.retakeLimit === undefined) return 'Unlimited';
        const completed = quiz.completedAttempts || 0;
        const remaining = Math.max(0, quiz.retakeLimit - completed);
        if (remaining === 0) return '0 tries left';
        if (remaining === 1) return '1 try left';
        return `${remaining} tries left`;
    };

    const handleStartExam = () => {
        if (!quiz) return;

        if (quiz.examCode && !userExamCode) {
            Alert.alert('Code Required', 'Please enter the access code to start this exam.');
            return;
        }

        router.push({
            pathname: `/quiz/${quiz.id}`,
            params: { code: userExamCode }
        } as any);
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

    if (!quiz) return null;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <View style={styles.headerIconContainer}>
                    <Info size={32} color="#3b82f6" />
                </View>
                <Text style={styles.title}>{quiz.title}</Text>
                <Text style={styles.subtitle}>Read instructions carefully before starting.</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Exam Code Section */}
                {quiz.examCode && (
                    <View style={styles.examCodeContainer}>
                        <View style={styles.examCodeHeader}>
                            <Lock size={18} color="#3b82f6" />
                            <Text style={styles.examCodeTitle}>ACCESS CODE REQUIRED</Text>
                        </View>
                        <TextInput
                            style={styles.examCodeInput}
                            value={userExamCode}
                            onChangeText={setUserExamCode}
                            placeholder="Enter code from admin"
                            placeholderTextColor="#94a3b8"
                            autoCapitalize="characters"
                            secureTextEntry={false}
                            autoComplete="off"
                        />
                        <Text style={styles.examCodeHint}>Contact admin if you don't have a code.</Text>
                    </View>
                )}

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <View style={styles.statIconBadge}>
                            <Clock size={20} color="#3b82f6" />
                        </View>
                        <Text style={styles.statLabel}>Duration</Text>
                        <Text style={styles.statValue}>{quiz.duration} Min</Text>
                    </View>
                    <View style={styles.statCard}>
                        <View style={styles.statIconBadge}>
                            <AlertCircle size={20} color="#3b82f6" />
                        </View>
                        <Text style={styles.statLabel}>Questions</Text>
                        <Text style={styles.statValue}>{quiz._count.questions}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <View style={styles.statIconBadge}>
                            <Calendar size={20} color="#3b82f6" />
                        </View>
                        <Text style={styles.statLabel}>Schedule</Text>
                        <Text style={styles.statValueCompact}>{getScheduleLabel()}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <View style={styles.statIconBadge}>
                            <Repeat size={20} color="#3b82f6" />
                        </View>
                        <Text style={styles.statLabel}>Attempts</Text>
                        <Text style={styles.statValueCompact}>{getTriesLabel()}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <CheckCircle size={18} color="#10b981" />
                        <Text style={styles.sectionTitle}>Exam Guidelines</Text>
                    </View>
                    <View style={styles.guidelinesList}>
                        {[
                            "The timer starts immediately after you click 'Start Exam'.",
                            "Answers are automatically saved as you navigate.",
                            "You can move back and forth to review answers.",
                            "Ensure you have a stable internet connection.",
                            "The exam will auto-submit when the timer expires."
                        ].map((rule, i) => (
                            <View key={i} style={styles.guidelineItem}>
                                <CheckCircle size={14} color="#10b981" style={styles.guidelineIcon} />
                                <Text style={styles.guidelineText}>{rule}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={[styles.section, styles.cheatSection]}>
                    <View style={styles.sectionHeader}>
                        <AlertCircle size={18} color="#ef4444" />
                        <Text style={[styles.sectionTitle, styles.cheatTitle]}>Anti-Cheat Rules</Text>
                    </View>
                    <View style={styles.cheatList}>
                        {[
                            "Minimizing the app screen is detected and logged.",
                            "Screenshots or screen recording may be blocked/logged.",
                            "Do not close the app — the timer keeps running.",
                            "Each violation is recorded for examiner review.",
                            "Using external tools or AI aids is strictly prohibited."
                        ].map((rule, i) => (
                            <View key={i} style={styles.guidelineItem}>
                                <AlertCircle size={14} color="#ef4444" style={styles.guidelineIcon} />
                                <Text style={[styles.guidelineText, styles.cheatText]}>{rule}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleStartExam}
                    style={styles.startButton}
                >
                    <Play size={20} color="white" fill="white" />
                    <Text style={styles.startButtonText}>Start My Exam</Text>
                </TouchableOpacity>

                <Text style={styles.footerText}>
                    By starting the exam, you agree to all the rules.
                </Text>
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
    header: {
        padding: 24,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: {
        position: 'absolute',
        top: 24,
        left: 24,
        padding: 8,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
    },
    headerIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center',
    },
    scrollContent: {
        padding: 24,
    },
    examCodeContainer: {
        backgroundColor: '#eff6ff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    examCodeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    examCodeTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#3b82f6',
        letterSpacing: 1.2,
    },
    examCodeInput: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        borderWidth: 1,
        borderColor: '#dbeafe',
        textAlign: 'center',
        letterSpacing: 4,
    },
    examCodeHint: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center',
        fontWeight: '500',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        width: '48%',
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    statIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    statValueCompact: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    guidelinesList: {
        backgroundColor: '#f0fdf4',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#dcfce7',
    },
    guidelineItem: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    guidelineIcon: {
        marginTop: 2,
    },
    guidelineText: {
        flex: 1,
        fontSize: 13,
        color: '#166534',
        lineHeight: 18,
    },
    cheatSection: {
        marginBottom: 32,
    },
    cheatTitle: {
        color: '#ef4444',
    },
    cheatList: {
        backgroundColor: '#fef2f2',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    cheatText: {
        color: '#991b1b',
    },
    startButton: {
        backgroundColor: '#3b82f6',
        paddingVertical: 18,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    startButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footerText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 16,
        paddingBottom: 20,
    },
});
