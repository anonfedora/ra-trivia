/// <reference types="nativewind/types" />
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Share, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, XCircle, Home, Award, BookOpen, TrendingUp, Share2, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

// Global interop is now pre-registered in _layout.tsx

interface QuestionBreakdown {
    questionId: string;
    text: string;
    options: { key: string; text: string }[];
    selectedOption: string | null;
    correctOption: string;
    isCorrect: boolean;
}

interface SessionResult {
    id: string;
    score: number | null;
    totalQuestions: number;
    correctCount: number;
    incorrectCount: number;
    quiz: { title: string };
    breakdown: QuestionBreakdown[];
}

export default function ResultDetailScreen() {
    const { id: sessionId } = useLocalSearchParams<{ id: string }>();
    const { api, apiUrl } = useAuth();
    const router = useRouter();

    const [result, setResult] = useState<SessionResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lockedAt, setLockedAt] = useState<string | null>(null);

    const fetchSession = useCallback(async () => {
        if (!sessionId) { setIsLoading(false); return; }
        try {
            const res = await api.get(`/quiz/session/${sessionId}`);
            if (res.status === 423) {
                setLockedAt(res.data.releaseAt);
            } else if (res.status === 200) {
                setResult(res.data);
            }
        } catch (err: any) {
            console.error('Failed to fetch result:', err);
            if (err.response?.status === 423) {
                setLockedAt(err.response.data.releaseAt);
            } else {
                Alert.alert('Error', 'Failed to load details');
            }
        } finally {
            setIsLoading(false);
        }
    }, [sessionId, api]);

    useEffect(() => { fetchSession(); }, [fetchSession]);

    const handleShare = async () => {
        if (!result) return;
        const percentage = result.score ?? 0;
        const verifyUrl = `https://ra-trivia.vercel.app/verify/${result.id}`; 
        
        try {
            await Share.share({
                message: `Certified Result: I completed ${result.quiz.title} with a score of ${percentage.toFixed(1)}%! 🏆\n\nVerification Token: ${result.id}`,
                url: verifyUrl,
                title: 'Official Selection Result'
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </SafeAreaView>
        );
    }

    if (lockedAt) {
        const releaseDate = new Date(lockedAt);
        return (
            <SafeAreaView className="flex-1 bg-slate-950">
                <LinearGradient colors={['#0f172a', '#020617']} className="flex-1 items-center justify-center p-8">
                    <View className="w-24 h-24 bg-amber-500/10 rounded-[32px] items-center justify-center mb-8 border border-amber-500/20">
                         <BookOpen size={48} color="#f59e0b" />
                    </View>
                    <Text className="text-3xl font-black text-white text-center mb-4">Results Locked</Text>
                    <Text className="text-slate-400 text-center font-medium leading-relaxed mb-10 px-4">
                        Your submission is being processed. Official results are released daily according to the curriculum schedule.
                    </Text>
                    <View className="bg-slate-900 border border-white/5 p-8 rounded-[32px] w-full items-center mb-10">
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Available On</Text>
                        <Text className="text-xl font-black text-blue-500">
                             {releaseDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => router.replace('/(tabs)/dashboard' as any)} 
                        className="bg-blue-600 w-full py-5 rounded-2xl items-center shadow-lg shadow-blue-500/20"
                    >
                        <Text className="text-white font-bold text-base">Return to Dashboard</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </SafeAreaView>
        );
    }

    if (!result) return null;

    const percentage = result.score ?? 0;
    const isPassed = percentage >= 50;

    return (
        <SafeAreaView className="flex-1 bg-slate-950">
            <LinearGradient colors={['#0f172a', '#020617']} className="flex-1">
                <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
                    {/* Header Card */}
                    <View className="bg-slate-900/60 rounded-[40px] border border-white/10 mt-10 p-8 shadow-2xl relative overflow-hidden">
                        <View className={`absolute top-0 left-0 right-0 h-1.5 ${isPassed ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        
                        <View className="flex-row justify-between items-center mb-8">
                            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-slate-800 rounded-xl items-center justify-center border border-white/5">
                                <Home size={18} color="#94a3b8" />
                            </TouchableOpacity>
                            <View className={`px-4 py-1.5 rounded-full border ${isPassed ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                <Text className={`text-[10px] font-black tracking-widest uppercase ${isPassed ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {isPassed ? 'Passed' : 'Failed'}
                                </Text>
                            </View>
                        </View>

                        <View className="items-center mb-10">
                            <View className={`w-24 h-24 rounded-full items-center justify-center mb-6 ${isPassed ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                {isPassed ? <Award size={56} color="#10b981" /> : <XCircle size={56} color="#ef4444" />}
                            </View>
                            <Text className="text-2xl font-black text-white text-center leading-tight mb-2">{result.quiz.title}</Text>
                            <Text className="text-slate-500 text-xs font-bold uppercase tracking-widest">Final Selection Record</Text>
                        </View>

                        {/* Stats Segment */}
                        <View className="flex-row space-x-3 mb-8">
                            <View className="flex-1 bg-slate-950/50 p-4 rounded-3xl border border-white/5 items-center">
                                <TrendingUp size={16} color="#3b82f6" />
                                <Text className="text-slate-600 text-[8px] font-black uppercase tracking-tighter my-2">Final Score</Text>
                                <Text className="text-xl font-black text-white">{percentage.toFixed(1)}%</Text>
                            </View>
                            <View className="flex-1 bg-slate-950/50 p-4 rounded-3xl border border-white/5 items-center">
                                <CheckCircle2 size={16} color="#10b981" />
                                <Text className="text-slate-600 text-[8px] font-black uppercase tracking-tighter my-2">Correct</Text>
                                <Text className="text-xl font-black text-white">{result.correctCount}</Text>
                            </View>
                            <View className="flex-1 bg-slate-950/50 p-4 rounded-3xl border border-white/5 items-center">
                                <XCircle size={16} color="#f43f5e" />
                                <Text className="text-slate-600 text-[8px] font-black uppercase tracking-tighter my-2">Missed</Text>
                                <Text className="text-xl font-black text-white">{result.incorrectCount}</Text>
                            </View>
                        </View>

                        <TouchableOpacity onPress={handleShare} className="bg-blue-600 py-5 rounded-2xl flex-row items-center justify-center space-x-3 shadow-lg shadow-blue-500/20">
                            <Share2 size={18} color="white" />
                            <Text className="text-white font-bold text-base">Verify Official Transcript</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Breakdown Section */}
                    <View className="mt-12">
                        <View className="flex-row justify-between items-center mb-8 px-2">
                             <Text className="text-xl font-black text-white">Itemized Review</Text>
                             <Sparkles size={18} color="#3b82f6" />
                        </View>

                        <View className="space-y-4">
                            {result.breakdown.map((item, idx) => (
                                <View key={item.questionId} className="bg-slate-900/30 p-6 rounded-[32px] border border-white/5">
                                    <View className="flex-row items-center space-x-4 mb-5">
                                        <View className="w-8 h-8 bg-slate-800 rounded-xl items-center justify-center">
                                            <Text className="text-slate-500 font-black text-xs">{idx + 1}</Text>
                                        </View>
                                        <Text className="flex-1 text-white font-bold text-base leading-snug">{item.text}</Text>
                                        {item.isCorrect ? (
                                            <CheckCircle2 size={22} color="#10b981" />
                                        ) : (
                                            <XCircle size={22} color="#ef4444" />
                                        )}
                                    </View>

                                    <View className="space-y-3">
                                        {item.options.map(opt => {
                                            const isSelected = item.selectedOption === opt.key;
                                            const isCorrect = item.correctOption === opt.key;

                                            return (
                                                <View
                                                    key={opt.key}
                                                    className={`flex-row items-center space-x-4 p-4 rounded-2xl border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/20' : isSelected ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-950/20 border-transparent'}`}
                                                >
                                                    <View className={`w-6 h-6 rounded-lg items-center justify-center ${isCorrect ? 'bg-emerald-500' : isSelected ? 'bg-rose-500' : 'bg-slate-800'}`}>
                                                        <Text className="text-white font-black text-[10px]">{opt.key}</Text>
                                                    </View>
                                                    <Text className={`flex-1 text-sm font-medium ${isCorrect ? 'text-emerald-500 font-bold' : isSelected ? 'text-rose-500 font-bold' : 'text-slate-500'}`}>
                                                        {opt.text}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Back to Dashboard */}
                    <TouchableOpacity 
                        onPress={() => router.replace('/(tabs)/dashboard' as any)}
                        className="mt-12 bg-slate-900 py-6 rounded-[32px] border border-white/5 flex-row items-center justify-center space-x-3"
                    >
                        <Home size={20} color="#64748b" />
                        <Text className="text-slate-400 font-black uppercase tracking-widest text-sm">Dashboard</Text>
                    </TouchableOpacity>
                </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
}
