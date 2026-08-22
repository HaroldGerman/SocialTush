'use client';

import { useEffect, useRef } from 'react';

type LinkPreview = {
  url: string;
  providerName: string;
  title: string;
  authorName?: string;
  thumbnailUrl?: string;
};

const previewCache = new Map<string, Promise<LinkPreview | null>>();

function messageWrappers() {
  return Array.from(document.querySelectorAll<HTMLElement>('div.flex.flex-col')).filter(
    (node) => typeof node.className === 'string' && node.className.includes('max-w-[82%]'),
  );
}

function extractTikTokUrl(text: string) {
  const match = text.match(/https:\/\/(?:www\.|m\.|vt\.|vm\.)?tiktok\.com\/[^\s<>"']+/i);
  if (!match) return null;
  return match[0].replace(/[),.;!?]+$/g, '');
}

async function fetchPreview(url: string) {
  let cached = previewCache.get(url);
  if (!cached) {
    cached = fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { credentials: 'same-origin' })
      .then(async (response) => response.ok ? await response.json() as LinkPreview : null)
      .catch(() => null);
    previewCache.set(url, cached);
  }
  return cached;
}

function buildCard(preview: LinkPreview) {
  const card = document.createElement('a');
  card.dataset.lifonkLinkPreview = 'true';
  card.href = preview.url;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';
  card.className = 'mt-2 flex w-full min-w-[250px] max-w-[330px] overflow-hidden rounded-xl border border-white/20 bg-white/95 text-left text-slate-900 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-[#171223] dark:text-white';

  if (preview.thumbnailUrl) {
    const image = document.createElement('img');
    image.src = preview.thumbnailUrl;
    image.alt = preview.title || 'TikTok';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.className = 'h-24 w-20 shrink-0 object-cover';
    card.appendChild(image);
  }

  const body = document.createElement('span');
  body.className = 'flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5';

  const provider = document.createElement('span');
  provider.className = 'text-[9px] font-black uppercase tracking-[.16em] text-[#C97B63]';
  provider.textContent = preview.providerName || 'TikTok';

  const title = document.createElement('strong');
  title.className = 'mt-1 line-clamp-2 text-[11px] leading-snug';
  title.textContent = preview.title || 'Video de TikTok';

  body.append(provider, title);

  if (preview.authorName) {
    const author = document.createElement('span');
    author.className = 'mt-1 truncate text-[9px] text-slate-500 dark:text-slate-400';
    author.textContent = preview.authorName;
    body.appendChild(author);
  }

  card.appendChild(body);
  return card;
}

export default function ChatLinkPreviewEnhancer() {
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/chat')) return;
    let disposed = false;

    const decorate = () => {
      if (disposed || !window.location.pathname.startsWith('/chat')) return;

      messageWrappers().forEach((wrapper) => {
        const bubble = wrapper.firstElementChild as HTMLElement | null;
        if (!bubble) return;

        const messageText = bubble.querySelector<HTMLElement>('p.whitespace-pre-wrap');
        if (!messageText) return;

        const url = extractTikTokUrl(messageText.textContent || '');
        const existing = bubble.querySelector<HTMLElement>('[data-lifonk-link-preview]');

        if (!url) {
          existing?.remove();
          return;
        }

        if (existing?.dataset.previewUrl === url) return;
        existing?.remove();

        const loading = document.createElement('div');
        loading.dataset.lifonkLinkPreview = 'true';
        loading.dataset.previewUrl = url;
        loading.className = 'mt-2 h-20 w-full min-w-[250px] max-w-[330px] animate-pulse rounded-xl border border-white/15 bg-white/10';
        bubble.appendChild(loading);

        void fetchPreview(url).then((preview) => {
          if (disposed || !preview || !loading.isConnected) {
            loading.remove();
            return;
          }
          const card = buildCard(preview);
          card.dataset.previewUrl = url;
          loading.replaceWith(card);
        });
      });
    };

    const schedule = () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        decorate();
      });
    };

    decorate();
    const observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        return Boolean(target?.closest('[data-lifonk-link-preview]'));
      })) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
      if (frame.current !== null) {
        window.cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, []);

  return null;
}
