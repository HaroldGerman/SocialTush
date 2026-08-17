'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { Bell, Check, MessageSquare } from 'lucide-react';
import { Client } from '@stomp/stompjs';
import { useRouter } from 'next/navigation';

interface Notification {
  notificationId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string;
  notificationType: string;
  targetId: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const stompClient = useRef<Client | null>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      const generalNotifs = (res.data || []).filter((n: Notification) => n.notificationType !== 'MESSAGE');
      setNotifications(generalNotifs);
      setUnreadCount(generalNotifs.filter((n: Notification) => !n.isRead).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();

      const client = new Client({
        brokerURL: 'ws://localhost:8080/ws/chat',
        reconnectDelay: 5000,
        debug: (str) => console.log(str),
      });

      client.onConnect = () => {
        client.subscribe(`/topic/user.${user.username}.notifications`, (msg) => {
          const newNotif = JSON.parse(msg.body) as Notification;
          if (newNotif.notificationType !== 'MESSAGE') {
            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((c) => c + 1);
          }
        });
      };

      client.activate();
      stompClient.current = client;

      return () => {
        if (stompClient.current) {
          stompClient.current.deactivate();
        }
      };
    }
  }, [user]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleClearReadNotifications = async () => {
    try {
      await api.delete('/notifications');
      setNotifications((prev) => prev.filter((n) => !n.isRead));
    } catch (err) {
      console.error('Error clearing read notifications:', err);
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.notificationId !== id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (n.notificationType === 'MESSAGE') {
      router.push('/chat');
    } else if (n.notificationType === 'FOLLOW' || n.notificationType === 'FOLLOW_REQUEST') {
      router.push(`/profile/${n.senderUsername}`);
    } else {
      router.push('/feed');
    }
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => {
          const nextState = !isOpen;
          setIsOpen(nextState);
          if (nextState && unreadCount > 0) {
            handleMarkAllRead();
          }
        }}
        className="p-2.5 rounded-full hover:bg-slate-100 text-slate-600 relative transition-all active:scale-95 border border-transparent focus:outline-none"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5 text-slate-700" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white font-extrabold text-[10px] flex items-center justify-center animate-pulse shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 mt-2.5 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Notificaciones</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-teal-700 hover:text-teal-800 font-bold"
                  >
                    Marcar todo leído
                  </button>
                )}
                <button
                  onClick={handleClearReadNotifications}
                  className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold"
                  title="Limpiar leídas"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {notifications.map((n) => (
                <div 
                  key={n.notificationId}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 flex items-start gap-3 hover:bg-slate-50 transition-all cursor-pointer ${
                    !n.isRead ? 'bg-teal-50/50' : 'bg-white'
                  }`}
                >
                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-teal-700 to-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                    {n.senderDisplayName ? n.senderDisplayName.charAt(0).toUpperCase() : 'S'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 leading-snug">
                      <strong className="text-slate-900 font-semibold">@{n.senderUsername}</strong>{' '}
                      {n.notificationType === 'LIKE_POST' && 'le dio me gusta a tu publicación.'}
                      {n.notificationType === 'COMMENT' && 'comentó en tu publicación.'}
                      {n.notificationType === 'FOLLOW' && 'comenzó a seguirte.'}
                      {n.notificationType === 'FOLLOW_REQUEST' && 'te envió una solicitud de seguimiento.'}
                      {n.notificationType === 'MESSAGE' && 'te envió un mensaje directo.'}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">Reciente</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {!n.isRead && (
                      <button 
                        onClick={(e) => handleMarkAsRead(n.notificationId, e)}
                        className="p-1 rounded-full bg-teal-100 text-teal-800 hover:bg-teal-200 transition-colors"
                        title="Marcar como leída"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeleteNotification(n.notificationId, e)}
                      className="p-1 rounded-full text-slate-300 hover:text-rose-600 transition-colors"
                      title="Eliminar"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}

              {notifications.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs font-medium">
                  Sin notificaciones pendientes
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
