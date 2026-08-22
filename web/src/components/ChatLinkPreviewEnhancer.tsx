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
const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

function cleanUrl(value: string) {
  return value.replace(/[),.;!?]+$/g, '');
}

function extractTikTokUrl(text: string) {
  const matches = text.match(URL_REGEX) || [];
  for (const raw of matches) {
    const candidate = cleanUrl(raw);
    try {
      const parsed = new URL(candidate);
      const host = parsed.hostname.toLowerCase();
      if (['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com'].includes(host)) return candidate;
    } catch {}
  }
  return null;
}

function linkifyParagraph(node: HTMLElement) {
  const text = node.dataset.lifonkOriginalText || node.textContent || '';
  if (node.dataset.lifonkOriginalText === undefined) node.dataset.lifonkOriginalText = text;
  if (node.dataset.lifonkLinkified === text) return;

  URL_REGEX.lastIndex = 0;
  if (!URL_REGEX.test(text)) {
    URL_REGEX.lastIndex = 0;
    return;
  }
  URL_REGEX.lastIndex = 0;

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const raw = match[0];
    const url = cleanUrl(raw);
    const start = match.index;
    if (start > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, start)));

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = url;
    link.className = 'break-all font-bold underline decoration-current/60 underline-offset-2 hover:opacity-80';
    link.dataset.lifonkChatLink = 'true';
    fragment.appendChild(link);

    const trailing = raw.slice(url.length);
    if (trailing) fragment.appendChild(document.createTextNode(trailing));
    cursor = start + raw.length;
  }

  if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)));
  node.replaceChildren(fragment);
  node.dataset.lifonkLinkified = text;
}

async function fetchPreview(url: string) {
  let cached = previewCache.get(url);
  if (!cached) {
    cached = fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { credentials: 'same-origin' })
      .then(async response => response.ok ? await response.json() as LinkPreview : null)
      .catch(() => null);
    previewCache.set(url, cached);
  }
  return cached;
}

function buildCard(preview: LinkPreview, originalUrl: string) {
  const card = document.createElement('a');
  card.dataset.lifonkLinkPreview = 'true';
  card.dataset.previewUrl = originalUrl;
  card.href = preview.url || originalUrl;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';
  card.className = 'mt-2 flex w-full min-w-[250px] max-w-[340px] overflow-hidden rounded-2xl border border-white/20 bg-white/95 text-left text-slate-900 shadow-md transition active:scale-[.99] dark:border-white/10 dark:bg-[#171223] dark:text-white';

  if (preview.thumbnailUrl) {
    const image = document.createElement('img');
    image.src = preview.thumbnailUrl;
    image.alt = preview.title || 'TikTok';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.className = 'h-28 w-24 shrink-0 bg-black object-cover';
    card.appendChild(image);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'flex h-24 w-20 shrink-0 items-center justify-center bg-[#1A1620] text-2xl font-black text-white';
    fallback.textContent = '♪';
    card.appendChild(fallback);
  }

  const body = document.createElement('span');
  body.className = 'flex min-w-0 flex-1 flex-col justify-center px-3.5 py-3';

  const provider = document.createElement('span');
  provider.className = 'text-[9px] font-black uppercase tracking-[.18em] text-[#C97B63]';
  provider.textContent = preview.providerName || 'TikTok';

  const title = document.createElement('strong');
  title.className = 'mt-1.5 line-clamp-2 text-[12px] leading-snug';
  title.textContent = preview.title || 'Video de TikTok';

  const open = document.createElement('span');
  open.className = 'mt-2 text-[9px] font-bold text-[#443C68] dark:text-[#D8D1E8]';
  open.textContent = 'Abrir en TikTok ↗';

  body.append(provider, title);
  if (preview.authorName) {
    const author = document.createElement('span');
    author.className = 'mt-1 truncate text-[9px] text-slate-500 dark:text-slate-400';
    author.textContent = preview.authorName;
    body.appendChild(author);
  }
  body.appendChild(open);
  card.appendChild(body);
  return card;
}

function fallbackPreview(url: string): LinkPreview {
  return {
    url,
    providerName: 'TikTok',
    title: 'Video compartido desde TikTok',
    authorName: '',
    thumbnailUrl: '',
  };
}

export default function ChatLinkPreviewEnhancer() {
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/chat')) return;
    let disposed = false;

    const decorate = () => {
      if (disposed || !window.location.pathname.startsWith('/chat')) return;

      const paragraphs = Array.from(document.querySelectorAll<HTMLElement>('p.whitespace-pre-wrap'));
      paragraphs.forEach(messageText => {
        const originalText = messageText.dataset.lifonkOriginalText || messageText.textContent || '';
        linkifyParagraph(messageText);

        const url = extractTikTokUrl(originalText);
        const bubble = messageText.closest<HTMLElement>('div.rounded-2xl');
        if (!bubble) return;

        const existing = bubble.querySelector<HTMLElement>('[data-lifonk-link-preview]');
        if (!url) {
          existing?.remove();
          return;
        }
        if (existing?.dataset.previewUrl === url) return;
        existing?.remove();

        const initialCard = buildCard(fallbackPreview(url), url);
        bubble.appendChild(initialCard);

        void fetchPreview(url).then(preview => {
          if (disposed || !initialCard.isConnected || !preview) return;
          const enriched = buildCard(preview, url);
          initialCard.replaceWith(enriched);
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
    const observer = new MutationObserver(mutations => {
      if (mutations.every(mutation => {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        return Boolean(target?.closest('[data-lifonk-link-preview],[data-lifonk-chat-link]'));
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
