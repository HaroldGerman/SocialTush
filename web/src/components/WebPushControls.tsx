'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { api } from '@/context/AuthContext';
import {
  currentWebPushState,
  disableWebPush,
  enableWebPush,
  registerLifonkServiceWorker,
  syncExistingWebPush,
  type WebPushState,
} from '@/lib/webPush';

const labels: Record<WebPushState, string> = {
  unsupported: 'Señales del dispositivo no compatibles',
  blocked: 'Señales bloqueadas en el navegador',
  disabled: 'Activa avisos aunque Lifonk esté en segundo plano.',
  enabling: 'Activando...',
  enabled: 'Señales del dispositivo activadas',
};

export default function WebPushControls() {
  const [state, setState] = useState<WebPushState>('disabled');
  const [error, setError] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

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
      setError(requestError?.message || 'No se pudieron activar las señales.');
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
      setError('No se pudieron desactivar las señales.');
    }
  };

  const sendTest = async () => {
    setTestStatus('sending');
    setError('');
    try {
      const response = await api.post('/push/web/test');
      setTestStatus(Number(response.data?.success || 0) > 0 ? 'sent' : 'failed');
      if (!response.data?.success) setError('El proveedor no confirmó ninguna entrega.');
    } catch (requestError) {
      console.error('Web Push test:', requestError);
      setTestStatus('failed');
      setError('No se pudo entregar la prueba.');
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
              Activar señales
            </button>
          )}
          {state === 'enabled' && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button disabled={testStatus === 'sending'} onClick={() => void sendTest()} className="rounded-lg bg-teal-700 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-60">{testStatus === 'sending' ? 'Enviando…' : 'Enviar prueba'}</button>
              <button onClick={() => void disable()} className="text-[10px] font-semibold text-slate-500 underline">Desactivar</button>
              {testStatus === 'sent' && <span className="text-[10px] font-semibold text-emerald-600">Prueba enviada</span>}
              {testStatus === 'failed' && <span className="text-[10px] font-semibold text-rose-600">No se pudo entregar</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
