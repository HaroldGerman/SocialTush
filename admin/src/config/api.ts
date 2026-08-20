export function getApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!configured) return 'http://localhost:8080/api/v1';
  return configured.toLowerCase().endsWith('/api/v1') ? configured : `${configured}/api/v1`;
}
