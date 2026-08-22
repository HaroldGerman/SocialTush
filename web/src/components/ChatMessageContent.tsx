'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';

type LinkPreview = {
  url: string;
  providerName?: string;
  title?: string;
  authorName?: string;
  thumbnailUrl?: string;
};

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;
const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com']);

function cleanUrl(value: string) {
  return value.replace(/[),.;!?]+$/g, '');
}

function findTikTokUrl(text: string) {
  const matches = text.match(URL_REGEX) || [];
  for (const raw of matches) {
    const candidate = cleanUrl(raw);
    try {
      const parsed = new URL(candidate);
      if (TIKTOK_HOSTS.has(parsed.hostname.toLowerCase())) return candidate;
    } catch {}
  }
  return null;
}

function LinkifiedText({ text, own }: { text: string; own: boolean }) {
  const parts = useMemo(() => {
    const result: Array<{ value: string; url?: string }> = [];
    let cursor = 0;
    const regex = new RegExp(URL_REGEX.source, 'gi');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const raw = match[0];
      const url = cleanUrl(raw);
      if (match.index > cursor) result.push({ value: text.slice(cursor, match.index) });
      result.push({ value: url, url });
      const trailing = raw.slice(url.length);
      if (trailing) result.push({ value: trailing });
      cursor = match.index + raw.length;
    }
    if (cursor < text.length) result.push({ value: text.slice(cursor) });
    return result;
  }, [text]);

  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => part.url ? (
        <a
          key={`${part.url}-${index}`}
          href={part.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`break-all font-bold underline underline-offset-2 ${own ? 'decoration-white/70 hover:decoration-white' : 'text-[#6d28d9] decoration-[#8b5cf6]/60 hover:decoration-[#6d28d9] dark:text-[#c4b5fd]'}`}
          onClick={event => event.stopPropagation()}
        >
          {part.value}
        </a>
      ) : <span key={index}>{part.value}</span>)}
    </p>
  );
}

function TikTokCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setFinished(false);

    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, { credentials: 'same-origin' })
      .then(async response => response.ok ? await response.json() as LinkPreview : null)
      .then(data => { if (!cancelled) setPreview(data); })
      .catch(() => { if (!cancelled) setPreview(null); })
      .finally(() => { if (!cancelled) setFinished(true); });

    return () => { cancelled = true; };
  }, [url]);

  const href = preview?.url || url;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={event => event.stopPropagation()}
      className="mt-2 flex w-full min-w-[250px] max-w-[340px] overflow-hidden rounded-2xl border border-black/10 bg-white text-left text-[#1A1620] shadow-md transition active:scale-[.99] dark:border-white/10 dark:bg-[#171223] dark:text-white"
    >
      {preview?.thumbnailUrl ? (
        <img src={preview.thumbnailUrl} alt={preview.title || 'TikTok'} loading="lazy" referrerPolicy="no-referrer" className="h-28 w-24 shrink-0 object-cover" />
      ) : (
        <span className="flex h-28 w-24 shrink-0 items-center justify-center bg-[linear-gradient(145deg,#1A1620,#443C68)] text-white">
          <Play className="h-8 w-8 fill-current" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-3">
        <span className="text-[9px] font-black uppercase tracking-[.18em] text-[#C97B63]">{preview?.providerName || 'TikTok'}</span>
        <strong className="mt-1 line-clamp-2 text-[11px] leading-snug">{preview?.title || (finished ? 'Video compartido de TikTok' : 'Cargando vista previa…')}</strong>
        {preview?.authorName && <span className="mt-1 truncate text-[9px] text-slate-500 dark:text-slate-400">{preview.authorName}</span>}
        <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-[#443C68] dark:text-[#D8D1E8]">Abrir en TikTok <ExternalLink className="h-3 w-3" /></span>
      </span>
    </a>
  );
}

export default function ChatMessageContent({ content, own }: { content: string; own: boolean }) {
  const tikTokUrl = useMemo(() => findTikTokUrl(content), [content]);

  return (
    <>
      <LinkifiedText text={content} own={own} />
      {tikTokUrl && <TikTokCard url={tikTokUrl} />}
    </>
  );
}
