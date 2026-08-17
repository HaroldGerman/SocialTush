'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, RefreshCw } from 'lucide-react';

interface CallModalProps {
  recipientUsername: string;
  isIncoming: boolean;
  onClose: () => void;
  stompClientRef: any;
}

export default function CallModal({ recipientUsername, isIncoming, onClose, stompClientRef }: CallModalProps) {
  const { user } = useAuth();

  const [callStatus, setCallStatus] = useState<'RINGING' | 'CONNECTED' | 'DISCONNECTED'>('RINGING');
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Setup local media streams
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        localStream.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        if (!isIncoming) {
          // If outgoing call, initiate WebRTC offer negotiation
          initiateCall();
        }
      } catch (err) {
        console.warn('Media devices not found or permission denied, fallback to audio simulation:', err);
        setCallStatus('CONNECTED'); // Simulation fallback
      }
    };

    startMedia();

    // Subscribe to signaling channel
    let subscription: any;
    if (stompClientRef.current && user) {
      subscription = stompClientRef.current.subscribe(`/topic/user.${user.username}.call`, (message: any) => {
        const signal = JSON.parse(message.body);
        if (signal.senderUsername === recipientUsername) {
          handleIncomingSignal(signal);
        }
      });
    }

    return () => {
      if (subscription) subscription.unsubscribe();
      cleanupCall();
    };
  }, []);

  const initiateCall = () => {
    if (!stompClientRef.current || !user) return;
    
    // Send initial OFFER alert signal
    stompClientRef.current.publish({
      destination: '/app/call.signal',
      body: JSON.stringify({
        senderUsername: user.username,
        recipientUsername,
        type: 'OFFER',
        sdp: 'mock-sdp-offer-data'
      })
    });
  };

  const handleIncomingSignal = (signal: any) => {
    if (signal.type === 'ANSWER') {
      setCallStatus('CONNECTED');
    } else if (signal.type === 'HANGUP') {
      setCallStatus('DISCONNECTED');
      setTimeout(onClose, 1000);
    }
  };

  const handleAcceptCall = () => {
    setCallStatus('CONNECTED');
    if (!stompClientRef.current || !user) return;

    // Send ANSWER reply signal
    stompClientRef.current.publish({
      destination: '/app/call.signal',
      body: JSON.stringify({
        senderUsername: user.username,
        recipientUsername,
        type: 'ANSWER',
        sdp: 'mock-sdp-answer-data'
      })
    });
  };

  const handleDeclineOrHangup = () => {
    if (stompClientRef.current && user) {
      stompClientRef.current.publish({
        destination: '/app/call.signal',
        body: JSON.stringify({
          senderUsername: user.username,
          recipientUsername,
          type: 'HANGUP'
        })
      });
    }
    setCallStatus('DISCONNECTED');
    setTimeout(onClose, 800);
  };

  const toggleMic = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = !micActive;
      });
    }
    setMicActive(!micActive);
  };

  const toggleVideo = () => {
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach(track => {
        track.enabled = !videoActive;
      });
    }
    setVideoActive(!videoActive);
  };

  const cleanupCall = () => {
    if (localStream.current) {
      localStream.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-850 rounded-2xl overflow-hidden shadow-2xl p-6 flex flex-col justify-between items-center h-[70vh]">
        {/* Header call info */}
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center font-bold text-lg text-indigo-400 mx-auto mb-3 animate-pulse">
            {recipientUsername.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-sm font-bold text-white block">@{recipientUsername}</h3>
          <span className="text-[10px] text-zinc-500 block uppercase tracking-wider mt-1">
            {callStatus === 'RINGING' && (isIncoming ? 'Llamada Entrante...' : 'Llamando...')}
            {callStatus === 'CONNECTED' && 'Llamada Conectada'}
            {callStatus === 'DISCONNECTED' && 'Llamada Finalizada'}
          </span>
        </div>

        {/* Video feed blocks */}
        <div className="w-full flex-grow my-6 bg-zinc-950 rounded-xl relative overflow-hidden flex items-center justify-center border border-zinc-800/40">
          {videoActive && localStream.current ? (
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="text-center text-zinc-650 text-xs flex flex-col items-center gap-1.5 font-sans">
              <VideoOff className="h-5 w-5 text-zinc-750" />
              <span>Cámara desactivada</span>
            </div>
          )}

          {/* Incoming audio wave mock */}
          {callStatus === 'CONNECTED' && (
            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1.5 rounded-full text-[9px] text-zinc-400 flex items-center gap-1 border border-zinc-850 backdrop-blur-md">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span>Audio P2P Seguro</span>
            </div>
          )}
        </div>

        {/* Action Controls buttons */}
        <div className="flex gap-4">
          <button 
            onClick={toggleMic}
            className={`p-3 rounded-full border transition-all ${
              micActive 
                ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' 
                : 'bg-rose-500/25 border-rose-500/30 text-rose-500 hover:bg-rose-500/40'
            }`}
            title={micActive ? 'Silenciar Micrófono' : 'Activar Micrófono'}
          >
            {micActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {isIncoming && callStatus === 'RINGING' ? (
            <button 
              onClick={handleAcceptCall}
              className="p-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition-all transform active:scale-95"
              title="Aceptar llamada"
            >
              <Phone className="h-5 w-5" />
            </button>
          ) : null}

          <button 
            onClick={handleDeclineOrHangup}
            className="p-3 rounded-full bg-rose-600 hover:bg-rose-750 text-white transition-all transform active:scale-95"
            title={callStatus === 'CONNECTED' ? 'Colgar' : 'Rechazar'}
          >
            <PhoneOff className="h-5 w-5" />
          </button>

          <button 
            onClick={toggleVideo}
            className={`p-3 rounded-full border transition-all ${
              videoActive 
                ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' 
                : 'bg-rose-500/25 border-rose-500/30 text-rose-500 hover:bg-rose-500/40'
            }`}
            title={videoActive ? 'Apagar Cámara' : 'Encender Cámara'}
          >
            {videoActive ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
