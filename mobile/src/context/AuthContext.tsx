import React, { createContext, useContext, useState, useEffect } from 'react';
import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { BACKEND_URL, api } from '../config/api';

export { api };

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

const REFRESH_TOKEN_KEY = 'socialtush_refresh_token';
const USER_KEY = 'socialtush_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session on startup
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        const storedUser = await SecureStore.getItemAsync(USER_KEY);
        if (storedRefreshToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          const res = await axios.post(`${BACKEND_URL}/auth/refresh`, {
            refreshToken: storedRefreshToken,
          });
          setAccessToken(res.data.accessToken);
          if (res.data.refreshToken) {
            await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, res.data.refreshToken);
          }
          setUser(parsedUser);
        }
      } catch (e) {
        // Session expired or invalid token
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
        await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

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
      const userSession: UserSession = {
        userId: res.data.userId,
        username: res.data.username,
        email: res.data.email,
        displayName: res.data.displayName,
        role: res.data.role,
      };

      setAccessToken(res.data.accessToken);
      setUser(userSession);

      if (res.data.refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, res.data.refreshToken);
      }
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userSession));
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
      const userSession: UserSession = {
        userId: res.data.userId,
        username: res.data.username,
        email: res.data.email,
        displayName: res.data.displayName,
        role: res.data.role,
      };

      setAccessToken(res.data.accessToken);
      setUser(userSession);

      if (res.data.refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, res.data.refreshToken);
      }
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userSession));
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Error al crear cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (storedRefreshToken) {
        await api.post('/auth/logout', { refreshToken: storedRefreshToken }).catch(() => {});
      }
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
      await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
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
