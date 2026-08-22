'use client';

import { useEffect } from 'react';
import { registerLifonkServiceWorker } from '@/lib/webPush';

const RELOAD_KEY = 'lifonk-sw-controller-reload';
const UPDATE_INTERVAL_MS = 60_000;

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    const handleControllerChange = () => {
      if (disposed || sessionStorage.getItem(RELOAD_KEY) === '1') return;
      sessionStorage.setItem(RELOAD_KEY, '1');
      window.location.reload();
    };

    const checkForUpdate = () => {
      if (disposed || !registration) return;
      void registration.update().catch(error => console.debug('SW update check:', error));
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', checkForUpdate);

    void registerLifonkServiceWorker()
      .then(value => {
        registration = value;
        if (navigator.serviceWorker.controller) sessionStorage.removeItem(RELOAD_KEY);
        checkForUpdate();
      })
      .catch(error => console.error('Service Worker registration:', error));

    const interval = window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', checkForUpdate);
    };
  }, []);

  return null;
}
