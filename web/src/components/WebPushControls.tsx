'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import {
  currentWebPushState,
  disableWebPush,
  enableWebPush,
  registerLifonkServiceWorker,
  syncExistingWebPush,
  type WebPushState,
} from '@/lib/webPush';

const labels: Record<WebPushState, string> = {
  unsupported: 'Notificaciones del dispositivo no compatibles',
  blocked: 'Notificaciones bloqueadas en el navegador',
  disabled: 'Activa avisos aunque Lifonk esté en segundo plano.',
  enabling: 'Activando...',
  enabled: 'Notificaciones del dispositivo activadas',
};

export default function WebPushControls() {
  const [state, setState] = useState<WebPushState>('disabled');
  const [error, setError] = useState('');

  useEffect(() => {
    void registerLifonkServiceWorker()
      .then(async () => {
        const current = await currentWebPushState();
        if (current === 'enabled') await syncExistingWebPush();
        setState(current);
      })
      .catch(error => {
        console.error('Web Push initialization:', error);
        setState('unsupported');
      });
  }, []);

  const enable = async () => {
    setState('enabling');
    setError('');
    try {
      await enableWebPush();
      setState('enabled');
    } catch (requestError: any) {
      console.error('Web Push enable:', requestError);
      setState(await currentWebPushState());
      setError(requestError?.message || 'No se pudieron activar las notificaciones.');
    }
  };

  const disable = async () => {
    setState('enabling');
    setError('');
    try {
      await disableWebPush(true);
      setState('disabled');
    } catch (requestError) {
      console.error('Web Push disable:', requestError);
      setState('enabled');
      setError('No se pudieron desactivar las notificaciones.');
    }
  };

  return (
    <div className="border-b border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-start gap-2">
        <BellRing className="mt-0.5 h-4 w-4 flex-none text-teal-700 dark:text-teal-300" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{labels[state]}</p>
          {error && <p className="mt-1 text-[10px] text-rose-600 dark:text-rose-300">{error}</p>}
          {state === 'disabled' && (
            <button onClick={() => void enable()} className="mt-2 rounded-lg bg-teal-700 px-3 py-1.5 text-[10px] font-bold text-white">
              Activar notificaciones
            </button>
          )}
          {state === 'enabled' && (
            <button onClick={() => void disable()} className="mt-1 text-[10px] font-semibold text-slate-500 underline">
              Desactivar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
