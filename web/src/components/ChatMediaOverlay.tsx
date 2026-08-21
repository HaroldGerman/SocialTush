'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { api } from '@/context/AuthContext';

type Media = { src: string; alt: string } | null;

type ActiveStory = {
  storyId: string;
  mediaType?: string;
  mediaUrl?: string;
  textContent?: string;
};

type ActiveStoryGroup = {
  stories?: ActiveStory[];
};

function findMomentCard(target: HTMLElement | null) {
  let current: HTMLElement | null = target;
  for (let depth = 0; current && depth < 7; depth += 1, current = current.parentElement) {
    const text = current.textContent?.toLowerCase() || '';
    if (text.includes('interacción con un momento') || text.includes('interaccion con un momento')) return current;
  }
  return null;
}

export default function ChatMediaOverlay() {
  const [media, setMedia] = useState<Media>(null);
  const [openingMoment, setOpeningMoment] = useState(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!window.location.pathname.startsWith('/chat')) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const momentCard = findMomentCard(target);
      if (momentCard && !openingMoment) {
        event.preventDefault();
        event.stopPropagation();
        setOpeningMoment(true);

        const previewMedia = momentCard.querySelector('img,video') as HTMLImageElement | HTMLVideoElement | null;
        const previewUrl = previewMedia?.src || '';
        const previewText = momentCard.textContent || '';

        void api.get('/stories/active').then((response) => {
          const groups: ActiveStoryGroup[] = Array.isArray(response.data) ? response.data : [];
          const allStories = groups.flatMap((group) => group.stories || []);
          const match = allStories.find((story) => {
            if (previewUrl && story.mediaUrl) return story.mediaUrl === previewUrl;
            if (story.mediaType === 'TEXT' && story.textContent) return previewText.includes(story.textContent);
            return false;
          });
          if (!match) {
            window.alert('Este momento ya no está disponible.');
            return;
          }
          window.location.assign(`/feed?moment=${encodeURIComponent(match.storyId)}`);
        }).catch(() => window.alert('No se pudo abrir el momento.')).finally(() => setOpeningMoment(false));
        return;
      }

      const button = target.closest('button');
      const img = button?.querySelector('img') as HTMLImageElement | null;
      if (!button || !img?.src) return;

      const isMessageAttachment = button.className.includes('overflow-hidden') && button.className.includes('rounded-xl');
      const isSharedMediaGridItem = img.alt === 'Archivo compartido';
      if (!isMessageAttachment && !isSharedMediaGridItem) return;

      event.preventDefault();
      event.stopPropagation();
      setMedia({ src: img.src, alt: img.alt || 'Imagen del chat' });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [openingMoment]);

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
