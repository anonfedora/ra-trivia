import axios, { AxiosRequestConfig, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, getRefreshToken, updateAccessToken, updateRefreshToken, clearAuth } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Global Axios Instance
 */
export const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

/**
 * Process all subscribers after token update
 */
function onRefreshed(token: string) {
  refreshSubscribers.map((cb) => cb(token));
}

/**
 * Register a listener for token refresh events
 */
function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

/**
 * Interceptor: Add Authorization header to every request
 */
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

/**
 * Interceptor: Handle 401 errors and attempt Token Refresh
 */
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // If 401 Unauthorized, specifically from an authenticated endpoint
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If we are already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(axiosInstance(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        isRefreshing = false;
        clearAuth();
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh-token`, { 
            refreshToken 
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        // Update local store
        updateAccessToken(accessToken);
        if (newRefreshToken) {
            updateRefreshToken(newRefreshToken);
        }

        isRefreshing = false;
        onRefreshed(accessToken);
        refreshSubscribers = [];

        // Retry the original request
        if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        clearAuth();
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Unified Fetch replacement
 * Routes through Axios instance to handle:
 * - Base URL prefixing
 * - Global headers
 * - Auto token refresh
 * - Standardized error handling
 */
export async function apiFetch(
    input: string | RequestInfo,
    init?: RequestInit
): Promise<Response> {
    const url = typeof input === 'string' ? input : input.url;
    const method = init?.method || 'GET';
    const body = init?.body ? (typeof init.body === 'string' ? JSON.parse(init.body) : init.body) : undefined;
    
    // Extract headers (except Authorization as we add it globally)
    const customHeaders: any = {};
    if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => {
            if (key.toLowerCase() !== 'authorization') {
                customHeaders[key] = value;
            }
        });
    }

    try {
        const response = await axiosInstance({
            url,
            method,
            data: body,
            headers: customHeaders,
        });

        // Wrap Axios response to look like Fetch response
        return {
            ok: true,
            status: response.status,
            statusText: response.statusText,
            json: async () => response.data,
            text: async () => JSON.stringify(response.data),
            blob: async () => new Blob([JSON.stringify(response.data)]),
            headers: new Headers(response.headers as any),
            clone: () => { throw new Error('Clone not implemented for apiFetch'); }
        } as unknown as Response;
    } catch (error: any) {
        const status = error.response?.status || 500;
        const data = error.response?.data || { message: error.message };

        return {
            ok: false,
            status,
            statusText: error.message,
            json: async () => data,
            text: async () => JSON.stringify(data),
            headers: new Headers(error.response?.headers as any),
        } as unknown as Response;
    }
}
