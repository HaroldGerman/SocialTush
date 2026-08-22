'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, FileText, Link2, Search, Video, X } from 'lucide-react';
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
  content?: string;
  createdAt?: string;
  attachments?: Attachment[];
};

type Conversation = {
  conversationId: string | null;
  otherUsername?: string;
  name?: string;
};

type LibraryItem = {
  key: string;
  kind: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'LINK' | 'OTHER';
  url: string;
  label: string;
};

const LIBRARY_LABEL = 'multimedia, enlaces y archivos';
const SEARCH_LABEL = 'buscar mensajes';
const URL_RE = /https?:\/\/[^\s]+/gi;

function text(node?: Element | null) {
  return node?.textContent?.trim() || '';
}

function findLabel(root: ParentNode, value: string) {
  return Array.from(root.querySelectorAll<HTMLElement>('p,label'))
    .find(node => text(node).toLocaleLowerCase('es').startsWith(value)) || null;
}

function findInfoRoot(): HTMLElement | null {
  const libraryLabel = findLabel(document, LIBRARY_LABEL);
  if (!libraryLabel) return null;

  let current: HTMLElement | null = libraryLabel.parentElement;
  while (current && current !== document.body) {
    const content = text(current).toLocaleLowerCase('es');
    if (content.includes(SEARCH_LABEL) && content.includes('apodo privado')) return current;
    current = current.parentElement;
  }
  return libraryLabel.closest('aside') as HTMLElement | null;
}

function findUsername(root: HTMLElement) {
  const node = Array.from(root.querySelectorAll<HTMLElement>('span,p,div'))
    .find(candidate => /^@[A-Za-z0-9_.-]+$/.test(text(candidate)));
  return text(node).replace(/^@/, '');
}

function findName(root: HTMLElement) {
  return text(root.querySelector('h4')) || text(root.querySelector('h3'));
}

async function resolveConversation(root: HTMLElement): Promise<Conversation | null> {
  const username = findUsername(root);
  const name = findName(root);
  const response = await api.get('/chat/conversations');
  const conversations: Conversation[] = Array.isArray(response.data) ? response.data : [];

  if (username) {
    const direct = conversations.find(item => item.otherUsername?.toLocaleLowerCase('es') === username.toLocaleLowerCase('es'));
    if (direct) return direct;
  }
  if (name) {
    const byName = conversations.find(item => item.name?.trim().toLocaleLowerCase('es') === name.toLocaleLowerCase('es'));
    if (byName) return byName;
  }
  return null;
}

async function fetchAllMessages(conversationId: string) {
  const all: Message[] = [];
  const size = 100;
  for (let page = 0; page < 100; page += 1) {
    const response = await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page, size } });
    const chunk: Message[] = response.data?.content || response.data || [];
    all.unshift(...chunk);
    if (chunk.length < size) break;
  }
  return all;
}

function cleanUrl(value: string) {
  return value.replace(/[),.!?]+$/, '');
}

function hostLabel(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return 'Enlace'; }
}

function buildLibrary(messages: Message[]) {
  const items: LibraryItem[] = [];
  [...messages].reverse().forEach(message => {
    (message.attachments || []).forEach(attachment => {
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
  return items;
}

function ensureMount(root: HTMLElement) {
  const label = findLabel(root, LIBRARY_LABEL);
  const section = label?.parentElement;
  if (!label || !section) return null;

  Array.from(section.children).forEach(child => {
    const element = child as HTMLElement;
    if (child === label || element.dataset.lifonkFullHistory === 'true') return;
    element.style.setProperty('display', 'none', 'important');
  });

  let mount = section.querySelector<HTMLElement>('[data-lifonk-full-history="true"]');
  if (!mount) {
    mount = document.createElement('div');
    mount.dataset.lifonkFullHistory = 'true';
    section.appendChild(mount);
  }
  return mount;
}

function closeInfo(root: HTMLElement) {
  const close = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(button => Boolean(button.querySelector('svg.lucide-x')));
  close?.click();
}

function visibleMessage(message: Message) {
  const value = message.content?.trim();
  if (!value) return null;
  return Array.from(document.querySelectorAll<HTMLElement>('div'))
    .filter(node => {
      const cls = typeof node.className === 'string' ? node.className : '';
      return cls.includes('max-w-[82%]') || cls.includes('md:max-w-[75%]');
    })
    .find(node => (node.textContent || '').includes(value)) || null;
}

export default function ChatInfoPanelFix() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [resultIndex, setResultIndex] = useState(0);
  const [context, setContext] = useState<Message[]>([]);

  const rootRef = useRef<HTMLElement | null>(null);
  const conversationIdRef = useRef('');
  const usernameRef = useRef('');
  const messagesRef = useRef<Message[]>([]);
  const loadingPromiseRef = useRef<Promise<Message[]> | null>(null);

  const loadHistory = useCallback(async (root: HTMLElement, force = false) => {
    const username = findUsername(root);
    if (!force && username && username === usernameRef.current && messagesRef.current.length) return messagesRef.current;
    if (!force && loadingPromiseRef.current) return loadingPromiseRef.current;

    const promise = (async () => {
      setLoading(true);
      try {
        const conversation = await resolveConversation(root);
        if (!conversation?.conversationId) throw new Error('conversation-not-found');
        const messages = await fetchAllMessages(conversation.conversationId);
        conversationIdRef.current = conversation.conversationId;
        usernameRef.current = username;
        messagesRef.current = messages;
        setItems(buildLibrary(messages));
        return messages;
      } catch (error) {
        console.error('Lifonk full chat history:', error);
        setNotice('No se pudo cargar el historial completo.');
        return [];
      } finally {
        setLoading(false);
        loadingPromiseRef.current = null;
      }
    })();

    loadingPromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/chat')) return;
    let raf = 0;

    const scan = () => {
      const root = findInfoRoot();
      rootRef.current = root;
      if (!root) {
        setMount(null);
        return;
      }

      const username = findUsername(root);
      if (usernameRef.current && username && usernameRef.current !== username) {
        usernameRef.current = '';
        conversationIdRef.current = '';
        messagesRef.current = [];
        setItems([]);
      }

      const nextMount = ensureMount(root);
      setMount(current => current === nextMount ? current : nextMount);
      if (nextMount) void loadHistory(root);
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scan);
    };

    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(scan, 400);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [loadHistory]);

  const showResult = useCallback((message: Message) => {
    document.querySelectorAll('.lifonk-chat-search-hit').forEach(node => node.classList.remove('lifonk-chat-search-hit'));
    const node = visibleMessage(message);
    if (node) {
      setContext([]);
      node.classList.add('lifonk-chat-search-hit');
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const index = messagesRef.current.findIndex(item => item.messageId === message.messageId);
    setContext(index < 0 ? [message] : messagesRef.current.slice(Math.max(0, index - 3), index + 4));
  }, []);

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setNotice('Escribe al menos 2 caracteres.');
      return;
    }
    const root = rootRef.current || findInfoRoot();
    if (!root) {
      setNotice('No se pudo identificar la conversación.');
      return;
    }

    const messages = await loadHistory(root);
    const normalized = trimmed.toLocaleLowerCase('es');
    const found = messages.filter(message => (message.content || '').toLocaleLowerCase('es').includes(normalized));
    setQuery(trimmed);
    setResults(found);
    setResultIndex(0);
    setSearchOpen(true);
    closeInfo(root);
    window.setTimeout(() => { if (found[0]) showResult(found[0]); }, 120);
    if (!found.length) setNotice(`No se encontraron mensajes con “${trimmed}”.`);
  }, [loadHistory, showResult]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('button');
      if (!button) return;
      const root = findInfoRoot();
      if (!root || !root.contains(button)) return;
      const label = findLabel(root, SEARCH_LABEL);
      const section = label?.parentElement;
      if (!section || !section.contains(button)) return;
      const input = section.querySelector<HTMLInputElement>('input');
      if (!input) return;
      event.preventDefault();
      event.stopPropagation();
      void runSearch(input.value);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [runSearch]);

  const goTo = (next: number) => {
    if (!results.length) return;
    const normalized = ((next % results.length) + results.length) % results.length;
    setResultIndex(normalized);
    window.setTimeout(() => showResult(results[normalized]), 20);
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return <>
    <style jsx global>{`.lifonk-chat-search-hit{outline:3px solid #C97B63!important;outline-offset:5px;border-radius:18px}`}</style>

    {mount && createPortal(
      <div className="mt-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-slate-400">{loading ? 'Cargando historial…' : `${items.length} elementos`}</span>
          {!loading && <button type="button" onClick={() => rootRef.current && void loadHistory(rootRef.current, true)} className="text-[9px] font-bold text-[#8b5cf6]">Actualizar</button>}
        </div>
        {!loading && items.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-[10px] text-slate-400 dark:border-slate-700">Aún no hay multimedia, enlaces o archivos.</div>}
        <div className="grid max-h-[430px] grid-cols-3 gap-2 overflow-y-auto pr-1">
          {items.map(item => item.kind === 'IMAGE' ? (
            <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl bg-slate-100 dark:bg-[#162033]"><img src={item.url} alt={item.label} className="aspect-square h-full w-full object-cover"/></a>
          ) : item.kind === 'VIDEO' ? (
            <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-[#162033]"><video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover"/><span className="absolute rounded-full bg-black/60 p-2 text-white"><Video className="h-4 w-4"/></span></a>
          ) : (
            <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-100 p-2 text-center dark:bg-[#162033]">{item.kind === 'LINK' ? <Link2 className="h-5 w-5 text-[#8b5cf6]"/> : <FileText className="h-5 w-5 text-slate-400"/>}<span className="line-clamp-2 break-all text-[8px] font-bold text-slate-500 dark:text-slate-300">{item.label}</span></a>
          ))}
        </div>
      </div>, mount)}

    {searchOpen && typeof document !== 'undefined' && createPortal(
      <div className="fixed left-2 right-2 z-[2147482000] mx-auto max-w-3xl" style={{top:'calc(env(safe-area-inset-top) + 72px)'}}>
        <div className="rounded-2xl border border-[#443C68]/30 bg-white/95 p-2.5 shadow-2xl backdrop-blur-xl dark:border-[#6d628f] dark:bg-[#0d0b13]/95">
          <div className="flex items-center gap-2"><Search className="h-4 w-4 text-[#443C68] dark:text-[#b8add9]"/><input value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void runSearch(query)}}} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Buscar en el historial"/><span className="text-[10px] font-bold text-slate-500">{results.length ? `${resultIndex+1} de ${results.length}` : '0 de 0'}</span><button type="button" disabled={!results.length} onClick={()=>goTo(resultIndex-1)}><ChevronUp className="h-4 w-4"/></button><button type="button" disabled={!results.length} onClick={()=>goTo(resultIndex+1)}><ChevronDown className="h-4 w-4"/></button><button type="button" onClick={()=>{setSearchOpen(false);setContext([]);document.querySelectorAll('.lifonk-chat-search-hit').forEach(node=>node.classList.remove('lifonk-chat-search-hit'))}}><X className="h-4 w-4"/></button></div>
        </div>
      </div>, document.body)}

    {context.length > 0 && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] top-[calc(env(safe-area-inset-top)+130px)] z-[2147481900] overflow-y-auto bg-[#f7f5f8]/98 px-4 py-5 backdrop-blur dark:bg-[#090713]/98"><div className="mx-auto max-w-3xl space-y-3">{context.map(message=><div key={message.messageId} className={`rounded-2xl border p-3 ${message.messageId===results[resultIndex]?.messageId?'border-[#C97B63] bg-[#fff6f1] ring-2 ring-[#C97B63]/30 dark:bg-[#21151a]':'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#12101a]'}`}><div className="mb-1 flex justify-between text-[9px] font-bold text-slate-500"><span>@{message.senderUsername||'usuario'}</span><span>{message.createdAt?new Date(message.createdAt).toLocaleString():''}</span></div><p className="whitespace-pre-wrap text-sm">{message.content||'Archivo o multimedia'}</p></div>)}</div></div>, document.body)}

    {notice && typeof document !== 'undefined' && createPortal(<div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[2147483001] -translate-x-1/2 rounded-full bg-[#1A1620]/95 px-4 py-2 text-xs font-bold text-white shadow-xl">{notice}</div>, document.body)}
  </>;
}
