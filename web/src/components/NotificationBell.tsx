'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { Bell, Heart, MessageSquare, UserPlus, Mail, Circle, Check } from 'lucide-react';
import { Client } from '@stomp/stompjs';

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const stompClient = useRef<Client | null>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
      
      const countRes = await api.get('/notifications/unread-count');
      setUnreadCount(countRes.data.count);
    } catch (err) {
      // Mock notifications in fallback case
      setNotifications(getMockNotifications());
      setUnreadCount(1);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();

      // Subscribe to real-time notifications via STOMP WebSocket
      const client = new Client({
        brokerURL: 'ws://localhost:8080/ws/chat',
        reconnectDelay: 5000,
        debug: (str) => console.log(str),
      });

      client.onConnect = () => {
        client.subscribe(`/topic/user.${user.username}.notifications`, (msg) => {
          const newNotif = JSON.parse(msg.body) as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadCount((c) => c + 1);
        });
      };

      client.activate();
      stompClient.current = client;

      return () => {
        if (stompClient.current) stompClient.current.deactivate();
      };
    }
  }, [user]);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      // Offline fallback
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-zinc-300 relative active:scale-95"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-indigo-600 text-white font-extrabold text-[9px] flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Overlay to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="absolute right-0 mt-2.5 w-80 bg-zinc-900 border border-zinc-850 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-bold text-white">Actividad</span>
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllRead}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Marcar todo leído
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/40">
              {notifications.map((n) => (
                <div 
                  key={n.notificationId}
                  className={`p-3 flex items-start gap-3 hover:bg-zinc-950/20 transition-all cursor-pointer ${
                    !n.isRead ? 'bg-indigo-500/5' : 'bg-transparent'
                  }`}
                >
                  <div className="h-8 w-8 rounded-full bg-zinc-850 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {n.senderDisplayName.charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-zinc-300 leading-normal">
                      <strong className="text-white">@{n.senderUsername}</strong>{' '}
                      {n.notificationType === 'LIKE_POST' && 'le dio me gusta a tu post.'}
                      {n.notificationType === 'COMMENT' && 'comentó en tu post.'}
                      {n.notificationType === 'FOLLOW' && 'comenzó a seguirte.'}
                      {n.notificationType === 'FOLLOW_REQUEST' && 'te envió una solicitud de seguimiento.'}
                    </p>
                    <span className="text-[9px] text-zinc-650 mt-1 block">hace un momento</span>
                  </div>

                  {!n.isRead && (
                    <button 
                      onClick={(e) => handleMarkAsRead(n.notificationId, e)}
                      className="p-1 rounded-full bg-zinc-950 border border-zinc-800 text-indigo-400 hover:bg-zinc-800 transition-colors"
                      title="Marcar como leída"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}

              {notifications.length === 0 && (
                <div className="text-center py-8 text-zinc-600 text-xs font-semibold">
                  Sin notificaciones recientes
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getMockNotifications(): Notification[] {
  return [
    {
      notificationId: 'n1',
      senderUsername: 'sophia',
      senderDisplayName: 'Sophia Loren',
      senderAvatarUrl: '',
      notificationType: 'LIKE_POST',
      targetId: 't1',
      isRead: false,
      createdAt: new Date().toISOString()
    }
  ];
}
