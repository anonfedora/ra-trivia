/**
 * Authentication Storage Utilities
 * Using standardized keys for Access and Refresh tokens.
 */

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  userType: string;
  emailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Store auth tokens and user data
 */
export function setAuthTokens(tokens: { accessToken: string; refreshToken: string }, user: User): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

/**
 * Alias for setAuthTokens
 */
export const setAuth = setAuthTokens;

/**
 * Get current access token
 */
export function getAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return null;
}

/**
 * Get current refresh token
 */
export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return null;
}

/**
 * Update access token only (after refresh)
 */
export function updateAccessToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
}

/**
 * Update refresh token only (after rotation)
 */
export function updateRefreshToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }
}

/**
 * Get current user data
 */
export function getUser(): User | null {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem(USER_KEY);
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
      return null;
    }
  }
  return null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!(getAccessToken() && getUser());
}

/**
 * Update user data only
 */
export function updateUser(user: User): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

/**
 * Clear all auth data
 */
export function clearAuth(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // Backward compatibility cleaning
    localStorage.removeItem('token');
  }
}

/**
 * API Logout implementation (calls server)
 * Note: Actual logout logic should be used via the global axios instance
 */
export async function logout(): Promise<void> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  try {
    // We'll use a dynamic import or the global api instance here if needed,
    // but for now, we just clear local storage to be safe.
    // The actual API call is better handled by the caller or a centralized API service.
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearAuth();
    if (typeof window !== 'undefined') {
        window.location.href = '/login';
    }
  }
}
