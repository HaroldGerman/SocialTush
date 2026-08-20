'use client';

import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import WebPushControls from '@/components/WebPushControls';
import { formatLocalTimestamp } from '@/lib/dateUtils';
import { api, useAuth } from '@/context/AuthContext';
import { type Signal, useRealtimeActivity } from '@/context/RealtimeActivityContext';

function signalCopy(type: string): string {
  switch (type) {
    case 'LIKE_POST': return ' resonó con tu contribución.';
    case 'LIKE_COMMENT': return ' resonó con tu eco.';
    case 'COMMENT': return ' dejó un eco en tu contribución.';
    case 'COMMENT_REPLY': return ' respondió a tu eco.';
    case 'FOLLOW': return ' conectó contigo.';
    case 'FOLLOW_REQUEST': return ' quiere conectar contigo.';
    case 'STORY_REPLY': return ' respondió a tu momento.';
    case 'STORY_REACTION': return ' reaccionó a tu momento.';
    default: return ' generó una nueva señal.';
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const activity = useRealtimeActivity();

  const markRead = async (signal: Signal) => {
    if (signal.isRead) return true;
    try {
      await api.patch(`/notifications/${signal.notificationId}/read`);
      activity.markSignalReadLocal(signal.notificationId);
      return true;
    } catch (requestError) {
      console.error(requestError);
      setError('No se pudo marcar la señal como leída.');
      return false;
    }
  };

  const destination = (signal: Signal) => {
    if (signal.notificationType === 'FOLLOW' || signal.notificationType === 'FOLLOW_REQUEST') return `/profile/${signal.senderUsername}`;
    if (signal.notificationType === 'LIKE_POST' || signal.notificationType === 'COMMENT') return `/post/${signal.targetId}`;
    if (signal.notificationType === 'MESSAGE') return `/chat?username=${encodeURIComponent(signal.senderUsername)}`;
    return '/feed';
  };

  const openSignal = async (signal: Signal) => {
    if (!await markRead(signal)) return;
    setIsOpen(false);
    router.push(destination(signal));
  };

  const markAll = async () => {
    try { await api.patch('/notifications/read-all'); activity.markAllSignalsReadLocal(); }
    catch (requestError) { console.error(requestError); setError('No se pudieron marcar todas las señales como leídas.'); }
  };
  const clearRead = async () => {
    try { await api.delete('/notifications'); activity.removeReadSignalsLocal(); }
    catch (requestError) { console.error(requestError); setError('No se pudieron limpiar las señales leídas.'); }
  };
  const resolveRequest = async (signal: Signal, action: 'accept' | 'reject', event: React.MouseEvent) => {
    event.stopPropagation();
    try { await api.post(`/social/requests/${signal.targetId}/${action}`); activity.removeSignalLocal(signal.notificationId); }
    catch (requestError: any) {
      console.error(requestError);
      if (requestError.response?.status === 404) void activity.reconcileActivity();
      else setError(`No se pudo ${action === 'accept' ? 'aceptar' : 'rechazar'} la solicitud.`);
    }
  };

  if (!user) return null;
  return <div className="relative">
    <button onClick={() => setIsOpen(value => !value)} className="relative rounded-full p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Señales"><Bell className="h-5 w-5" />{activity.signalUnreadCount > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">{activity.signalUnreadCount > 99 ? '99+' : activity.signalUnreadCount}</span>}</button>
    {isOpen && <><div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} /><section className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4rem)] z-50 max-h-[calc(100dvh-5rem-env(safe-area-inset-bottom))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2.5 sm:w-80">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><b className="text-xs">Señales</b><div className="flex gap-2">{activity.signalUnreadCount > 0 && <button onClick={() => void markAll()} className="text-[10px] font-bold text-teal-700 dark:text-teal-300">Marcar todo</button>}<button onClick={() => void clearRead()} className="text-[10px] text-slate-500">Limpiar leídas</button></div></header>
      <WebPushControls />
      {(error || activity.activityError) && <button onClick={() => { setError(''); void activity.reconcileActivity(); }} className="w-full bg-rose-50 p-2 text-left text-[11px] text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error || activity.activityError}</button>}
      <div className="max-h-[min(24rem,calc(100dvh-14rem))] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">{activity.signals.map(signal => <article key={signal.notificationId} onClick={() => void openSignal(signal)} className={`flex cursor-pointer gap-3 p-3 ${signal.isRead ? '' : 'bg-teal-50/60 dark:bg-teal-950/30'} hover:bg-slate-50 dark:hover:bg-slate-800`}><UserAvatar avatarUrl={signal.senderAvatarUrl} name={signal.senderDisplayName || signal.senderUsername} className="h-9 w-9 flex-shrink-0 rounded-full text-xs" /><div className="min-w-0 flex-1"><p className="break-words text-xs text-slate-700 dark:text-slate-200"><b>@{signal.senderUsername}</b>{signalCopy(signal.notificationType)}</p><time className="mt-1 block text-[10px] text-slate-400">{formatLocalTimestamp(signal.createdAt)}</time>{signal.notificationType === 'FOLLOW_REQUEST' && <div className="mt-2 flex gap-2"><button onClick={event => void resolveRequest(signal, 'accept', event)} className="rounded-lg bg-teal-700 px-3 py-1 text-[10px] font-bold text-white">Aceptar</button><button onClick={event => void resolveRequest(signal, 'reject', event)} className="rounded-lg border border-slate-300 px-3 py-1 text-[10px] dark:border-slate-600">Rechazar</button></div>}</div>{!signal.isRead && <button onClick={event => { event.stopPropagation(); void markRead(signal); }} aria-label="Marcar señal como leída" title="Marcar como leída" className="h-8 min-w-8 rounded-full text-slate-400 hover:text-teal-700">×</button>}</article>)}{!activity.signals.length && <p className="py-8 text-center text-xs text-slate-400">No tienes señales nuevas.</p>}</div>
    </section></>}
  </div>;
}
