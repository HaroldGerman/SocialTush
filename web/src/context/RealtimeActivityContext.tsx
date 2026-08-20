'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { api, useAuth } from '@/context/AuthContext';
import { WS_BASE_URL } from '@/config/api';

export interface Signal {
  notificationId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl?: string;
  notificationType: string;
  targetId: string;
  messagePreview?: string;
  isRead: boolean;
  createdAt: string;
}

export interface RealtimeConversation {
  conversationId: string | null;
  unreadCount?: number;
  [key: string]: unknown;
}

interface RealtimeActivityValue {
  signals: Signal[];
  conversations: RealtimeConversation[];
  signalUnreadCount: number;
  totalUnreadMessages: number;
  activityError: string;
  reconcileActivity: () => Promise<void>;
  markSignalReadLocal: (notificationId: string) => void;
  markAllSignalsReadLocal: () => void;
  removeReadSignalsLocal: () => void;
  removeSignalLocal: (notificationId: string) => void;
  markConversationReadLocal: (conversationId: string) => void;
}

const RealtimeActivityContext = createContext<RealtimeActivityValue | null>(null);

export function RealtimeActivityProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [conversations, setConversations] = useState<RealtimeConversation[]>([]);
  const [activityError, setActivityError] = useState('');
  const clientRef = useRef<Client | null>(null);
  const reconcilePromiseRef = useRef<Promise<void> | null>(null);

  const reconcileActivity = useCallback(async () => {
    if (!user) return;
    if (reconcilePromiseRef.current) return reconcilePromiseRef.current;
    const request = Promise.all([api.get('/notifications'), api.get('/chat/conversations')])
      .then(([signalsResponse, conversationsResponse]) => {
        const fetchedSignals = Array.isArray(signalsResponse.data) ? signalsResponse.data : [];
        setSignals(fetchedSignals.filter((item: Signal) => item.notificationType !== 'MESSAGE'));
        setConversations(Array.isArray(conversationsResponse.data) ? conversationsResponse.data : []);
        setActivityError('');
      })
      .catch(error => {
        console.error('Realtime reconciliation:', error);
        setActivityError('No se pudo sincronizar el movimiento reciente.');
      })
      .finally(() => { reconcilePromiseRef.current = null; });
    reconcilePromiseRef.current = request;
    return request;
  }, [user]);

  useEffect(() => {
    if (!user || !accessToken) {
      setSignals([]);
      setConversations([]);
      return;
    }
    void reconcileActivity();
    const client = new Client({
      brokerURL: WS_BASE_URL,
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    });
    client.onConnect = () => {
      void reconcileActivity();
      client.subscribe(`/topic/user.${user.username}.notifications`, frame => {
        try {
          const signal = JSON.parse(frame.body) as Signal;
          if (signal.notificationType === 'MESSAGE') {
            void reconcileActivity();
            return;
          }
          setSignals(previous => previous.some(item => item.notificationId === signal.notificationId)
            ? previous.map(item => item.notificationId === signal.notificationId ? signal : item)
            : [signal, ...previous]);
        } catch (error) {
          console.error('Invalid realtime signal:', error);
          void reconcileActivity();
        }
      });
    };
    client.onStompError = frame => {
      console.error('STOMP activity:', frame.headers.message);
      setActivityError('La conexión en tiempo real se interrumpió; se reconciliará automáticamente.');
    };
    client.activate();
    clientRef.current = client;
    return () => {
      void client.deactivate();
      clientRef.current = null;
    };
  }, [user, accessToken, reconcileActivity]);

  useEffect(() => {
    if (!user) return;
    const reconcileWhenVisible = () => {
      if (document.visibilityState === 'visible') void reconcileActivity();
    };
    const reconcileNow = () => void reconcileActivity();
    document.addEventListener('visibilitychange', reconcileWhenVisible);
    window.addEventListener('focus', reconcileNow);
    window.addEventListener('pageshow', reconcileNow);
    return () => {
      document.removeEventListener('visibilitychange', reconcileWhenVisible);
      window.removeEventListener('focus', reconcileNow);
      window.removeEventListener('pageshow', reconcileNow);
    };
  }, [user, reconcileActivity]);

  const markSignalReadLocal = useCallback((notificationId: string) => setSignals(previous => previous.map(signal =>
    signal.notificationId === notificationId ? { ...signal, isRead: true } : signal)), []);
  const markAllSignalsReadLocal = useCallback(() => setSignals(previous => previous.map(signal => ({ ...signal, isRead: true }))), []);
  const removeReadSignalsLocal = useCallback(() => setSignals(previous => previous.filter(signal => !signal.isRead)), []);
  const removeSignalLocal = useCallback((notificationId: string) => setSignals(previous => previous.filter(signal => signal.notificationId !== notificationId)), []);
  const markConversationReadLocal = useCallback((conversationId: string) => setConversations(previous => previous.map(conversation =>
    conversation.conversationId === conversationId ? { ...conversation, unreadCount: 0 } : conversation)), []);

  const value = useMemo<RealtimeActivityValue>(() => ({
    signals,
    conversations,
    signalUnreadCount: signals.filter(signal => !signal.isRead).length,
    totalUnreadMessages: conversations.reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0),
    activityError,
    reconcileActivity,
    markSignalReadLocal,
    markAllSignalsReadLocal,
    removeReadSignalsLocal,
    removeSignalLocal,
    markConversationReadLocal,
  }), [signals, conversations, activityError, reconcileActivity, markSignalReadLocal, markAllSignalsReadLocal, removeReadSignalsLocal, removeSignalLocal, markConversationReadLocal]);

  return <RealtimeActivityContext.Provider value={value}>{children}</RealtimeActivityContext.Provider>;
}

export function useRealtimeActivity() {
  const context = useContext(RealtimeActivityContext);
  if (!context) throw new Error('useRealtimeActivity debe usarse dentro de RealtimeActivityProvider');
  return context;
}
