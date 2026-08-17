import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';

interface UserSession {
  userId: string;
  username: string;
  email: string;
  displayName: string;
  role: string;
}

interface AuthContextType {
  user: UserSession | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  register: (email: string, username: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  api: AxiosInstance;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Dynamic backend IP detection for physical Expo Go devices & emulators
const getBackendUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.developer?.manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:8080/api/v1`;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:8080/api/v1' : 'http://localhost:8080/api/v1';
};

const BACKEND_URL = getBackendUrl();

export const api = axios.create({
  baseURL: BACKEND_URL,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Attach token to requests
  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(
      (config: any) => {
        if (accessToken) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error: any) => Promise.reject(error)
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
    };
  }, [accessToken]);

  const login = async (usernameOrEmail: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/login', { usernameOrEmail, password });
      setAccessToken(res.data.accessToken);
      setUser({
        userId: res.data.userId,
        username: res.data.username,
        email: res.data.email,
        displayName: res.data.displayName,
        role: res.data.role,
      });
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Error al conectar con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, username: string, displayName: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', { email, username, displayName, password });
      setAccessToken(res.data.accessToken);
      setUser({
        userId: res.data.userId,
        username: res.data.username,
        email: res.data.email,
        displayName: res.data.displayName,
        role: res.data.role,
      });
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Error al crear cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      setAccessToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout, api }}>
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
