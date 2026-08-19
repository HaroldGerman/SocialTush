import { Platform } from 'react-native';
import axios from 'axios';
import Constants from 'expo-constants';

/**
 * Cleanly formats and normalizes the backend API URL.
 * Ensures no trailing slashes and appends /api/v1 if not present.
 */
export const formatApiUrl = (rawUrl: string): string => {
  let clean = rawUrl.trim().replace(/\/+$/, '');
  if (!clean.toLowerCase().endsWith('/api/v1')) {
    clean = `${clean}/api/v1`;
  }
  return clean;
};

/**
 * Calculates the local development backend URL based on Expo Go host IP,
 * Android Emulator fallback (10.0.2.2), or localhost fallback.
 */
export const getLocalBackendUrl = (): string => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.developer?.manifest?.debuggerHost;
    
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:8080/api/v1`;
  }
  
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:8080/api/v1'
    : 'http://localhost:8080/api/v1';
};

/**
 * Returns the active Backend API URL.
 * Uses EXPO_PUBLIC_API_URL when configured (e.g., Railway deployment),
 * otherwise falls back to local development URL.
 */
export const getBackendUrl = (): string => {
  const cloudUrl = process.env.EXPO_PUBLIC_API_URL;
  if (cloudUrl && cloudUrl.trim().length > 0) {
    return formatApiUrl(cloudUrl);
  }
  return getLocalBackendUrl();
};

/**
 * Derives the WebSocket URL for real-time messaging from the active Backend API URL.
 * Maps http -> ws and https -> wss, targeting /ws/chat.
 */
export const getWebSocketUrl = (): string => {
  const baseUrl = getBackendUrl();
  const origin = baseUrl.replace(/\/api\/v1\/?$/i, '');
  const wsProtocolUrl = origin
    .replace(/^http:/i, 'ws:')
    .replace(/^https:/i, 'wss:');
  return `${wsProtocolUrl}/ws/chat`;
};

export const BACKEND_URL = getBackendUrl();

export const api = axios.create({
  baseURL: BACKEND_URL,
});
