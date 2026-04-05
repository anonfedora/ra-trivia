/// <reference types="nativewind/types" />
import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Mail, RefreshCcw, ArrowRight, KeyRound, Sparkles } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

// Styling interop is now pre-registered in _layout.tsx

export default function VerifyScreen() {
    const params = useLocalSearchParams<{ email?: string }>();
    const initialEmail = useMemo(() => (typeof params.email === 'string' ? params.email : ''), [params.email]);
    const [email, setEmail] = useState(initialEmail);
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { verifyOtp, apiUrl } = useAuth();

    const handleVerify = async () => {
        if (!email.trim() || !otp.trim()) {
            setError('Please enter both your email and the 6-digit verification code');
            return;
        }

        if (otp.length < 6) {
            setError('The verification code must be 6 digits');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await verifyOtp(email.trim(), otp.trim());
            router.replace('/(tabs)/dashboard' as any);
        } catch (err: any) {
            setError(typeof err === 'string' ? err : 'Invalid verification code. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const resendCode = async () => {
        if (!email.trim()) {
            setError('Email address is required to resend the code');
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            if (!response.ok) throw new Error('Failed to resend code');
        } catch (err: any) {
            setError(err.message || 'Unable to resend code. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-900">
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                className="flex-1"
            >
                <ScrollView 
                    contentContainerStyle={{ flexGrow: 1 }} 
                    className="p-8"
                    showsVerticalScrollIndicator={false}
                >
                    <View className="flex-1 justify-center py-10">
                        {/* Header */}
                        <View className="items-center mb-12">
                            <View className="relative">
                                <View className="w-24 h-24 bg-blue-500/10 rounded-[32px] items-center justify-center mb-6 border border-blue-500/20">
                                    <ShieldCheck size={44} color="#3b82f6" />
                                </View>
                                <View className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1.5 border-4 border-slate-900">
                                    <KeyRound size={16} color="white" />
                                </View>
                            </View>
                            <Text className="text-4xl font-bold text-slate-50 tracking-tight mb-3">
                                Verify Account
                            </Text>
                            <Text className="text-slate-400 text-lg text-center font-medium max-w-[280px]">
                                Enter the 6-digit secure code sent to your email
                            </Text>
                        </View>

                        <View className="space-y-6">
                            {/* Email Field (ReadOnly) */}
                            <View>
                                <Text className="text-sm font-semibold text-slate-300 mb-2 ml-1">Target Account</Text>
                                <View className="flex-row items-center bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 shadow-sm opacity-60">
                                    <Mail size={20} color="#64748b" />
                                    <TextInput
                                        className="flex-1 ml-4 text-slate-50 font-medium text-base"
                                        value={email}
                                        editable={false}
                                    />
                                </View>
                            </View>

                            {/* OTP Input */}
                            <View>
                                <View className="flex-row justify-between mb-2 px-1">
                                    <Text className="text-sm font-semibold text-slate-300 ml-1">Security Code</Text>
                                    <Sparkles size={14} color="#3b82f6" />
                                </View>
                                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5 shadow-inner">
                                    <KeyRound size={22} color="#3b82f6" />
                                    <TextInput
                                        className="flex-1 ml-4 text-slate-50 font-bold text-3xl tracking-[12px]"
                                        placeholder="XXXXXX"
                                        placeholderTextColor="#1e293b"
                                        value={otp}
                                        onChangeText={(text) => {
                                            setOtp(text);
                                            setError(null);
                                        }}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        autoFocus={true}
                                    />
                                </View>
                            </View>

                            {error && (
                                <View className="bg-red-900/20 border border-red-900/50 p-4 rounded-2xl flex-row items-center space-x-3 mt-4">
                                    <View className="w-2 h-2 rounded-full bg-red-500" />
                                    <Text className="text-red-400 font-medium text-sm flex-1">{error}</Text>
                                </View>
                            )}

                            {/* Verify Button */}
                            <TouchableOpacity
                                onPress={handleVerify}
                                disabled={isLoading}
                                activeOpacity={0.8}
                                className="w-full mt-2"
                            >
                                <View className={`h-16 rounded-2xl shadow-xl items-center justify-center flex-row space-x-3 ${isLoading ? 'bg-slate-700' : 'bg-blue-600 shadow-blue-600/20'}`}>
                                    {isLoading ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-bold text-xl">Verify & Sign In</Text>
                                            <ArrowRight size={20} color="white" />
                                        </>
                                    )}
                                </View>
                            </TouchableOpacity>

                            {/* Resend Action */}
                            <TouchableOpacity
                                onPress={resendCode}
                                disabled={isLoading}
                                activeOpacity={0.7}
                                className="w-full py-5 rounded-2xl items-center bg-slate-900 border border-slate-800 flex-row justify-center space-x-2"
                            >
                                <RefreshCcw size={18} color="#64748b" />
                                <Text className="text-slate-400 font-bold text-base">Request New Code</Text>
                            </TouchableOpacity>

                            {/* Back to Login */}
                            <View className="flex-row justify-center mt-6 pt-6 border-t border-slate-800">
                                <TouchableOpacity onPress={() => router.push('/login')}>
                                    <Text className="text-slate-500 font-bold text-sm">Wrong email address?</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Footer */}
                        <View className="mt-12 items-center">
                            <Text className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                                Protected by Encryption Protocol
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
