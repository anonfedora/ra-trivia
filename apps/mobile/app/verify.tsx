import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Mail, RefreshCcw } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

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
      setError('Enter your email and the 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await verifyOtp(email.trim(), otp.trim());
      router.replace('/(tabs)/dashboard' as any);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : 'Verification failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resendCode = async () => {
    if (!email.trim()) {
      setError('Enter your email to resend the code');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch (err: any) {
      setError(err.message || 'Could not resend code. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="p-6">
          <View className="flex-1 justify-center">
            <View className="items-center mb-10">
              <View className="w-20 h-20 bg-primary/10 rounded-3xl items-center justify-center mb-4">
                <CheckCircle2 size={40} color="#0f172a" />
              </View>
              <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50">Verify Code</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2 text-center">
                Enter the 6-digit code sent to your email
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

              <View>
                <Text className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Verification Code</Text>
                <View className="flex-row items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4">
                  <TextInput
                    className="flex-1 ml-1 text-slate-900 dark:text-slate-50 font-medium tracking-widest"
                    placeholder="123456"
                    placeholderTextColor="#94a3b8"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              </View>

              {error && (
                <View className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                  <Text className="text-rose-600 font-bold text-sm text-center">{error}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleVerify}
                disabled={isLoading}
                className={`w-full py-4 rounded-2xl shadow-lg items-center ${isLoading ? 'bg-slate-400' : 'bg-primary'}`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-bold text-lg">Verify and Continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={resendCode}
                disabled={isLoading}
                className="w-full py-3 rounded-2xl items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <View className="flex-row items-center gap-2">
                  <RefreshCcw size={18} color="#334155" />
                  <Text className="text-slate-700 dark:text-slate-200 font-bold">Resend Code</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
