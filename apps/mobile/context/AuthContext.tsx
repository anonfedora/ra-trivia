import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { Platform } from 'react-native';

// API Configuration from environment variables
const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || Platform.select({
    android: 'http://10.0.2.2:4000/api',
    ios: 'http://localhost:4000/api',
    default: 'http://localhost:4000/api',
});

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    userType?: string;
    isVerified: boolean;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    signIn: (email: string, otp: string) => Promise<void>;
    signUp: (name: string, email: string, church: string, association: string, userType: string) => Promise<void>;
    signOut: () => Promise<void>;
    verifyOtp: (email: string, otp: string) => Promise<void>;
    apiUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const apiUrl = DEFAULT_API_URL;

    useEffect(() => {
        // Load persisted session
        async function loadSession() {
            try {
                const savedToken = await SecureStore.getItemAsync('token');
                const savedUser = await SecureStore.getItemAsync('user');

                if (savedToken && savedUser) {
                    setToken(savedToken);
                    setUser(JSON.parse(savedUser));

                    // Set default axios header
                    axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
                }
            } catch (e) {
                console.error('Failed to load session', e);
            } finally {
                setIsLoading(false);
            }
        }

        loadSession();
    }, []);

    const signIn = async (email: string, otp: string) => {
        try {
            const response = await axios.post(`${apiUrl}/auth/login`, { email, otp });
            const { token, user } = response.data;

            setToken(token);
            setUser(user);

            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            await SecureStore.setItemAsync('token', token);
            await SecureStore.setItemAsync('user', JSON.stringify(user));
        } catch (error: any) {
            throw error.response?.data?.message || 'Login failed';
        }
    };

    const signUp = async (name: string, email: string, church: string, association: string, userType: string) => {
        try {
            await axios.post(`${apiUrl}/auth/register`, { name, email, church, association, userType });
        } catch (error: any) {
            throw error.response?.data?.message || 'Registration failed';
        }
    };

    const verifyOtp = async (email: string, otp: string) => {
        try {
            const response = await axios.post(`${apiUrl}/auth/verify-otp`, { email, otp });
            const { token, user } = response.data;

            setToken(token);
            setUser(user);

            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            await SecureStore.setItemAsync('token', token);
            await SecureStore.setItemAsync('user', JSON.stringify(user));
        } catch (error: any) {
            throw error.response?.data?.message || 'Verification failed';
        }
    };

    const signOut = async () => {
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('user');
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, signIn, signUp, signOut, verifyOtp, apiUrl }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
