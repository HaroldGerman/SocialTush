'use client';

import { useEffect } from 'react';
import { registerLifonkServiceWorker } from '@/lib/webPush';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerLifonkServiceWorker().catch(error => console.error('Service Worker registration:', error));
  }, []);
  return null;
}
