import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogIn, Mail } from 'lucide-react-native';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { apiUrl } = useAuth();
    const router = useRouter();

    const handleLogin = async () => {
        if (!email.trim()) {
            setError('Please enter your email');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // In this system, login triggers an OTP to be sent
            // The web app handles this by redirecting to verify with the email pre-filled
            await fetch(`${apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });

            router.push({
                pathname: '/verify',
                params: { email: email.trim() }
            });
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="p-6">
                    <View className="flex-1 justify-center">
                        <View className="items-center mb-10">
                            <View className="w-20 h-20 bg-primary/10 rounded-3xl items-center justify-center mb-4">
                                <LogIn size={40} color="#0f172a" />
                            </View>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50">Welcome Back</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 text-center">
                                Enter your email to receive a login code
                            </p>
                        </View>

                        <View className="space-y-4">
                            <View>
                                <Text className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Email Address</Text>
                                <View className="flex-row items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4">
                                    <Mail size={20} color="#94a3b8" />
                                    <TextInput
                                        className="flex-1 ml-3 text-slate-900 dark:text-slate-50 font-medium"
                                        placeholder="name@example.com"
                                        placeholderTextColor="#94a3b8"
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>
                            </View>

                            {error && (
                                <View className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                                    <Text className="text-rose-600 font-bold text-sm text-center">{error}</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                onPress={handleLogin}
                                disabled={isLoading}
                                className={`w-full py-4 rounded-2xl shadow-lg items-center ${isLoading ? 'bg-slate-400' : 'bg-primary'}`}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <Text className="text-white font-bold text-lg">Send Login Code</Text>
                                )}
                            </TouchableOpacity>

                            {/* Prominent Registration Section */}
                            <View className="mt-8 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <Text className="text-lg font-bold text-slate-900 dark:text-slate-50 text-center mb-2">New Candidate?</Text>
                                <Text className="text-slate-600 dark:text-slate-400 text-sm text-center mb-4">Create your account to take Exam</Text>
                                <TouchableOpacity
                                    onPress={() => router.push('/register')}
                                    className="w-full py-4 bg-emerald-600 rounded-2xl shadow-lg items-center"
                                >
                                    <Text className="text-white font-bold text-lg">Create New Account</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
