'use client';

import { useEffect } from 'react';
import { registerLifonkServiceWorker } from '@/lib/webPush';

const RELOAD_KEY = 'lifonk-sw-controller-reload';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let disposed = false;

    const handleControllerChange = () => {
      if (disposed || sessionStorage.getItem(RELOAD_KEY) === '1') return;
      sessionStorage.setItem(RELOAD_KEY, '1');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    void registerLifonkServiceWorker()
      .then(() => {
        if (navigator.serviceWorker.controller) sessionStorage.removeItem(RELOAD_KEY);
      })
      .catch(error => console.error('Service Worker registration:', error));

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
