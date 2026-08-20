import { api } from '@/context/AuthContext';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || '';

export type WebPushState = 'unsupported' | 'blocked' | 'disabled' | 'enabling' | 'enabled';

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes.buffer;
}

export function webPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
    && Boolean(PUBLIC_KEY);
}

export async function registerLifonkServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

async function syncSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('El navegador devolvió una suscripción incompleta.');
  }
  await api.post('/push/web/subscriptions', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
}

export async function currentWebPushState(): Promise<WebPushState> {
  if (!webPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'disabled';
  const registration = await registerLifonkServiceWorker();
  return (await registration?.pushManager.getSubscription()) ? 'enabled' : 'disabled';
}

export async function syncExistingWebPush(): Promise<boolean> {
  if (!webPushSupported() || Notification.permission !== 'granted') return false;
  const registration = await registerLifonkServiceWorker();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return false;
  await syncSubscription(subscription);
  return true;
}

export async function enableWebPush(): Promise<void> {
  if (!webPushSupported()) throw new Error('Web Push no está disponible o falta configurar VAPID.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('El permiso de notificaciones no fue concedido.');
  const registration = await registerLifonkServiceWorker();
  if (!registration) throw new Error('No se pudo activar el Service Worker.');
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(PUBLIC_KEY),
    });
  }
  await syncSubscription(subscription);
}

export async function disableWebPush(unsubscribeBrowser = true): Promise<void> {
  if (!webPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await api.delete('/push/web/subscriptions', { data: { endpoint: subscription.endpoint } });
  if (unsubscribeBrowser) await subscription.unsubscribe();
}
