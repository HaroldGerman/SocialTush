'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
    if (current.tagName !== 'DIV') continue;
    const directLabel = Array.from(current.children).find((child) => child.tagName === 'P');
    const label = directLabel?.textContent?.trim().toLowerCase() || '';
    if (!STORY_LABELS.has(label)) continue;
    if (current.querySelector('img[alt="Momento"], video, div[style]')) return current;
  }
  return null;
}

function normalizedMediaKey(value?: string | null) {
  if (!value) return '';
  try {
    const parsed = new URL(value, window.location.origin);
    return decodeURIComponent(parsed.pathname).replace(/\/+$/, '').toLowerCase();
  } catch {
    return value.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  }
}

function mediaMatches(first?: string | null, second?: string | null) {
  const a = normalizedMediaKey(first);
  const b = normalizedMediaKey(second);
  if (!a || !b) return false;
  if (a === b) return true;
  const aName = a.split('/').filter(Boolean).pop();
  const bName = b.split('/').filter(Boolean).pop();
  return Boolean(aName && bName && aName === bName);
}

function findNormalChatImage(target: HTMLElement | null) {
  if (!target) return null;
  const direct = target instanceof HTMLImageElement ? target : null;
  if (direct?.classList.contains('max-h-72') && direct.alt !== 'Momento') return direct;
  const button = target.closest('button');
  const nested = button?.querySelector<HTMLImageElement>('img.max-h-72');
  return nested?.alt === 'Momento' ? null : nested || null;
}

export default function ChatScopedEnhancements() {
  const [notice, setNotice] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (!window.location.pathname.startsWith('/chat')) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('input, textarea, [contenteditable="true"]')) return;

      const card = findStoryCard(target);
      if (card) {
        event.preventDefault();
        event.stopPropagation();

        const preview = card.querySelector('img[alt="Momento"], video') as HTMLImageElement | HTMLVideoElement | null;
        const previewUrl = preview?.src || '';
        const textPreview = card.textContent || '';

        void api.get('/stories/active').then((response) => {
          const groups: ActiveStoryGroup[] = Array.isArray(response.data) ? response.data : [];
          const stories = groups.flatMap((group) => group.stories || []);
          const match = stories.find((story) => {
            if (previewUrl && story.mediaUrl && mediaMatches(previewUrl, story.mediaUrl)) return true;
            if (story.mediaType === 'TEXT' && story.textContent) return textPreview.includes(story.textContent);
            return false;
          });

          if (!match) {
            setNotice('Este momento ya no está disponible.');
            return;
          }
          window.location.assign(`/feed?moment=${encodeURIComponent(match.storyId)}`);
        }).catch(() => setNotice('No se pudo abrir el momento.'));
        return;
      }

      const image = findNormalChatImage(target);
      if (!image) return;
      event.preventDefault();
      event.stopPropagation();
      setImageUrl(image.currentSrc || image.src);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!imageUrl) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [imageUrl]);

  const imageOverlay = imageUrl && typeof document !== 'undefined'
    ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
          onClick={() => setImageUrl('')}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483000,
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
          }}
        >
          <button
            type="button"
            aria-label="Cerrar imagen"
            onClick={() => setImageUrl('')}
            style={{
              position: 'absolute',
              top: 'max(14px, env(safe-area-inset-top))',
              right: '14px',
              zIndex: 2,
              width: '42px',
              height: '42px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,.25)',
              background: 'rgba(20,20,20,.8)',
              color: '#fff',
              fontSize: '28px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <img
            src={imageUrl}
            alt="Imagen ampliada"
            onClick={(event) => event.stopPropagation()}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: 'calc(100dvh - 24px)',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: '10px',
            }}
          />
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {imageOverlay}
      {notice && typeof window !== 'undefined' && window.location.pathname.startsWith('/chat') && (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[120] -translate-x-1/2 rounded-full bg-slate-950/90 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur">
          {notice}
        </div>
      )}
    </>
  );
}
