'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios, { AxiosInstance } from 'axios';
import { API_BASE_URL } from '@/config/api';

interface UserSession {
  userId: string;
  username: string;
  email: string;
  displayName: string;
  role: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: UserSession | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: String) => Promise<void>;
  register: (email: string, username: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (profile: Pick<UserSession, 'displayName' | 'avatarUrl'>) => void;
  axiosInstance: AxiosInstance;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Enables sending cookies (RefreshToken)
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const accessTokenRef = React.useRef<string | null>(null);

  const sessionFromResponse = (data: any): UserSession => ({
    userId: data.userId,
    username: data.username,
    email: data.email,
    displayName: data.displayName,
    avatarUrl: data.avatarUrl ?? undefined,
    role: data.role,
  });

  // Helper to keep ref and state in sync
  const setToken = (token: string | null) => {
    accessTokenRef.current = token;
    setAccessToken(token);
  };

  // Configure Axios Request interceptor dynamically using the ref
  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        if (accessTokenRef.current) {
          config.headers.Authorization = `Bearer ${accessTokenRef.current}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
    };
  }, []);

  // Configure Axios Response interceptor to handle expired access tokens and rotate automatically
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            // Attempt to refresh
            const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
            const newAccessToken = res.data.accessToken;
            setToken(newAccessToken);
            
            setUser(sessionFromResponse(res.data));

            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            // Refresh token expired or invalid -> logout user
            setToken(null);
            setUser(null);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Try refreshing session on mount (Persistent login)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        setToken(res.data.accessToken);
        setUser(sessionFromResponse(res.data));
      } catch (err) {
        // No valid session cookie found
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (usernameOrEmail: string, password: String) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { usernameOrEmail, password });
      setToken(res.data.accessToken);
      setUser(sessionFromResponse(res.data));
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, username: string, displayName: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', { email, username, displayName, password });
      setToken(res.data.accessToken);
      setUser(sessionFromResponse(res.data));
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Error al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Remove only this browser endpoint from the authenticated user before
      // invalidating the session. Keep the browser subscription reusable.
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          try {
            await api.delete('/push/web/subscriptions', { data: { endpoint: subscription.endpoint } });
          } catch (pushError: any) {
            if (pushError?.response?.status !== 404) console.error('Web Push logout cleanup:', pushError);
          } finally {
            // Invalidating the browser capability prevents pushes for the old
            // account even if backend cleanup was temporarily unavailable.
            try { await subscription.unsubscribe(); } catch (unsubscribeError) {
              console.error('Web Push browser unsubscribe:', unsubscribeError);
            }
          }
        }
      }
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      setToken(null);
      setUser(null);
      window.location.href = '/login';
    }
  };

  const updateUserProfile = (profile: Pick<UserSession, 'displayName' | 'avatarUrl'>) => {
    setUser(prev => prev ? { ...prev, ...profile } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout, updateUserProfile, axiosInstance: api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
