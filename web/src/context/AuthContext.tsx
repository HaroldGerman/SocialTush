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
  preferredLanguage?: 'es' | 'en';
}

interface AuthContextType {
  user: UserSession | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  register: (email: string, username: string, displayName: string, password: string, preferredLanguage?: 'es' | 'en') => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (profile: Pick<UserSession, 'displayName' | 'avatarUrl'>) => void;
  axiosInstance: AxiosInstance;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const DEVICE_ID_STORAGE_KEY = 'lifonk-device-id';
const LANGUAGE_STORAGE_KEY = 'lifonk-language';

function getOrCreateDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing) return existing;
    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return null;
  }
}

function syncLanguage(language?: string) {
  if (typeof window === 'undefined') return;
  const normalized = language === 'en' ? 'en' : 'es';
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  document.documentElement.lang = normalized;
  window.dispatchEvent(new CustomEvent('lifonk:language-changed', { detail: normalized }));
}

function deviceHeaders(): Record<string, string> {
  const deviceId = getOrCreateDeviceId();
  return deviceId ? { 'X-Lifonk-Device-Id': deviceId } : {};
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const accessTokenRef = React.useRef<string | null>(null);

  const sessionFromResponse = (data: any): UserSession => {
    const session: UserSession = {
      userId: data.userId,
      username: data.username,
      email: data.email,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl ?? undefined,
      role: data.role,
      preferredLanguage: data.preferredLanguage === 'en' ? 'en' : 'es',
    };
    syncLanguage(session.preferredLanguage);
    return session;
  };

  const setToken = (token: string | null) => {
    accessTokenRef.current = token;
    setAccessToken(token);
  };

  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        if (accessTokenRef.current) config.headers.Authorization = `Bearer ${accessTokenRef.current}`;
        const deviceId = getOrCreateDeviceId();
        if (deviceId) config.headers['X-Lifonk-Device-Id'] = deviceId;
        return config;
      },
      (error) => Promise.reject(error)
    );
    return () => api.interceptors.request.eject(requestInterceptor);
  }, []);

  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
              withCredentials: true,
              headers: deviceHeaders(),
            });
            const newAccessToken = res.data.accessToken;
            setToken(newAccessToken);
            setUser(sessionFromResponse(res.data));
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            const deviceId = getOrCreateDeviceId();
            if (deviceId) originalRequest.headers['X-Lifonk-Device-Id'] = deviceId;
            return api(originalRequest);
          } catch {
            setToken(null);
            setUser(null);
          }
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(responseInterceptor);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          withCredentials: true,
          headers: deviceHeaders(),
        });
        setToken(res.data.accessToken);
        setUser(sessionFromResponse(res.data));
      } catch {
        // No valid session cookie found.
      } finally {
        setIsLoading(false);
      }
    };
    void initAuth();
  }, []);

  const login = async (usernameOrEmail: string, password: string) => {
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

  const register = async (email: string, username: string, displayName: string, password: string, preferredLanguage: 'es' | 'en' = 'es') => {
    setIsLoading(true);
    try {
      await api.post('/auth/register', { email, username, displayName, password, preferredLanguage });
      syncLanguage(preferredLanguage);
      setToken(null);
      setUser(null);
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Error al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          try {
            await api.delete('/push/web/subscriptions', { data: { endpoint: subscription.endpoint } });
          } catch (pushError: any) {
            if (pushError?.response?.status !== 404) console.error('Web Push logout cleanup:', pushError);
          } finally {
            try { await subscription.unsubscribe(); } catch (unsubscribeError) {
              console.error('Web Push browser unsubscribe:', unsubscribeError);
            }
          }
        }
      }
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout.
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
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return context;
}
