/// <reference types="nativewind/types" />
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogIn, Mail, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
// LinearGradient and other components are now pre-registered in _layout.tsx

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const { signIn } = useAuth();
    const router = useRouter();

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            setError('Please enter both email and password');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const data = await signIn(email.trim(), password);

            if (data?.isUnverified) {
                router.push({
                    pathname: '/verify',
                    params: { email: email.trim() }
                });
                return;
            }

            // If verified, navigate to dashboard
            router.replace('/(tabs)/dashboard' as any);
        } catch (err: any) {
            setError(typeof err === 'string' ? err : 'Unable to connect to the server');
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
                        {/* Hero Section */}
                        <View className="items-center mb-12">
                            <View className="relative">
                                <View className="w-24 h-24 bg-blue-500/10 rounded-[32px] items-center justify-center mb-6 border border-blue-500/20">
                                    <LogIn size={44} color="#3b82f6" />
                                </View>
                                <View className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1.5 border-4 border-slate-900">
                                    <ShieldCheck size={16} color="white" />
                                </View>
                            </View>

                            <Text className="text-4xl font-bold text-slate-50 tracking-tight mb-3">
                                Welcome Back
                            </Text>
                            <Text className="text-slate-400 text-lg text-center font-medium max-w-[280px]">
                                Please enter your credentials to access the exams portal.
                            </Text>
                        </View>

                        {/* Form Section */}
                        <View className="space-y-6">
                            <View>
                                <View className="flex-row justify-between mb-3 px-1">
                                    <Text className="text-sm font-semibold text-slate-300 ml-1">Email Address</Text>
                                    <Sparkles size={14} color="#3b82f6" />
                                </View>

                                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
                                    <Mail size={22} color="#64748b" />
                                    <TextInput
                                        className="flex-1 ml-4 text-slate-50 font-medium text-lg"
                                        placeholder="e.g. john@example.com"
                                        placeholderTextColor="#475569"
                                        value={email}
                                        onChangeText={(text) => {
                                            setEmail(text);
                                            setError(null);
                                        }}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>
                            </View>

                            <View>
                                <View className="flex-row justify-between mb-3 px-1">
                                    <Text className="text-sm font-semibold text-slate-300 ml-1">Password</Text>
                                    <ShieldCheck size={14} color="#3b82f6" />
                                </View>

                                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
                                    <LogIn size={22} color="#64748b" />
                                    <TextInput
                                        className="flex-1 ml-4 text-slate-50 font-medium text-lg"
                                        placeholder="••••••••"
                                        placeholderTextColor="#475569"
                                        value={password}
                                        onChangeText={(text) => {
                                            setPassword(text);
                                            setError(null);
                                        }}
                                        secureTextEntry={!showPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Text className="text-blue-500 font-bold text-xs uppercase ml-2">{showPassword ? 'Hide' : 'Show'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {error && (
                                <View className="bg-red-900/20 border border-red-900/50 p-4 rounded-2xl flex-row items-center space-x-3 mt-4">
                                    <View className="w-2 h-2 rounded-full bg-red-500" />
                                    <Text className="text-red-400 font-medium text-sm flex-1">{error}</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                onPress={handleLogin}
                                disabled={isLoading}
                                activeOpacity={0.8}
                                className="w-full mt-6"
                            >
                                <View className={`h-16 rounded-2xl shadow-xl items-center justify-center flex-row space-x-3 ${isLoading ? 'bg-slate-700' : 'bg-blue-600 shadow-blue-600/20'}`}>
                                    {isLoading ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-bold text-xl">Sign In</Text>
                                            <ArrowRight size={22} color="white" />
                                        </>
                                    )}
                                </View>
                            </TouchableOpacity>

                            <View className="flex-row items-center justify-center space-x-2 py-8">
                                <View className="h-[1px] flex-1 bg-slate-800" />
                                <Text className="text-slate-600 font-bold text-[10px] tracking-widest uppercase px-3">Secure Access Policy</Text>
                                <View className="h-[1px] flex-1 bg-slate-800" />
                            </View>

                            {/* Registration Prompt - Aligned with Web */}
                            <View className="mt-4 p-6 bg-slate-900 rounded-[2.5rem] border border-slate-800">
                                <View className="items-center mb-4">
                                    <Text className="text-xl font-bold text-slate-50 mb-2 text-center">New Candidate?</Text>
                                    <Text className="text-slate-400 text-sm text-center">Create your account to take Exam</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => router.push('/register')}
                                    activeOpacity={0.8}
                                    className="w-full py-5 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-600/20 items-center"
                                >
                                    <Text className="text-white font-bold text-lg">Create New Account</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Footer */}
                        <View className="mt-12 items-center">
                            <View className="flex-row items-center space-x-2 opacity-40">
                                <ShieldCheck size={14} color="#64748b" />
                                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                                    Enterprise Grade Security
                                </Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
