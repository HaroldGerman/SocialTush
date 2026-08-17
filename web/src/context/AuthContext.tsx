'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios, { AxiosInstance } from 'axios';

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
  login: (usernameOrEmail: string, password: String) => Promise<void>;
  register: (email: string, username: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  axiosInstance: AxiosInstance;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const api = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  withCredentials: true, // Enables sending cookies (RefreshToken)
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const accessTokenRef = React.useRef<string | null>(null);

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
            const res = await axios.post('http://localhost:8080/api/v1/auth/refresh', {}, { withCredentials: true });
            const newAccessToken = res.data.accessToken;
            setToken(newAccessToken);
            
            setUser({
              userId: res.data.userId,
              username: res.data.username,
              email: res.data.email,
              displayName: res.data.displayName,
              role: res.data.role,
            });

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
        const res = await axios.post('http://localhost:8080/api/v1/auth/refresh', {}, { withCredentials: true });
        setToken(res.data.accessToken);
        setUser({
          userId: res.data.userId,
          username: res.data.username,
          email: res.data.email,
          displayName: res.data.displayName,
          role: res.data.role,
        });
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
      setUser({
        userId: res.data.userId,
        username: res.data.username,
        email: res.data.email,
        displayName: res.data.displayName,
        role: res.data.role,
      });
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
      setUser({
        userId: res.data.userId,
        username: res.data.username,
        email: res.data.email,
        displayName: res.data.displayName,
        role: res.data.role,
      });
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Error al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      setToken(null);
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout, axiosInstance: api }}>
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
