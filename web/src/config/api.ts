/**
 * Central API & WebSocket configuration for SocialTush Web Application.
 * Uses NEXT_PUBLIC_API_URL when set (e.g. Vercel deployment -> Railway backend),
 * otherwise defaults to local development backend.
 */

export const getApiUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    let clean = envUrl.trim().replace(/\/+$/, '');
    if (!clean.toLowerCase().endsWith('/api/v1')) {
      clean = `${clean}/api/v1`;
    }
    return clean;
  }
  return 'http://localhost:8080/api/v1';
};

export const getWsUrl = (): string => {
  const apiUrl = getApiUrl();
  const origin = apiUrl.replace(/\/api\/v1\/?$/i, '');
  const wsProtocolUrl = origin
    .replace(/^http:/i, 'ws:')
    .replace(/^https:/i, 'wss:');
  return `${wsProtocolUrl}/ws/chat`;
};

export const API_BASE_URL = getApiUrl();
export const WS_BASE_URL = getWsUrl();
