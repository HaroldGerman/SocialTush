'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Video, X } from 'lucide-react';

function nativeChatInputFor(file: File) {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'))
    .filter(input => input.dataset.chatCaptureBridge !== 'true');

  if (file.type.startsWith('image/')) {
    return inputs.find(input => input.hasAttribute('capture') && input.accept.includes('image/'))
      || inputs.find(input => input.accept.includes('image/'))
      || null;
  }

  if (file.type.startsWith('video/')) {
    return inputs.find(input => input.accept.includes('video/')) || null;
  }

  return null;
}

function forwardFileToChat(file: File | undefined) {
  if (!file) return false;
  const input = nativeChatInputFor(file);
  if (!input) return false;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export default function ChatCameraCaptureBridge() {
  const [open, setOpen] = useState(false);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!window.location.pathname.startsWith('/chat')) return;
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button || !button.closest('form') || !button.querySelector('svg.lucide-camera')) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  const receive = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (forwardFileToChat(file)) setOpen(false);
    event.target.value = '';
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483000] flex items-end bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onClick={() => setOpen(false)}>
      <div className="w-full rounded-[28px] border border-[#443C68]/25 bg-white p-4 shadow-2xl dark:border-[#6d628f]/50 dark:bg-[#100d19] sm:max-w-sm" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div><p className="text-sm font-black text-[#1A1620] dark:text-white">Cámara</p><p className="text-[10px] text-slate-500 dark:text-slate-400">Elige qué quieres capturar para el chat.</p></div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => photoRef.current?.click()} className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-[#443C68]/20 bg-[#EFE8E3]/55 font-bold text-[#443C68] dark:border-[#6d628f]/50 dark:bg-[#1A1620] dark:text-[#d8cff2]"><Camera className="h-7 w-7" /><span className="text-xs">Tomar foto</span></button>
          <button type="button" onClick={() => videoRef.current?.click()} className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-[#C97B63]/30 bg-[#C97B63]/10 font-bold text-[#9d5845] dark:bg-[#C97B63]/15 dark:text-[#e7ad9c]"><Video className="h-7 w-7" /><span className="text-xs">Grabar video</span></button>
        </div>
        <input ref={photoRef} data-chat-capture-bridge="true" data-no-crop="true" type="file" accept="image/*" capture="environment" className="hidden" onChange={receive} />
        <input ref={videoRef} data-chat-capture-bridge="true" data-no-crop="true" type="file" accept="video/*" capture="environment" className="hidden" onChange={receive} />
        <p className="mt-3 text-center text-[10px] text-slate-400">El video usa el mismo límite de adjuntos del chat y se previsualiza antes de enviarlo.</p>
      </div>
    </div>,
    document.body,
  );
}
