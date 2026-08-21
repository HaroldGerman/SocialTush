'use client';

import { useEffect, useState } from 'react';
import { api } from '@/context/AuthContext';

type ActiveStory = {
  storyId: string;
  mediaType?: string;
  mediaUrl?: string;
  textContent?: string;
};

type ActiveStoryGroup = { stories?: ActiveStory[] };

const STORY_LABELS = new Set([
  'tu interacción con un momento',
  'tu interaccion con un momento',
  'interacción con tu momento',
  'interaccion con tu momento',
]);

function findStoryCard(target: HTMLElement | null) {
  let current = target;
  for (let depth = 0; current && depth < 4; depth += 1, current = current.parentElement) {
    if (current.tagName !== 'DIV') continue;
    const directLabel = Array.from(current.children).find((child) => child.tagName === 'P');
    const label = directLabel?.textContent?.trim().toLowerCase() || '';
    if (!STORY_LABELS.has(label)) continue;
    if (current.querySelector('img[alt="Momento"], video, div[style]')) return current;
  }
  return null;
}

export default function ChatScopedEnhancements() {
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!window.location.pathname.startsWith('/chat')) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('input, textarea, [contenteditable="true"]')) return;
      if (target instanceof HTMLVideoElement) return;

      const card = findStoryCard(target);
      if (!card) return;

      event.preventDefault();
      event.stopPropagation();

      const preview = card.querySelector('img[alt="Momento"], video') as HTMLImageElement | HTMLVideoElement | null;
      const previewUrl = preview?.src || '';
      const textPreview = card.textContent || '';

      void api.get('/stories/active').then((response) => {
        const groups: ActiveStoryGroup[] = Array.isArray(response.data) ? response.data : [];
        const stories = groups.flatMap((group) => group.stories || []);
        const match = stories.find((story) => {
          if (previewUrl && story.mediaUrl) return story.mediaUrl === previewUrl;
          if (story.mediaType === 'TEXT' && story.textContent) return textPreview.includes(story.textContent);
          return false;
        });

        if (!match) {
          setNotice('Este momento ya no está disponible.');
          return;
        }
        window.location.assign(`/feed?moment=${encodeURIComponent(match.storyId)}`);
      }).catch(() => setNotice('No se pudo abrir el momento.'));
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <>
      <style jsx global>{`
        .bg-black\\/92 {
          background-color: rgba(0, 0, 0, 0.96) !important;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        img[alt='Imagen ampliada'] {
          max-height: calc(100dvh - 32px) !important;
          max-width: calc(100vw - 24px) !important;
          border-radius: 14px;
          box-shadow: 0 18px 70px rgba(0,0,0,.45);
        }
      `}</style>
      {notice && window.location.pathname.startsWith('/chat') && (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[120] -translate-x-1/2 rounded-full bg-slate-950/90 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur">
          {notice}
        </div>
      )}
    </>
  );
}
