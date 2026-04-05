/// <reference types="nativewind/types" />
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserPlus, Mail, Church, ArrowRight, User, Globe, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import UserTypeSelector, { UserType } from '../components/UserTypeSelector';
import { LinearGradient } from 'expo-linear-gradient';
// Styling interop is now pre-registered in _layout.tsx

export default function RegisterScreen() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [church, setChurch] = useState('');
    const [association, setAssociation] = useState('');
    const [userType, setUserType] = useState<UserType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();
    const { signUp } = useAuth();

    const handleRegister = async () => {
        if (!name.trim() || !email.trim() || !password || !church.trim() || !association.trim() || !userType) {
            setError('Please complete all fields and select your examination type');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await signUp(name.trim(), email.trim(), password, church.trim(), association.trim(), userType);
            router.push({ pathname: '/verify', params: { email: email.trim() } });
        } catch (err: any) {
            setError(typeof err === 'string' ? err : 'Registration failed. Please verify your details.');
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
                    <View className="flex-1 justify-center py-6">
                        {/* Header */}
                        <View className="items-center mb-12">
                            <View className="relative">
                                <View className="w-24 h-24 bg-emerald-500/10 rounded-[32px] items-center justify-center mb-6 border border-emerald-500/20">
                                    <UserPlus size={44} color="#10b981" />
                                </View>
                                <View className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1.5 border-4 border-slate-900">
                                    <ShieldCheck size={16} color="white" />
                                </View>
                            </View>
                            <Text className="text-4xl font-bold text-slate-50 tracking-tight mb-3">
                                Create Account
                            </Text>
                            <Text className="text-slate-400 text-center font-medium max-w-[280px]">
                                Join the exam portal to start your professional certification.
                            </Text>
                        </View>

                        <View className="space-y-6">
                            {/* Name Input */}
                            <View>
                                <Text className="text-sm font-semibold text-slate-300 mb-2 ml-1">Full Name</Text>
                                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
                                    <User size={20} color="#64748b" />
                                    <TextInput
                                        className="flex-1 ml-4 text-slate-50 font-medium text-base"
                                        placeholder="e.g. John Doe"
                                        placeholderTextColor="#475569"
                                        value={name}
                                        onChangeText={setName}
                                    />
                                </View>
                            </View>

                            {/* Email Input */}
                            <View>
                                <Text className="text-sm font-semibold text-slate-300 mb-2 ml-1">Email Address</Text>
                                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
                                    <Mail size={20} color="#64748b" />
                                    <TextInput
                                        className="flex-1 ml-4 text-slate-50 font-medium text-base"
                                        placeholder="e.g. john@example.com"
                                        placeholderTextColor="#475569"
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>
                            </View>

                            {/* Church Input */}
                            <View>
                                <Text className="text-sm font-semibold text-slate-300 mb-2 ml-1">Church</Text>
                                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
                                    <Church size={18} color="#64748b" />
                                    <TextInput
                                        className="flex-1 ml-4 text-slate-50 font-medium text-base"
                                        placeholder="e.g. Gaskiya Baptist Church"
                                        placeholderTextColor="#475569"
                                        value={church}
                                        onChangeText={setChurch}
                                    />
                                </View>
                            </View>

                            {/* Association Input */}
                            <View>
                                <Text className="text-sm font-semibold text-slate-300 mb-2 ml-1">Association</Text>
                                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
                                    <Globe size={18} color="#64748b" />
                                    <TextInput
                                        className="flex-1 ml-4 text-slate-50 font-medium text-base"
                                        placeholder="e.g. Narayi Baptist Association"
                                        placeholderTextColor="#475569"
                                        value={association}
                                        onChangeText={setAssociation}
                                    />
                                </View>
                            </View>

                            {/* Password Input */}
                            <View>
                                <Text className="text-sm font-semibold text-slate-300 mb-2 ml-1">Password</Text>
                                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
                                    <ShieldCheck size={18} color="#64748b" />
                                    <TextInput
                                        className="flex-1 ml-4 text-slate-50 font-medium text-base"
                                        placeholder="••••••••"
                                        placeholderTextColor="#475569"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Text className="text-blue-500 font-bold text-xs uppercase ml-2">{showPassword ? 'Hide' : 'Show'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Exam Type Selector */}
                            <View className="pt-2">
                                <Text className="text-sm font-semibold text-slate-300 mb-2 ml-1">Examination Type *</Text>
                                <UserTypeSelector
                                    value={userType}
                                    onChange={(type) => {
                                        setUserType(type);
                                        setError(null);
                                    }}
                                    error={!userType && error ? 'Exam type is required' : undefined}
                                />
                            </View>

                            {error && (
                                <View className="bg-red-900/20 border border-red-900/50 p-4 rounded-2xl flex-row items-center space-x-3 mt-4">
                                    <View className="w-2 h-2 rounded-full bg-red-500" />
                                    <Text className="text-red-400 font-medium text-sm flex-1">{error}</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                onPress={handleRegister}
                                disabled={isLoading}
                                activeOpacity={0.8}
                                className="w-full mt-6"
                            >
                                <View className={`h-16 rounded-2xl shadow-xl items-center justify-center flex-row space-x-3 ${isLoading ? 'bg-slate-700' : 'bg-emerald-600 shadow-emerald-600/20'}`}>
                                    {isLoading ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-bold text-xl">Register Now</Text>
                                            <ArrowRight size={20} color="white" />
                                        </>
                                    )}
                                </View>
                            </TouchableOpacity>

                            {/* Footer Link */}
                            <View className="flex-row justify-center items-center mt-8 pt-6 border-t border-slate-800">
                                <Text className="text-slate-500 font-medium text-base">Already have an account? </Text>
                                <TouchableOpacity onPress={() => router.push('/login')}>
                                    <Text className="text-blue-500 font-bold text-base px-1">Sign In</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
