'use client';

import { useEffect, useRef, useState } from 'react';
import { CircleStop, Video } from 'lucide-react';

const MAX_SECONDS = 30;

function findStoryCameraVideo() {
  return Array.from(document.querySelectorAll<HTMLVideoElement>('video[autoplay]')).find((video) => {
    let node: HTMLElement | null = video;
    while (node) {
      const cls = typeof node.className === 'string' ? node.className : '';
      if (cls.includes('fixed') && cls.includes('inset-0') && cls.includes('z-[110]')) return true;
      node = node.parentElement;
    }
    return false;
  }) || null;
}

function chooseMimeType() {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';
}

export default function StoryCameraVideoRecorder() {
  const [cameraVideo, setCameraVideo] = useState<HTMLVideoElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const scan = () => setCameraVideo(findStoryCameraVideo());
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(scan, 500);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  const cleanupTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const deliverFileToStoryEditor = (file: File) => {
    const closeButton = cameraVideo?.parentElement?.querySelector<HTMLButtonElement>('button');
    closeButton?.click();
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('input[type="file"][accept="image/*,video/*"]');
      if (!input) return;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 120);
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  };

  const startRecording = async () => {
    if (!cameraVideo?.srcObject || recording) return;
    try {
      const cameraStream = cameraVideo.srcObject as MediaStream;
      const videoTracks = cameraStream.getVideoTracks();
      if (!videoTracks.length) return;

      let audioTracks: MediaStreamTrack[] = [];
      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioTracks = micStreamRef.current.getAudioTracks();
      } catch {
        audioTracks = [];
      }

      const combined = new MediaStream([...videoTracks, ...audioTracks]);
      const mimeType = chooseMimeType();
      const recorder = new MediaRecorder(combined, mimeType ? { mimeType, videoBitsPerSecond: 4_000_000 } : { videoBitsPerSecond: 4_000_000 });
      recorderRef.current = recorder;
      chunksRef.current = [];
      setSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        cleanupTimer();
        setRecording(false);
        micStreamRef.current?.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
        const type = recorder.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (!blob.size) return;
        deliverFileToStoryEditor(new File([blob], `momento_${Date.now()}.webm`, { type }));
      };
      recorder.onerror = () => {
        cleanupTimer();
        setRecording(false);
        micStreamRef.current?.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
      };

      recorder.start(250);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setSeconds((current) => {
          const next = current + 1;
          if (next >= MAX_SECONDS) window.setTimeout(stopRecording, 0);
          return next;
        });
      }, 1000);
    } catch (error) {
      console.error('No se pudo iniciar la grabación del Momento:', error);
    }
  };

  useEffect(() => () => {
    cleanupTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  if (!cameraVideo) return null;

  return (
    <div className="fixed bottom-[132px] left-1/2 z-[140] -translate-x-1/2">
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-black text-white shadow-2xl backdrop-blur ${recording ? 'border-rose-300 bg-rose-600' : 'border-white/30 bg-black/65'}`}
      >
        {recording ? <CircleStop className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        {recording ? `Detener · 0:${String(seconds).padStart(2, '0')}` : 'Grabar video'}
      </button>
    </div>
  );
}
