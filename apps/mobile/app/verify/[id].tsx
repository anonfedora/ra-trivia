import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, AlertCircle, Calendar, GraduationCap, Trophy, ShieldCheck, MapPin, Users, Home } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import Svg, { Circle } from 'react-native-svg';

interface VerificationData {
    candidateName: string;
    examTitle: string;
    score: number;
    completedAt: string;
    status: string;
    church: string | null;
    association: string | null;
    userType: string;
}

export default function VerificationScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { apiUrl } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<VerificationData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const formatUserType = (type: string) => {
        return type
            .replace(/_/g, ' ')
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    useEffect(() => {
        const verifyResult = async () => {
            try {
                const res = await fetch(`${apiUrl}/quiz/verify/${id}`);
                if (res.ok) {
                    const result = await res.json();
                    setData(result);
                } else {
                    setError('This result could not be verified. Please check the link or QR code.');
                }
            } catch (err) {
                setError('A connection error occurred. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        if (id) verifyResult();
    }, [id, apiUrl]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !data) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <AlertCircle size={64} color="#ef4444" />
                    <Text style={styles.errorTitle}>Verification Failed</Text>
                    <Text style={styles.errorSubtitle}>{error}</Text>
                    <TouchableOpacity onPress={() => router.replace('/(tabs)/dashboard' as any)} style={styles.errorButton}>
                        <Text style={styles.errorButtonText}>Go to Dashboard</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const radius = 56;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (circumference * data.score) / 100;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerStrip} />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <View style={styles.verificationBadge}>
                        <View style={styles.iconCircle}>
                            <ShieldCheck size={56} color="#10b981" />
                        </View>
                        <View style={styles.checkSeal}>
                            <CheckCircle2 size={16} color="#ffffff" />
                        </View>
                    </View>

                    <Text style={styles.recordLabel}>Official Examination Record</Text>
                    <Text style={styles.verifiedTitle}>Verified Result</Text>

                    <View style={styles.candidateSection}>
                        <Text style={styles.sectionLabel}>CANDIDATE NAME</Text>
                        <Text style={styles.candidateName}>{data.candidateName}</Text>
                        {data.church && (
                            <View style={styles.churchInfo}>
                                <MapPin size={14} color="#3b82f6" />
                                <Text style={styles.churchText}>{data.church}</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}>
                            <View style={styles.detailIcon}>
                                <GraduationCap size={20} color="#3b82f6" />
                            </View>
                            <View>
                                <Text style={styles.detailLabel}>EXAMINATION</Text>
                                <Text style={styles.detailValue}>{data.examTitle}</Text>
                            </View>
                        </View>

                        <View style={styles.detailItem}>
                            <View style={styles.detailIcon}>
                                <Calendar size={20} color="#3b82f6" />
                            </View>
                            <View>
                                <Text style={styles.detailLabel}>COMPLETION DATE</Text>
                                <Text style={styles.detailValue}>
                                    {new Date(data.completedAt).toLocaleDateString(undefined, {
                                        month: 'long',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.detailItem}>
                            <View style={[styles.detailIcon, { backgroundColor: '#f0fdf4' }]}>
                                <Trophy size={20} color="#10b981" />
                            </View>
                            <View>
                                <Text style={styles.detailLabel}>EXAM TYPE</Text>
                                <Text style={styles.detailValue}>{formatUserType(data.userType)}</Text>
                            </View>
                        </View>

                        <View style={styles.detailItem}>
                            <View style={[styles.detailIcon, { backgroundColor: '#fff7ed' }]}>
                                <Users size={20} color="#f59e0b" />
                            </View>
                            <View>
                                <Text style={styles.detailLabel}>ASSOCIATION</Text>
                                <Text style={styles.detailValue}>{data.association || 'Not Specified'}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.scoreSection}>
                        <View style={styles.scoreCircle}>
                            <Svg width="128" height="128" viewBox="0 0 128 128">
                                <Circle
                                    cx="64"
                                    cy="64"
                                    r={radius}
                                    stroke="#f1f5f9"
                                    strokeWidth="8"
                                    fill="none"
                                />
                                <Circle
                                    cx="64"
                                    cy="64"
                                    r={radius}
                                    stroke="#10b981"
                                    strokeWidth="8"
                                    fill="none"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    transform="rotate(-90 64 64)"
                                />
                            </Svg>
                            <View style={styles.scoreTextContainer}>
                                <Text style={styles.scoreValue}>{data.score.toFixed(1)}%</Text>
                            </View>
                        </View>
                        <View style={[
                            styles.statusBadge,
                            { backgroundColor: data.status === 'Cleared' ? '#f0fdf4' : '#fef2f2' }
                        ]}>
                            <Text style={[
                                styles.statusBadgeText,
                                { color: data.status === 'Cleared' ? '#10b981' : '#ef4444' }
                            ]}>{data.status.toUpperCase()}</Text>
                        </View>
                    </View>

                    <View style={styles.idSection}>
                        <Text style={styles.idLabel}>VERIFICATION ID</Text>
                        <View style={styles.idBadge}>
                            <Text style={styles.idText}>{id}</Text>
                        </View>
                        <Text style={styles.disclaimer}>
                            This examination record is authentic and was generated by the RA Trivia automated examination system.
                        </Text>
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={() => router.replace('/(tabs)/dashboard' as any)}
                    style={styles.homeButton}
                >
                    <Home size={20} color="#ffffff" />
                    <Text style={styles.homeButtonText}>Return Home</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    headerStrip: {
        height: 6,
        backgroundColor: '#3b82f6',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 20,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 40,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
        marginBottom: 24,
    },
    verificationBadge: {
        marginBottom: 24,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#f0fdf4',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkSeal: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#10b981',
        padding: 4,
        borderRadius: 999,
        borderWidth: 3,
        borderColor: '#ffffff',
    },
    recordLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 8,
    },
    verifiedTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 32,
    },
    candidateSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#94a3b8',
        marginBottom: 8,
    },
    candidateName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        textAlign: 'center',
    },
    churchInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    churchText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    detailsGrid: {
        width: '100%',
        paddingVertical: 32,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
        gap: 24,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    detailIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    detailLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#94a3b8',
    },
    detailValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    scoreSection: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    scoreCircle: {
        width: 128,
        height: 128,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scoreTextContainer: {
        position: 'absolute',
        alignItems: 'center',
    },
    scoreValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
    },
    statusBadge: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 999,
        marginTop: 16,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    idSection: {
        width: '100%',
        alignItems: 'center',
        gap: 12,
    },
    idLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#cbd5e1',
    },
    idBadge: {
        backgroundColor: '#f8fafc',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    idText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#94a3b8',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    disclaimer: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 18,
        marginTop: 12,
    },
    homeButton: {
        backgroundColor: '#0f172a',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 18,
        borderRadius: 20,
        marginBottom: 40,
    },
    homeButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
        marginTop: 24,
        marginBottom: 12,
    },
    errorSubtitle: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    errorButton: {
        backgroundColor: '#0f172a',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    errorButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
