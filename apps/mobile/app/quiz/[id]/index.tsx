import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert, AppState, BackHandler, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight, LayoutGrid, Info } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';

const { width } = Dimensions.get('window');

export default function QuizPlayScreen() {
    const { id: quizId } = useLocalSearchParams<{ id: string }>();
    const { api, apiUrl } = useAuth();
    const router = useRouter();

    const [quiz, setQuiz] = useState<any>(null);
    const [session, setSession] = useState<any>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [answers, setAnswers] = useState<any>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showReview, setShowReview] = useState(false);
    const [violationCount, setViolationCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const appState = useRef(AppState.currentState);
    const violationCountRef = useRef(0);

    const handleSubmit = useCallback(async (isAuto = false) => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            if (!session?.id) {
                Alert.alert('Error', 'Session not found. Please restart.');
                router.replace('/(tabs)/dashboard' as any);
                return;
            }

            const res = await api.post('/quiz/submit', { sessionId: session.id });

            if (res.status === 200 || res.status === 201) {
                router.replace({
                    pathname: '/(tabs)/results',
                    params: { sessionId: session.id }
                } as any);
            } else {
                Alert.alert('Error', res.data?.message || 'Submission failed');
                setIsSubmitting(false);
            }
        } catch (err: any) {
            console.error('Submission error:', err);
            Alert.alert('Error', 'An error occurred during submission');
            setIsSubmitting(false);
        }
    }, [isSubmitting, session?.id, router]);

    const fetchQuiz = useCallback(async () => {
        try {
            const res = await api.post('/quiz/start', { quizId });
            const data = res.data;

            if (res.status === 200 || res.status === 201) {
                setQuiz(data.quiz);
                setSession(data.session);
                setAnswers(data.session.answers || {});

                const durationSeconds = data.quiz.duration * 60;
                const elapsedSeconds = Math.floor((new Date().getTime() - new Date(data.session.startTime).getTime()) / 1000);
                const calculatedTimeLeft = durationSeconds - elapsedSeconds;

                setTimeLeft(calculatedTimeLeft > 0 ? calculatedTimeLeft : durationSeconds);
            } else {
                Alert.alert('Error', data.message || 'Failed to start quiz');
                router.back();
            }
        } catch (err: any) {
            console.error('Quiz fetch error:', err);
            Alert.alert('Error', 'An error occurred while starting the quiz');
            router.back();
        } finally {
            setIsLoading(false);
        }
    }, [quizId, router]);

    useEffect(() => {
        fetchQuiz();
    }, [fetchQuiz]);

    // Handle AppState changes (Violation Detection)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
                // Violation detected
                if (session && timeLeft > 0 && !isSubmitting) {
                    violationCountRef.current += 1;
                    const newCount = violationCountRef.current;
                    setViolationCount(newCount);

                    if (newCount === 1) {
                        Alert.alert('⚠️ Warning 1/2', 'Do not leave the quiz! This violation has been recorded.');
                    } else if (newCount === 2) {
                        Alert.alert('⚠️ Final Warning', 'Leaving the app again will result in automatic submission.');
                    } else if (newCount >= 3) {
                        Alert.alert('🚨 Auto-Submitting', 'Exam auto-submitting due to multiple violations.');
                        handleSubmit(true);
                    }
                }
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [session, timeLeft, isSubmitting, handleSubmit]);

    // Handle Back Button
    useEffect(() => {
        const backAction = () => {
            if (session && timeLeft > 0) {
                Alert.alert('Hold on!', 'Are you sure you want to exit? Your progress will be saved but the timer will keep running.', [
                    { text: 'Cancel', onPress: () => null, style: 'cancel' },
                    { text: 'YES', onPress: () => router.back() },
                ]);
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [session, timeLeft]);

    // Timer
    useEffect(() => {
        if (!quiz || !session || timeLeft <= 0 || isSubmitting) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, quiz, session, isSubmitting, handleSubmit]);

    const saveAnswer = async (questionId: string, option: string) => {
        const newAnswers = { ...answers, [questionId]: option };
        setAnswers(newAnswers);

        try {
            await api.post('/quiz/update-answer', {
                sessionId: session.id,
                questionId,
                selectedOption: option
            });
        } catch (err) {
            console.error('Auto-save failed');
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Initializing exam...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!quiz) return null;

    const currentQuestion = quiz.questions[currentIndex];
    const answeredCount = Object.keys(answers).length;
    const progressPct = (answeredCount / quiz.questions.length) * 100;

    const timerColor = timeLeft <= 60 ? '#ef4444' : timeLeft <= 300 ? '#f59e0b' : '#3b82f6';

    const renderReview = () => (
        <ScrollView style={styles.reviewContainer} contentContainerStyle={styles.reviewContent}>
            <Text style={styles.reviewTitle}>Review Answers</Text>
            <View style={styles.reviewStats}>
                <View style={styles.reviewStatCard}>
                    <Text style={styles.reviewStatValue}>{answeredCount}</Text>
                    <Text style={styles.reviewStatLabel}>Answered</Text>
                </View>
                <View style={[styles.reviewStatCard, { backgroundColor: '#fef2f2' }]}>
                    <Text style={[styles.reviewStatValue, { color: '#ef4444' }]}>{quiz.questions.length - answeredCount}</Text>
                    <Text style={[styles.reviewStatLabel, { color: '#ef4444' }]}>Skipped</Text>
                </View>
            </View>

            <View style={styles.questionNavGrid}>
                {quiz.questions.map((q: any, i: number) => (
                    <TouchableOpacity
                        key={q.id}
                        onPress={() => {
                            setCurrentIndex(i);
                            setShowReview(false);
                        }}
                        style={[
                            styles.navItem,
                            answers[q.id] ? styles.navItemAnswered : styles.navItemUnanswered,
                            currentIndex === i && styles.navItemCurrent
                        ]}
                    >
                        <Text style={[
                            styles.navText,
                            answers[q.id] ? styles.navTextAnswered : styles.navTextUnanswered,
                            currentIndex === i && styles.navTextCurrent
                        ]}>{i + 1}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.reviewActions}>
                <TouchableOpacity onPress={() => setShowReview(false)} style={styles.backToQuizButton}>
                    <Text style={styles.backToQuizText}>Back to Quiz</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => {
                        Alert.alert('Submit Exam', 'Are you sure you want to end your exam?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Submit', onPress: () => handleSubmit() }
                        ]);
                    }}
                    style={styles.finalSubmitButton}
                >
                    <Text style={styles.finalSubmitText}>Final Submission</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
                <View style={styles.progressSection}>
                    <Text style={styles.quizTitleShort}>{quiz.title}</Text>
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${progressPct}%` }]} />
                    </View>
                    <Text style={styles.progressText}>Question {currentIndex + 1} of {quiz.questions.length}</Text>
                </View>
                <View style={[styles.timerBadge, { borderColor: timerColor }]}>
                    <Clock size={16} color={timerColor} />
                    <Text style={[styles.timerText, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
                </View>
            </View>

            {showReview ? renderReview() : (
                <View style={styles.flex1}>
                    <ScrollView contentContainerStyle={styles.questionSection}>
                        <Text style={styles.questionText}>{currentQuestion.text}</Text>

                        <View style={styles.optionsList}>
                            {['A', 'B', 'C', 'D'].map((key) => {
                                const optionText = currentQuestion[`option${key}`];
                                if (!optionText) return null;
                                const isSelected = answers[currentQuestion.id] === key;

                                return (
                                    <TouchableOpacity
                                        key={key}
                                        onPress={() => saveAnswer(currentQuestion.id, key)}
                                        style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                                    >
                                        <View style={[styles.optionKey, isSelected && styles.optionKeySelected]}>
                                            <Text style={[styles.optionKeyText, isSelected && styles.optionKeyTextSelected]}>{key}</Text>
                                        </View>
                                        <Text style={[styles.optionTextContent, isSelected && styles.optionTextSelected]}>{optionText}</Text>
                                        {isSelected && <CheckCircle2 size={20} color="#3b82f6" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    <View style={styles.navigationFooter}>
                        <TouchableOpacity
                            onPress={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentIndex === 0}
                            style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
                        >
                            <ChevronLeft size={24} color={currentIndex === 0 ? '#cbd5e1' : '#64748b'} />
                            <Text style={[styles.navButtonText, currentIndex === 0 && styles.navButtonTextDisabled]}>Prev</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowReview(true)}
                            style={styles.reviewButton}
                        >
                            <LayoutGrid size={20} color="#3b82f6" />
                        </TouchableOpacity>

                        {currentIndex < quiz.questions.length - 1 ? (
                            <TouchableOpacity
                                onPress={() => setCurrentIndex(prev => prev + 1)}
                                style={[styles.navButton, styles.nextButton]}
                            >
                                <Text style={styles.nextButtonText}>Next</Text>
                                <ChevronRight size={24} color="#ffffff" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setShowReview(true)}
                                style={[styles.navButton, styles.finishButton]}
                            >
                                <Text style={styles.nextButtonText}>Review</Text>
                                <CheckCircle2 size={24} color="#ffffff" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    flex1: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: '600',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    progressSection: {
        flex: 1,
        marginRight: 16,
    },
    quizTitleShort: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#3b82f6',
    },
    progressText: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 2,
        backgroundColor: '#f8fafc',
    },
    timerText: {
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    questionSection: {
        padding: 24,
    },
    questionText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        lineHeight: 28,
        marginBottom: 32,
    },
    optionsList: {
        gap: 16,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        backgroundColor: '#f8fafc',
        borderWidth: 2,
        borderColor: '#f1f5f9',
    },
    optionCardSelected: {
        backgroundColor: '#eff6ff',
        borderColor: '#3b82f6',
    },
    optionKey: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        elevation: 1,
    },
    optionKeySelected: {
        backgroundColor: '#3b82f6',
    },
    optionKeyText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#64748b',
    },
    optionKeyTextSelected: {
        color: '#ffffff',
    },
    optionTextContent: {
        flex: 1,
        fontSize: 16,
        color: '#475569',
        fontWeight: '600',
    },
    optionTextSelected: {
        color: '#1e40af',
    },
    navigationFooter: {
        flexDirection: 'row',
        padding: 24,
        paddingBottom: 32,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    navButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    navButtonDisabled: {
        opacity: 0.5,
    },
    navButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#64748b',
    },
    navButtonTextDisabled: {
        color: '#cbd5e1',
    },
    reviewButton: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#dbeafe',
    },
    nextButton: {
        flex: 1,
        backgroundColor: '#1e293b',
        borderColor: '#1e293b',
    },
    finishButton: {
        flex: 1,
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    nextButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ffffff',
        marginHorizontal: 8,
    },
    reviewContainer: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    reviewContent: {
        padding: 24,
    },
    reviewTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 24,
    },
    reviewStats: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 32,
    },
    reviewStatCard: {
        flex: 1,
        padding: 16,
        borderRadius: 20,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
    },
    reviewStatValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#10b981',
    },
    reviewStatLabel: {
        fontSize: 12,
        color: '#10b981',
        fontWeight: '600',
        marginTop: 4,
    },
    questionNavGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 40,
    },
    navItem: {
        width: (width - 48 - 40) / 5,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    navItemAnswered: {
        backgroundColor: '#f0fdf4',
        borderColor: '#dcfce7',
    },
    navItemUnanswered: {
        backgroundColor: '#fef2f2',
        borderColor: '#fee2e2',
    },
    navItemCurrent: {
        borderColor: '#3b82f6',
        backgroundColor: '#eff6ff',
    },
    navText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    navTextAnswered: {
        color: '#166534',
    },
    navTextUnanswered: {
        color: '#991b1b',
    },
    navTextCurrent: {
        color: '#3b82f6',
    },
    reviewActions: {
        gap: 12,
        paddingBottom: 24,
    },
    backToQuizButton: {
        paddingVertical: 16,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        alignItems: 'center',
    },
    backToQuizText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#64748b',
    },
    finalSubmitButton: {
        paddingVertical: 16,
        borderRadius: 16,
        backgroundColor: '#10b981',
        alignItems: 'center',
    },
    finalSubmitText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ffffff',
    },
});
