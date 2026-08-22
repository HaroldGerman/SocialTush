'use client';

import { useEffect } from 'react';
import { registerLifonkServiceWorker } from '@/lib/webPush';
import { BUILD_VERSION } from '@/generated/buildVersion';

const RELOAD_KEY = 'lifonk-sw-controller-reload';
const BUILD_RELOAD_KEY = 'lifonk-build-reload';
const UPDATE_INTERVAL_MS = 60_000;

type BuildInfo = { version?: string };

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    const reloadForBuild = (version: string) => {
      if (disposed || !version || version === BUILD_VERSION) return;
      if (sessionStorage.getItem(BUILD_RELOAD_KEY) === version) return;
      sessionStorage.setItem(BUILD_RELOAD_KEY, version);
      const url = new URL(window.location.href);
      url.searchParams.set('__lifonk_build', version.slice(0, 12));
      window.location.replace(url.toString());
    };

    const checkBuildVersion = async () => {
      if (disposed || BUILD_VERSION === 'development') return;
      try {
        const response = await fetch(`/build-version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'cache-control': 'no-cache' },
        });
        if (!response.ok) return;
        const remote = await response.json() as BuildInfo;
        if (remote.version === BUILD_VERSION) {
          sessionStorage.removeItem(BUILD_RELOAD_KEY);
          return;
        }
        if (remote.version) reloadForBuild(remote.version);
      } catch (error) {
        console.debug('Build version check:', error);
      }
    };

    const checkForUpdate = () => {
      if (disposed) return;
      if (registration) void registration.update().catch(error => console.debug('SW update check:', error));
      void checkBuildVersion();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };

    if ('serviceWorker' in navigator) {
      const handleControllerChange = () => {
        if (disposed || sessionStorage.getItem(RELOAD_KEY) === '1') return;
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      void registerLifonkServiceWorker()
        .then(value => {
          registration = value;
          if (navigator.serviceWorker.controller) sessionStorage.removeItem(RELOAD_KEY);
          checkForUpdate();
        })
        .catch(error => console.error('Service Worker registration:', error));

      const cleanupServiceWorker = () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.addEventListener('pagehide', cleanupServiceWorker, { once: true });
    } else {
      void checkBuildVersion();
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', checkForUpdate);
    const interval = window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS);

    void checkBuildVersion();

    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', checkForUpdate);
    };
  }, []);

  return null;
}
