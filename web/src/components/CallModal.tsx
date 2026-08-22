'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';

export type CallMode = 'AUDIO' | 'VIDEO';
type CallStatus = 'CALLING' | 'INCOMING' | 'CONNECTING' | 'CONNECTED' | 'ENDED' | 'FAILED';

interface CallModalProps {
  recipientUsername: string;
  isIncoming: boolean;
  callMode: CallMode;
  initialOfferSdp?: string | null;
  onClose: () => void;
  stompClientRef: React.MutableRefObject<any>;
}

interface CallSignal {
  senderUsername: string;
  recipientUsername: string;
  type: 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'HANGUP' | 'REJECT' | 'BUSY';
  callMode?: CallMode;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

function configuredIceServers(): RTCIceServer[] {
  const stunUrls = (process.env.NEXT_PUBLIC_WEBRTC_STUN_URLS || 'stun:stun.l.google.com:19302')
    .split(',').map(value => value.trim()).filter(Boolean);
  const servers: RTCIceServer[] = stunUrls.length ? [{ urls: stunUrls }] : [];
  const turnUrl = process.env.NEXT_PUBLIC_WEBRTC_TURN_URL;
  if (turnUrl) servers.push({
    urls: turnUrl,
    username: process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME || '',
    credential: process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL || '',
  });
  return servers;
}

function playTone(context: AudioContext, frequency: number, durationMs: number, gainValue = 0.055) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(gainValue, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationMs / 1000);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + durationMs / 1000);
}

export default function CallModal({ recipientUsername, isIncoming, callMode, initialOfferSdp, onClose, stompClientRef }: CallModalProps) {
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>(isIncoming ? 'INCOMING' : 'CALLING');
  const [error, setError] = useState('');
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(callMode === 'VIDEO');
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const publish = useCallback((signal: Partial<CallSignal> & Pick<CallSignal, 'type'>) => {
    if (!stompClientRef.current?.connected || !user) throw new Error('La señalización no está conectada.');
    stompClientRef.current.publish({ destination: '/app/call.signal', body: JSON.stringify({
      senderUsername: user.username, recipientUsername, callMode, ...signal,
    }) });
  }, [callMode, recipientUsername, stompClientRef, user]);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    remoteStreamRef.current?.getTracks().forEach(track => remoteStreamRef.current?.removeTrack(track));
    remoteStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  }, []);

  const finish = useCallback((sendSignal: boolean, type: 'HANGUP' | 'REJECT' = 'HANGUP') => {
    if (sendSignal) try { publish({ type }); } catch (signalError) { console.error('No se pudo señalizar el fin:', signalError); }
    cleanup();
    setCallStatus('ENDED');
    window.setTimeout(onClose, 400);
  }, [cleanup, onClose, publish]);

  useEffect(() => {
    if (callStatus !== 'CALLING' && callStatus !== 'INCOMING') return;
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    void context.resume().catch(() => undefined);
    let cancelled = false;
    const timers: number[] = [];

    const ring = () => {
      if (cancelled || context.state === 'closed') return;
      if (callStatus === 'INCOMING') {
        playTone(context, 740, 360, 0.075);
        timers.push(window.setTimeout(() => playTone(context, 880, 360, 0.075), 430));
      } else {
        playTone(context, 440, 420, 0.05);
        timers.push(window.setTimeout(() => playTone(context, 480, 420, 0.05), 480));
      }
    };

    ring();
    const interval = window.setInterval(ring, callStatus === 'INCOMING' ? 2200 : 2900);
    let vibrationInterval: number | null = null;
    if (callStatus === 'INCOMING' && 'vibrate' in navigator) {
      navigator.vibrate?.([280, 140, 280, 140, 520]);
      vibrationInterval = window.setInterval(() => navigator.vibrate?.([280, 140, 280, 140, 520]), 2400);
    }

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (vibrationInterval !== null) window.clearInterval(vibrationInterval);
      timers.forEach(timer => window.clearTimeout(timer));
      navigator.vibrate?.(0);
      void context.close().catch(() => undefined);
    };
  }, [callStatus]);

  const getLocalMedia = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('MediaDevices no está disponible.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callMode === 'VIDEO' });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      await localVideoRef.current.play().catch(() => undefined);
    }
    return stream;
  }, [callMode]);

  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: configuredIceServers() });
    remoteStreamRef.current = new MediaStream();
    peerConnectionRef.current = pc;
    pc.onicecandidate = event => {
      if (event.candidate) try { publish({ type: 'ICE_CANDIDATE', candidate: event.candidate.toJSON() }); }
      catch (signalError) { console.error('No se pudo enviar ICE:', signalError); }
    };
    pc.ontrack = event => {
      event.streams[0]?.getTracks().forEach(track => {
        if (remoteStreamRef.current && !remoteStreamRef.current.getTracks().some(existing => existing.id === track.id)) remoteStreamRef.current.addTrack(track);
      });
      const element = callMode === 'VIDEO' ? remoteVideoRef.current : remoteAudioRef.current;
      if (element) {
        element.srcObject = remoteStreamRef.current;
        element.play().catch(playError => console.error('No se pudo reproducir el stream remoto:', playError));
      }
    };
    const updateState = () => {
      if (pc.connectionState === 'connected' || ['connected', 'completed'].includes(pc.iceConnectionState)) setCallStatus('CONNECTED');
      else if (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed') {
        setError('No se pudo establecer la conexión P2P.'); setCallStatus('FAILED');
      }
    };
    pc.onconnectionstatechange = updateState;
    pc.oniceconnectionstatechange = updateState;
    return pc;
  }, [callMode, publish]);

  const flushCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc?.remoteDescription) return;
    for (const candidate of pendingCandidatesRef.current.splice(0)) await pc.addIceCandidate(candidate);
  }, []);

  const startOutgoing = useCallback(async () => {
    try {
      setCallStatus('CONNECTING');
      const pc = createPeer();
      const stream = await getLocalMedia();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      publish({ type: 'OFFER', sdp: offer.sdp });
      setCallStatus('CALLING');
    } catch (mediaError) {
      console.error('No se pudo iniciar la llamada:', mediaError);
      cleanup(); setError('No se pudo acceder al micrófono/cámara o iniciar la llamada.'); setCallStatus('FAILED');
    }
  }, [cleanup, createPeer, getLocalMedia, publish]);

  const acceptIncoming = async () => {
    if (!initialOfferSdp) return void (setError('La oferta de llamada no es válida.'), setCallStatus('FAILED'));
    try {
      setCallStatus('CONNECTING');
      const pc = createPeer();
      await pc.setRemoteDescription({ type: 'offer', sdp: initialOfferSdp });
      const stream = await getLocalMedia();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      await flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      publish({ type: 'ANSWER', sdp: answer.sdp });
    } catch (mediaError) {
      console.error('No se pudo aceptar la llamada:', mediaError);
      cleanup(); setError('No se pudo acceder al micrófono/cámara.'); setCallStatus('FAILED');
    }
  };

  useEffect(() => {
    const subscription = stompClientRef.current?.subscribe(`/topic/user.${user?.username}.call`, async (message: any) => {
      const signal = JSON.parse(message.body) as CallSignal;
      if (signal.senderUsername.toLowerCase() !== recipientUsername.toLowerCase()) return;
      try {
        if (signal.type === 'ANSWER' && signal.sdp && peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription({ type: 'answer', sdp: signal.sdp }); await flushCandidates(); setCallStatus('CONNECTING');
        } else if (signal.type === 'ICE_CANDIDATE' && signal.candidate) {
          if (peerConnectionRef.current?.remoteDescription) await peerConnectionRef.current.addIceCandidate(signal.candidate);
          else pendingCandidatesRef.current.push(signal.candidate);
        } else if (['HANGUP', 'REJECT', 'BUSY'].includes(signal.type)) {
          if (signal.type === 'REJECT') setError('La llamada fue rechazada.');
          if (signal.type === 'BUSY') setError('La persona está ocupada.');
          finish(false);
        }
      } catch (signalError) {
        console.error('Error procesando señal WebRTC:', signalError); setError('Falló la negociación de la llamada.'); setCallStatus('FAILED');
      }
    });
    if (!isIncoming) startOutgoing();
    return () => { subscription?.unsubscribe(); cleanup(); };
  }, [cleanup, finish, flushCandidates, isIncoming, recipientUsername, startOutgoing, stompClientRef, user?.username]);

  const toggleMic = () => { const next = !micActive; localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = next; }); setMicActive(next); };
  const toggleVideo = () => { const next = !videoActive; localStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = next; }); setVideoActive(next); };
  const statusText: Record<CallStatus, string> = {
    CALLING: `Llamando a @${recipientUsername}…`, INCOMING: `${callMode === 'VIDEO' ? 'Videollamada' : 'Llamada'} entrante`,
    CONNECTING: 'Conectando…', CONNECTED: 'Conectada', ENDED: 'Finalizada', FAILED: 'Falló',
  };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
    <div className="flex h-[min(78dvh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
      <div className="text-center text-white"><h3 className="font-bold">@{recipientUsername}</h3><p className="text-xs text-zinc-400">{statusText[callStatus]}</p>{error && <p className="mt-2 text-xs text-rose-400">{error}</p>}</div>
      <div className="relative my-4 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-zinc-950">
        {callMode === 'VIDEO' ? <><video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" /><video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-3 right-3 h-28 w-20 rounded-lg border border-white/20 object-cover -scale-x-100" /></>
          : <><audio ref={remoteAudioRef} autoPlay /><div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#443C68] text-3xl font-bold text-white">{recipientUsername.charAt(0).toUpperCase()}</div></>}
      </div>
      <div className="flex justify-center gap-4">
        <button onClick={toggleMic} disabled={!localStreamRef.current} className="rounded-full bg-zinc-800 p-3 text-white disabled:opacity-40">{micActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</button>
        {isIncoming && callStatus === 'INCOMING' && <button onClick={acceptIncoming} className="rounded-full bg-emerald-600 p-3 text-white" title="Aceptar"><Phone className="h-5 w-5" /></button>}
        <button onClick={() => finish(true, isIncoming && callStatus === 'INCOMING' ? 'REJECT' : 'HANGUP')} className="rounded-full bg-rose-600 p-3 text-white" title={callStatus === 'INCOMING' ? 'Rechazar' : 'Colgar'}><PhoneOff className="h-5 w-5" /></button>
        {callMode === 'VIDEO' && <button onClick={toggleVideo} disabled={!localStreamRef.current} className="rounded-full bg-zinc-800 p-3 text-white disabled:opacity-40">{videoActive ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</button>}
      </div>
    </div>
  </div>;
}
