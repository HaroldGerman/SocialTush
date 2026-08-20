'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/UserAvatar';
import { formatLocalTimestamp } from '@/lib/dateUtils';
import { useAuth, api } from '@/context/AuthContext';
import { WS_BASE_URL } from '@/config/api';

interface Notification { notificationId: string; senderUsername: string; senderDisplayName: string; senderAvatarUrl?: string; notificationType: string; targetId: string; isRead: boolean; createdAt: string; }

export default function NotificationBell() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]), [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(''), clientRef = useRef<Client | null>(null);
  const unreadCount = useMemo(() => notifications.filter(item => !item.isRead).length, [notifications]);
  const fetchNotifications = useCallback(async () => { try { const res = await api.get('/notifications'); setNotifications((res.data || []).filter((item: Notification) => item.notificationType !== 'MESSAGE')); setError(''); } catch (requestError) { console.error(requestError); setError('No se pudieron cargar las notificaciones.'); } }, []);

  useEffect(() => {
    if (!user || !accessToken) return;
    void fetchNotifications();
    const client = new Client({ brokerURL: WS_BASE_URL, connectHeaders: { Authorization: `Bearer ${accessToken}` }, reconnectDelay: 5000 });
    client.onConnect = () => client.subscribe(`/topic/user.${user.username}.notifications`, message => { const item = JSON.parse(message.body) as Notification; if (item.notificationType !== 'MESSAGE') setNotifications(previous => previous.some(old => old.notificationId === item.notificationId) ? previous : [item, ...previous]); });
    client.onStompError = frame => { console.error('STOMP notifications:', frame.headers.message); setError('Se perdió la conexión de notificaciones.'); };
    client.activate(); clientRef.current = client;
    return () => { void client.deactivate(); clientRef.current = null; };
  }, [user, accessToken, fetchNotifications]);

  const markRead = async (item: Notification) => { if (item.isRead) return true; try { await api.patch(`/notifications/${item.notificationId}/read`); setNotifications(old => old.map(value => value.notificationId === item.notificationId ? { ...value, isRead: true } : value)); return true; } catch (requestError) { console.error(requestError); setError('No se pudo marcar la notificación como leída.'); return false; } };
  const destination = (item: Notification) => item.notificationType === 'FOLLOW' || item.notificationType === 'FOLLOW_REQUEST' ? `/profile/${item.senderUsername}` : item.notificationType === 'LIKE_POST' || item.notificationType === 'COMMENT' ? `/post/${item.targetId}` : item.notificationType === 'MESSAGE' ? '/chat' : null;
  const openNotification = async (item: Notification) => { if (!await markRead(item)) return; const path = destination(item); if (path) { setIsOpen(false); router.push(path); } };
  const markAll = async () => { try { await api.patch('/notifications/read-all'); setNotifications(old => old.map(item => ({ ...item, isRead: true }))); } catch (requestError) { console.error(requestError); setError('No se pudieron marcar todas como leídas.'); } };
  const clearRead = async () => { try { await api.delete('/notifications'); setNotifications(old => old.filter(item => !item.isRead)); } catch (requestError) { console.error(requestError); setError('No se pudieron limpiar las notificaciones leídas.'); } };
  const remove = async (item: Notification, event: React.MouseEvent) => { event.stopPropagation(); try { await api.delete(`/notifications/${item.notificationId}`); setNotifications(old => old.filter(value => value.notificationId !== item.notificationId)); } catch (requestError) { console.error(requestError); setError('No se pudo eliminar la notificación.'); } };
  const resolveRequest = async (item: Notification, action: 'accept' | 'reject', event: React.MouseEvent) => { event.stopPropagation(); try { await api.post(`/social/requests/${item.targetId}/${action}`); setNotifications(old => old.filter(value => value.notificationId !== item.notificationId)); } catch (requestError: any) { console.error(requestError); if (requestError.response?.status === 404) void fetchNotifications(); else setError(`No se pudo ${action === 'accept' ? 'aceptar' : 'rechazar'} la solicitud.`); } };
  if (!user) return null;

  return <div className="relative"><button onClick={() => setIsOpen(value => !value)} className="relative rounded-full p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Notificaciones"><Bell className="h-5 w-5"/>{unreadCount > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">{unreadCount}</span>}</button>
    {isOpen && <><div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}/><section className="absolute right-0 z-50 mt-2.5 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"><header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><b className="text-xs">Notificaciones</b><div className="flex gap-2">{unreadCount > 0 && <button onClick={() => void markAll()} className="text-[10px] font-bold text-teal-700 dark:text-teal-300">Marcar todo</button>}<button onClick={() => void clearRead()} className="text-[10px] text-slate-500">Limpiar leídas</button></div></header>{error && <button onClick={() => setError('')} className="w-full bg-rose-50 p-2 text-left text-[11px] text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</button>}<div className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">{notifications.map(item => <article key={item.notificationId} onClick={() => void openNotification(item)} className={`flex cursor-pointer gap-3 p-3 ${item.isRead ? '' : 'bg-teal-50/60 dark:bg-teal-950/30'} hover:bg-slate-50 dark:hover:bg-slate-800`}><UserAvatar avatarUrl={item.senderAvatarUrl} name={item.senderDisplayName || item.senderUsername} className="h-9 w-9 flex-shrink-0 rounded-full text-xs"/><div className="min-w-0 flex-1"><p className="text-xs text-slate-700 dark:text-slate-200"><b>@{item.senderUsername}</b>{item.notificationType === 'LIKE_POST' && ' le dio me gusta a tu publicación.'}{item.notificationType === 'COMMENT' && ' comentó en tu publicación.'}{item.notificationType === 'FOLLOW' && ' comenzó a seguirte.'}{item.notificationType === 'FOLLOW_REQUEST' && ' te envió una solicitud de seguimiento.'}</p><time className="mt-1 block text-[10px] text-slate-400">{formatLocalTimestamp(item.createdAt)}</time>{item.notificationType === 'FOLLOW_REQUEST' && <div className="mt-2 flex gap-2"><button onClick={event => void resolveRequest(item, 'accept', event)} className="rounded-lg bg-teal-700 px-3 py-1 text-[10px] font-bold text-white">Aceptar</button><button onClick={event => void resolveRequest(item, 'reject', event)} className="rounded-lg border border-slate-300 px-3 py-1 text-[10px] dark:border-slate-600">Rechazar</button></div>}</div><div className="flex gap-1">{!item.isRead && <button onClick={event => { event.stopPropagation(); void markRead(item); }} aria-label="Marcar como leída" className="h-6 rounded-full bg-teal-100 p-1 text-teal-800"><Check className="h-3 w-3"/></button>}<button onClick={event => void remove(item, event)} aria-label="Eliminar notificación" className="h-6 px-1 text-slate-400 hover:text-rose-600">×</button></div></article>)}{!notifications.length && <p className="py-8 text-center text-xs text-slate-400">Sin notificaciones.</p>}</div></section></>}
  </div>;
}
