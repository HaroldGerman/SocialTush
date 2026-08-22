'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, ExternalLink, FileText, Link2, Search, Video, X } from 'lucide-react';
import { api } from '@/context/AuthContext';

type Attachment = {
  id: string;
  fileUrl: string;
  fileType: string;
  fileName?: string;
};

type Message = {
  messageId: string;
  senderUsername?: string;
  senderDisplayName?: string;
  content?: string;
  createdAt?: string;
  attachments?: Attachment[];
};

type Conversation = {
  conversationId: string | null;
  name?: string;
  otherUsername?: string;
  isGroup?: boolean;
};

type LibraryItem = {
  key: string;
  kind: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'LINK' | 'OTHER';
  url: string;
  label: string;
};

const URL_RE = /https?:\/\/[^\s]+/gi;

function visible(node: Element) {
  const rect = (node as HTMLElement).getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

function activeIdentity() {
  const usernames = Array.from(document.querySelectorAll<HTMLElement>('span,p,div')).filter(visible);
  const username = usernames.find((node) => {
    const text = node.textContent?.trim() || '';
    if (!/^@[A-Za-z0-9_.-]+$/.test(text)) return false;
    const rect = node.getBoundingClientRect();
    return rect.top >= 0 && rect.top < 260;
  })?.textContent?.trim().replace(/^@/, '');

  const headings = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3')).filter(visible);
  const name = headings.find((node) => {
    const rect = node.getBoundingClientRect();
    return rect.top >= 0 && rect.top < 260 && (node.textContent?.trim()?.length || 0) > 0;
  })?.textContent?.trim();

  return { username: username || '', name: name || '' };
}

async function resolveConversation(): Promise<Conversation | null> {
  const { username, name } = activeIdentity();
  const response = await api.get('/chat/conversations');
  const conversations: Conversation[] = Array.isArray(response.data) ? response.data : [];
  if (username) {
    const direct = conversations.find((item) => item.otherUsername?.toLowerCase() === username.toLowerCase());
    if (direct) return direct;
  }
  if (name) {
    const byName = conversations.find((item) => item.name?.trim().toLowerCase() === name.toLowerCase());
    if (byName) return byName;
  }
  return null;
}

async function loadAllMessages(conversationId: string) {
  const pageSize = 100;
  let page = 0;
  let all: Message[] = [];
  while (page < 100) {
    const response = await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page, size: pageSize } });
    const chunk: Message[] = response.data?.content || response.data || [];
    all = [...chunk, ...all];
    if (chunk.length < pageSize) break;
    page += 1;
  }
  return all;
}

async function searchAll(conversationId: string, query: string) {
  const results: Message[] = [];
  for (let page = 0; page < 100; page += 1) {
    const response = await api.get(`/chat/conversations/${conversationId}/messages/search`, {
      params: { q: query, page, size: 50 },
    });
    const content: Message[] = response.data?.content || response.data || [];
    results.push(...content);
    const isLast = response.data?.last === true || content.length < 50;
    if (isLast) break;
  }
  return results;
}

function cleanUrl(value: string) {
  return value.replace(/[),.!?]+$/, '');
}

function hostLabel(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return 'Enlace'; }
}

function findVisibleMessage(content?: string) {
  if (!content) return null;
  const target = content.trim();
  if (!target) return null;
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('div')).filter((node) => {
    const cls = typeof node.className === 'string' ? node.className : '';
    return cls.includes('max-w-[82%]') || cls.includes('md:max-w-[75%]');
  });
  return candidates.find((node) => (node.textContent || '').includes(target)) || null;
}

function highlightVisibleMessage(message?: Message) {
  document.querySelectorAll('.lifonk-chat-search-hit').forEach((node) => node.classList.remove('lifonk-chat-search-hit'));
  const node = findVisibleMessage(message?.content);
  if (!node) return false;
  node.classList.add('lifonk-chat-search-hit');
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

export default function ChatHistoryTools() {
  const [libraryMount, setLibraryMount] = useState<HTMLElement | null>(null);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [resultIndex, setResultIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const loadedConversationRef = useRef('');

  const buildLibrary = useCallback(async () => {
    const conversation = await resolveConversation();
    if (!conversation?.conversationId) return;
    if (loadedConversationRef.current === conversation.conversationId && libraryItems.length) return;
    setLibraryLoading(true);
    try {
      const messages = await loadAllMessages(conversation.conversationId);
      const items: LibraryItem[] = [];
      [...messages].reverse().forEach((message) => {
        (message.attachments || []).forEach((attachment) => {
          if (!attachment.fileUrl || attachment.fileType.startsWith('VIEW_ONCE_')) return;
          const kind: LibraryItem['kind'] = attachment.fileType === 'IMAGE' ? 'IMAGE'
            : attachment.fileType === 'VIDEO' ? 'VIDEO'
            : attachment.fileType === 'AUDIO' ? 'AUDIO'
            : attachment.fileType === 'DOCUMENT' ? 'DOCUMENT' : 'OTHER';
          items.push({ key: `a-${attachment.id}`, kind, url: attachment.fileUrl, label: attachment.fileName || attachment.fileType });
        });
        ((message.content || '').match(URL_RE) || []).forEach((raw, index) => {
          const url = cleanUrl(raw);
          items.push({ key: `l-${message.messageId}-${index}`, kind: 'LINK', url, label: hostLabel(url) });
        });
      });
      loadedConversationRef.current = conversation.conversationId;
      setLibraryItems(items);
    } catch {
      setNotice('No se pudo cargar todo el historial de multimedia.');
    } finally {
      setLibraryLoading(false);
    }
  }, [libraryItems.length]);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/chat')) return;
    const scan = () => {
      const labels = Array.from(document.querySelectorAll<HTMLElement>('p,label')).filter((node) => node.textContent?.trim().toLowerCase().startsWith('multimedia, enlaces y archivos'));
      const label = labels.find(visible);
      if (!label) {
        setLibraryMount(null);
        loadedConversationRef.current = '';
        return;
      }
      const container = label.parentElement;
      if (!container) return;
      let mount = container.querySelector<HTMLElement>('[data-lifonk-full-library]');
      if (!mount) {
        const oldGrid = Array.from(container.children).find((child) => child !== label && child.classList.contains('grid')) as HTMLElement | undefined;
        if (oldGrid) oldGrid.style.display = 'none';
        mount = document.createElement('div');
        mount.dataset.lifonkFullLibrary = 'true';
        container.appendChild(mount);
      }
      setLibraryMount(mount);
      void buildLibrary();
    };
    scan();
    const observer = new MutationObserver(() => window.requestAnimationFrame(scan));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [buildLibrary]);

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setNotice('Escribe al menos 2 caracteres.');
      return;
    }
    setSearching(true);
    try {
      const conversation = await resolveConversation();
      if (!conversation?.conversationId) throw new Error('conversation-not-found');
      const found = await searchAll(conversation.conversationId, trimmed);
      setQuery(trimmed);
      setResults(found);
      setResultIndex(0);
      setSearchOpen(true);
      window.setTimeout(() => {
        const info = document.querySelector<HTMLButtonElement>('button[title="Información"]');
        if (info) info.click();
        window.setTimeout(() => highlightVisibleMessage(found[0]), 120);
      }, 0);
      if (!found.length) setNotice(`No se encontraron mensajes con “${trimmed}”.`);
    } catch {
      setNotice('No se pudo buscar en la conversación.');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/chat')) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button');
      if (!button) return;
      const section = button.parentElement?.parentElement;
      const label = section?.querySelector('label');
      if (label?.textContent?.trim().toLowerCase() !== 'buscar mensajes') return;
      const input = section?.querySelector<HTMLInputElement>('input');
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
      void runSearch(input.value);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [runSearch]);

  const goTo = (nextIndex: number) => {
    if (!results.length) return;
    const normalized = ((nextIndex % results.length) + results.length) % results.length;
    setResultIndex(normalized);
    window.setTimeout(() => highlightVisibleMessage(results[normalized]), 20);
  };

  useEffect(() => {
    if (!searchOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        document.querySelectorAll('.lifonk-chat-search-hit').forEach((node) => node.classList.remove('lifonk-chat-search-hit'));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        goTo(resultIndex + (event.shiftKey ? -1 : 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen, resultIndex, results]);

  const current = results[resultIndex];
  const library = useMemo(() => libraryItems, [libraryItems]);

  return <>
    <style jsx global>{`
      .lifonk-chat-search-hit { outline: 3px solid #C97B63 !important; outline-offset: 5px; border-radius: 18px; }
    `}</style>

    {libraryMount && createPortal(
      <div className="mt-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-slate-400">{libraryLoading ? 'Cargando historial…' : `${library.length} elementos`}</span>
          {!libraryLoading && <button type="button" onClick={() => { loadedConversationRef.current = ''; void buildLibrary(); }} className="text-[9px] font-bold text-[#8b5cf6]">Actualizar</button>}
        </div>
        {!libraryLoading && library.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-[10px] text-slate-400 dark:border-slate-700">Aún no hay multimedia, enlaces o archivos.</div>}
        <div className="grid max-h-[430px] grid-cols-3 gap-2 overflow-y-auto pr-1">
          {library.map((item) => item.kind === 'IMAGE' ? (
            <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl bg-slate-100 dark:bg-[#162033]">
              <img src={item.url} alt={item.label} className="aspect-square h-full w-full object-cover" />
            </a>
          ) : item.kind === 'VIDEO' ? (
            <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-[#162033]">
              <video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              <span className="absolute flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"><Video className="h-4 w-4" /></span>
            </a>
          ) : (
            <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-100 p-2 text-center dark:bg-[#162033]">
              {item.kind === 'LINK' ? <Link2 className="h-5 w-5 text-[#8b5cf6]" /> : <FileText className="h-5 w-5 text-slate-400" />}
              <span className="line-clamp-2 break-all text-[8px] font-bold text-slate-500 dark:text-slate-300">{item.label}</span>
            </a>
          ))}
        </div>
      </div>,
      libraryMount
    )}

    {searchOpen && typeof document !== 'undefined' && createPortal(
      <div className="fixed left-2 right-2 z-[2147482000] mx-auto max-w-3xl" style={{ top: 'calc(env(safe-area-inset-top) + 72px)' }}>
        <div className="rounded-2xl border border-[#443C68]/30 bg-white/95 p-2.5 shadow-2xl backdrop-blur-xl dark:border-[#6d628f] dark:bg-[#0d0b13]/95">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-[#443C68] dark:text-[#b8add9]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void runSearch(query); } }} className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none dark:text-white" placeholder="Buscar en esta conversación" />
            <span className="shrink-0 text-[10px] font-bold text-slate-500">{results.length ? `${resultIndex + 1} de ${results.length}` : '0 de 0'}</span>
            <button type="button" disabled={!results.length} onClick={() => goTo(resultIndex - 1)} className="rounded-lg p-1.5 text-slate-600 disabled:opacity-30 dark:text-slate-300" title="Anterior"><ChevronUp className="h-4 w-4" /></button>
            <button type="button" disabled={!results.length} onClick={() => goTo(resultIndex + 1)} className="rounded-lg p-1.5 text-slate-600 disabled:opacity-30 dark:text-slate-300" title="Siguiente"><ChevronDown className="h-4 w-4" /></button>
            <button type="button" onClick={() => { setSearchOpen(false); document.querySelectorAll('.lifonk-chat-search-hit').forEach((node) => node.classList.remove('lifonk-chat-search-hit')); }} className="rounded-lg p-1.5 text-slate-500" title="Cerrar"><X className="h-4 w-4" /></button>
          </div>
          {current && <div className="mt-2 rounded-xl bg-[#EFE8E3] px-3 py-2 text-xs text-[#1A1620] dark:bg-[#1A1620] dark:text-[#EFE8E3]">
            <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-bold opacity-70">
              <span>@{current.senderUsername || 'usuario'}</span>
              <span>{current.createdAt ? new Date(current.createdAt).toLocaleString() : ''}</span>
            </div>
            <p className="line-clamp-3 whitespace-pre-wrap">{current.content}</p>
            {!findVisibleMessage(current.content) && <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-[#C97B63]"><ExternalLink className="h-3 w-3" /> Resultado del historial completo</div>}
          </div>}
          {searching && <p className="px-1 pt-2 text-[10px] text-slate-400">Buscando en todo el historial…</p>}
        </div>
      </div>,
      document.body
    )}

    {notice && typeof document !== 'undefined' && createPortal(
      <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[2147483001] -translate-x-1/2 rounded-full bg-[#1A1620]/95 px-4 py-2 text-xs font-bold text-white shadow-xl">{notice}</div>,
      document.body
    )}
  </>;
}
