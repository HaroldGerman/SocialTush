'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type Media = { src: string; alt: string } | null;

export default function ChatMediaOverlay() {
  const [media, setMedia] = useState<Media>(null);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/chat')) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const img = target?.closest('button')?.querySelector('img') as HTMLImageElement | null;
      if (!img?.src) return;
      const button = target?.closest('button');
      if (!button || !button.closest('[class*="overflow-y-auto"]')) return;
      event.preventDefault();
      event.stopPropagation();
      setMedia({ src: img.src, alt: img.alt || 'Imagen del chat' });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (!media) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMedia(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [media]);

  if (!media || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/[0.96] p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Imagen ampliada"
      onClick={() => setMedia(null)}
    >
      <button
        type="button"
        onClick={() => setMedia(null)}
        className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
        aria-label="Cerrar imagen"
      >
        <X className="h-6 w-6" />
      </button>
      <img
        src={media.src}
        alt={media.alt}
        draggable={false}
        className="max-h-[100dvh] max-w-[100vw] select-none object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
