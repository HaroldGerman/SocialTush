'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { api, useAuth } from '@/context/AuthContext';
import { WS_BASE_URL } from '@/config/api';
import CallModal, { CallMode } from '@/components/CallModal';

type PendingCall = {
  senderUsername?: string;
  recipientUsername?: string;
  type?: string;
  callMode?: CallMode;
  sdp?: string;
};

export default function IncomingCallBridge() {
  const { user, accessToken } = useAuth();
  const clientRef = useRef<Client | null>(null);
  const [pending, setPending] = useState<PendingCall | null>(null);
  const [ready, setReady] = useState(false);
  const checkingRef = useRef(false);

  const clearIncomingParam = useCallback(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('incomingCall')) return;
    url.searchParams.delete('incomingCall');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const close = useCallback(() => {
    setPending(null);
    setReady(false);
    clearIncomingParam();
    const client = clientRef.current;
    clientRef.current = null;
    if (client) void client.deactivate();
  }, [clearIncomingParam]);

  const openPending = useCallback(async () => {
    if (!user || checkingRef.current || pending) return;
    const params = new URLSearchParams(window.location.search);
    if (!window.location.pathname.startsWith('/chat') || params.get('incomingCall') !== '1') return;
    checkingRef.current = true;
    try {
      const response = await api.get('/chat/calls/pending', { validateStatus: status => status === 200 || status === 204 });
      if (response.status !== 200 || !response.data?.sdp || response.data?.type !== 'OFFER' || !response.data?.senderUsername) {
        clearIncomingParam();
        return;
      }
      const signal = response.data as PendingCall;
      const client = new Client({
        brokerURL: WS_BASE_URL,
        connectHeaders: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        reconnectDelay: 3000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });
      client.onConnect = () => {
        clientRef.current = client;
        setPending(signal);
        setReady(true);
      };
      client.onStompError = () => setReady(false);
      client.activate();
      clientRef.current = client;
    } catch (error) {
      console.error('No se pudo recuperar la llamada entrante:', error);
      clearIncomingParam();
    } finally {
      checkingRef.current = false;
    }
  }, [accessToken, clearIncomingParam, pending, user]);

  useEffect(() => {
    if (!user) return;
    void openPending();
    const onVisibility = () => { if (document.visibilityState === 'visible') void openPending(); };
    const onFocus = () => void openPending();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [openPending, user]);

  useEffect(() => () => {
    const client = clientRef.current;
    clientRef.current = null;
    if (client) void client.deactivate();
  }, []);

  if (!ready || !pending?.senderUsername || !pending.sdp) return null;

  return <CallModal
    recipientUsername={pending.senderUsername}
    isIncoming
    callMode={pending.callMode === 'VIDEO' ? 'VIDEO' : 'AUDIO'}
    initialOfferSdp={pending.sdp}
    onClose={close}
    stompClientRef={clientRef}
  />;
}
