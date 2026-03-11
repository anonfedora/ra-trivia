import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserPlus, Mail, Church } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import UserTypeSelector, { UserType } from '../components/UserTypeSelector';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [church, setChurch] = useState('');
  const [association, setAssociation] = useState('');
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { signUp } = useAuth();

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !church.trim() || !association.trim() || !userType) {
      setError('Please fill in all fields and select an examination type');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await signUp(name.trim(), email.trim(), church.trim(), association.trim(), userType);
      router.push({ pathname: '/verify', params: { email: email.trim() } });
    } catch (err: any) {
      setError(typeof err === 'string' ? err : 'Registration failed. Try again.');
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
                <UserPlus size={40} color="#0f172a" />
              </View>
              <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50">Create Account</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2 text-center">
                Register to start your quiz journey
              </p>
            </View>

            <View className="space-y-4">
              <View>
                <Text className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Full Name</Text>
                <View className="flex-row items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4">
                  <TextInput
                    className="flex-1 text-slate-900 dark:text-slate-50 font-medium"
                    placeholder="John Doe"
                    placeholderTextColor="#94a3b8"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>

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
                <Text className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Church</Text>
                <View className="flex-row items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4">
                  <Church size={20} color="#94a3b8" />
                  <TextInput
                    className="flex-1 ml-3 text-slate-900 dark:text-slate-50 font-medium"
                    placeholder="Your church"
                    placeholderTextColor="#94a3b8"
                    value={church}
                    onChangeText={setChurch}
                  />
                </View>
              </View>

              <View>
                <Text className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 ml-1">Association</Text>
                <View className="flex-row items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-4">
                  <Church size={20} color="#94a3b8" />
                  <TextInput
                    className="flex-1 ml-3 text-slate-900 dark:text-slate-50 font-medium"
                    placeholder="Your association"
                    placeholderTextColor="#94a3b8"
                    value={association}
                    onChangeText={setAssociation}
                  />
                </View>
              </View>

              <UserTypeSelector
                value={userType}
                onChange={setUserType}
                error={!userType && error ? 'Please select an examination type' : undefined}
              />

              {error && (
                <View className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                  <Text className="text-rose-600 font-bold text-sm text-center">{error}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleRegister}
                disabled={isLoading}
                className={`w-full py-4 rounded-2xl shadow-lg items-center ${isLoading ? 'bg-slate-400' : 'bg-primary'}`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-bold text-lg">Register</Text>
                )}
              </TouchableOpacity>

              <View className="flex-row justify-center mt-6">
                <Text className="text-slate-500 font-medium">Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/login')}>
                  <Text className="text-primary font-bold">Log In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
