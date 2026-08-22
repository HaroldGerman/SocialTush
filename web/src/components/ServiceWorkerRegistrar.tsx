'use client';

import { useEffect } from 'react';
import { registerLifonkServiceWorker } from '@/lib/webPush';

const BUILD_ID = '2026-08-22-chat-recovery-2';
const RELOAD_KEY = 'lifonk-sw-controller-reload-v2';
const BUILD_STORAGE_KEY = 'lifonk-last-build';

async function readPublishedBuild() {
  try {
    const response = await fetch(`/build-version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return '';
    const payload = await response.json();
    return typeof payload?.version === 'string' ? payload.version : '';
  } catch {
    return '';
  }
}

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    const hardRefreshToBuild = (version: string) => {
      if (!version || disposed) return;
      const url = new URL(window.location.href);
      if (url.searchParams.get('__lifonk_build') === version) return;
      url.searchParams.set('__lifonk_build', version);
      window.location.replace(url.toString());
    };

    const checkPublishedBuild = async () => {
      const version = await readPublishedBuild();
      if (!version || disposed) return;
      const previous = localStorage.getItem(BUILD_STORAGE_KEY) || '';
      localStorage.setItem(BUILD_STORAGE_KEY, version);
      if (previous && previous !== version) hardRefreshToBuild(version);
    };

    const refreshRegistration = async () => {
      try {
        if (!registration) registration = await registerLifonkServiceWorker();
        else await registration.update();
      } catch (error) {
        console.error('Service Worker update:', error);
      }
      await checkPublishedBuild();
    };

    const handleControllerChange = () => {
      if (disposed || sessionStorage.getItem(RELOAD_KEY) === BUILD_ID) return;
      sessionStorage.setItem(RELOAD_KEY, BUILD_ID);
      hardRefreshToBuild(BUILD_ID);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshRegistration();
    };

    const handleFocus = () => { void refreshRegistration(); };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    void refreshRegistration().then(() => {
      if (disposed) return;
      const url = new URL(window.location.href);
      if (url.searchParams.has('__lifonk_build')) {
        url.searchParams.delete('__lifonk_build');
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      }
    });

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshRegistration();
    }, 5 * 60 * 1000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return null;
}
