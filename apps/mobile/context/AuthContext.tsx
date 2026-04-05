import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosInstance } from 'axios';
import { Platform } from 'react-native';

// API Configuration from environment variables
const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.113.159.193:4000/api';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    userType?: string;
    emailVerified: boolean;
}

interface AuthContextType {
    user: User | null;
    accessToken: string | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<any>;
    signUp: (name: string, email: string, password: string, church: string, association: string, userType: string) => Promise<void>;
    signOut: () => Promise<void>;
    verifyOtp: (email: string, otp: string) => Promise<any>;
    apiUrl: string;
    api: AxiosInstance;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const apiUrl = DEFAULT_API_URL;
    
    // Create a stable axios instance for the app
    const api = useRef(axios.create({
        baseURL: apiUrl,
        headers: {
            'Content-Type': 'application/json',
        },
    })).current;

    useEffect(() => {
        // Load persisted session
        async function loadSession() {
            try {
                const savedAccessToken = await SecureStore.getItemAsync('accessToken');
                const savedRefreshToken = await SecureStore.getItemAsync('refreshToken');
                const savedUser = await SecureStore.getItemAsync('user');

                if (savedAccessToken && savedUser) {
                    setAccessToken(savedAccessToken);
                    setRefreshToken(savedRefreshToken);
                    setUser(JSON.parse(savedUser));
                }
            } catch (e) {
                console.error('Failed to load session', e);
            } finally {
                setIsLoading(false);
            }
        }

        loadSession();
    }, []);

    // Setup Axios interceptors
    useEffect(() => {
        const reqInterceptor = api.interceptors.request.use(
            async (config) => {
                const token = await SecureStore.getItemAsync('accessToken');
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        const resInterceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;
                    try {
                        const storedRefreshToken = await SecureStore.getItemAsync('refreshToken');
                        if (!storedRefreshToken) throw new Error('No refresh token');

                        const response = await axios.post(`${apiUrl}/auth/refresh-token`, {
                            refreshToken: storedRefreshToken,
                        });

                        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
                        
                        await SecureStore.setItemAsync('accessToken', newAccessToken);
                        if (newRefreshToken) {
                            await SecureStore.setItemAsync('refreshToken', newRefreshToken);
                        }
                        
                        setAccessToken(newAccessToken);
                        
                        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                        return api(originalRequest);
                    } catch (refreshErr) {
                        // Refresh failed, log out
                        signOut();
                        return Promise.reject(refreshErr);
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.request.eject(reqInterceptor);
            api.interceptors.response.eject(resInterceptor);
        };
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            const response = await axios.post(`${apiUrl}/auth/login`, { email, password });
            const { accessToken, refreshToken, user } = response.data;

            setAccessToken(accessToken);
            setRefreshToken(refreshToken);
            setUser(user);

            await SecureStore.setItemAsync('accessToken', accessToken);
            await SecureStore.setItemAsync('refreshToken', refreshToken);
            await SecureStore.setItemAsync('user', JSON.stringify(user));

            return response.data;
        } catch (error: any) {
            if (error.response?.status === 403 && error.response?.data?.isUnverified) {
                return error.response.data;
            }
            
            // Handle validation errors or other structured errors
            const errorMessage = error.response?.data?.message || 
                               (error.response?.data?.errors && error.response.data.errors[0]?.msg) ||
                               (error.response ? 'Login failed. Please check your credentials.' : 'Unable to connect to the server. Please check your internet connection.');
            
            throw errorMessage;
        }
    };

    const signUp = async (name: string, email: string, password: string, church: string, association: string, userType: string) => {
        try {
            await axios.post(`${apiUrl}/auth/register`, { name, email, password, church, association, userType });
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 
                               (error.response?.data?.errors && error.response.data.errors[0]?.msg) ||
                               (error.response ? 'Registration failed. Please verify your details.' : 'Unable to connect to the server. Please check your internet connection.');
            throw errorMessage;
        }
    };

    const verifyOtp = async (email: string, otp: string) => {
        try {
            const response = await axios.post(`${apiUrl}/auth/verify-otp`, { email, otp });
            const { accessToken, refreshToken, user } = response.data;

            setAccessToken(accessToken);
            setRefreshToken(refreshToken);
            setUser(user);

            await SecureStore.setItemAsync('accessToken', accessToken);
            await SecureStore.setItemAsync('refreshToken', refreshToken);
            await SecureStore.setItemAsync('user', JSON.stringify(user));

            return response.data;
        } catch (error: any) {
            throw error.response?.data?.message || 'Verification failed';
        }
    };

    const signOut = async () => {
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('user');
    };

    return (
        <AuthContext.Provider value={{ 
            user, 
            accessToken, 
            isLoading, 
            signIn, 
            signUp, 
            signOut, 
            verifyOtp, 
            apiUrl,
            api 
        }}>
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

