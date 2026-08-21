'use client';

import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { enableWebPush, syncExistingWebPush, webPushSupported } from '@/lib/webPush';

export default function WebPushAutoSync() {
  const { user, accessToken } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !accessToken || !webPushSupported()) return;
    let cancelled = false;
    const sync = async () => {
      if (Notification.permission === 'granted') {
        try { await syncExistingWebPush(); } catch (error) { console.error('Web Push auto-sync:', error); }
        if (!cancelled) setShowPrompt(false);
      } else if (Notification.permission === 'default' && sessionStorage.getItem('lifonk-push-prompt-dismissed') !== '1') {
        if (!cancelled) setShowPrompt(true);
      }
    };
    void sync();
    const onVisible = () => { if (document.visibilityState === 'visible') void sync(); };
    const onOnline = () => void sync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const timer = window.setInterval(sync, 60000);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline); window.clearInterval(timer); };
  }, [user, accessToken]);

  const activate = async () => {
    setBusy(true);
    try { await enableWebPush(); setShowPrompt(false); }
    catch (error) { console.error('Web Push permission:', error); }
    finally { setBusy(false); }
  };
  const dismiss = () => { sessionStorage.setItem('lifonk-push-prompt-dismissed', '1'); setShowPrompt(false); };

  if (!showPrompt) return null;
  return <div className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-3 right-3 z-[2147482000] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-teal-200 bg-white/95 p-3 shadow-2xl backdrop-blur dark:border-teal-900 dark:bg-[#101827]/95">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><BellRing className="h-5 w-5"/></div>
    <div className="min-w-0 flex-1"><p className="text-xs font-extrabold text-slate-900 dark:text-white">Recibe señales aunque Lifonk esté cerrado</p><p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Activa las notificaciones del navegador una sola vez.</p></div>
    <button type="button" onClick={()=>void activate()} disabled={busy} className="rounded-xl bg-teal-700 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50">{busy?'Activando…':'Activar'}</button>
    <button type="button" onClick={dismiss} className="p-1 text-slate-400" aria-label="Cerrar"><X className="h-4 w-4"/></button>
  </div>;
}
