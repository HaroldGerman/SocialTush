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

function text(node: Element | null) {
  return node?.textContent?.trim() || '';
}

function findInfoPanel(): HTMLElement | null {
  const labels = Array.from(document.querySelectorAll<HTMLElement>('p,label'));
  const libraryLabel = labels.find(node => text(node).toLowerCase().startsWith(LIBRARY_LABEL));
  return libraryLabel?.closest('aside') as HTMLElement | null;
}

function findPanelUsername(panel: HTMLElement) {
  const node = Array.from(panel.querySelectorAll<HTMLElement>('span,p,div'))
    .find(candidate => /^@[A-Za-z0-9_.-]+$/.test(text(candidate)));
  return text(node).replace(/^@/, '');
}

function findPanelName(panel: HTMLElement) {
  return text(panel.querySelector('h4')) || text(panel.querySelector('h3'));
}

async function resolveConversation(panel: HTMLElement): Promise<Conversation | null> {
  const username = findPanelUsername(panel);
  const name = findPanelName(panel);
  const response = await api.get('/chat/conversations');
  const conversations: Conversation[] = Array.isArray(response.data) ? response.data : [];
  if (username) {
    const direct = conversations.find(item => item.otherUsername?.toLowerCase() === username.toLowerCase());
    if (direct) return direct;
  }
  if (name) {
    const byName = conversations.find(item => item.name?.trim().toLowerCase() === name.toLowerCase());
    if (byName) return byName;
  }
  return null;
}

async function loadAllMessages(conversationId: string) {
  const all: Message[] = [];
  const pageSize = 100;
  for (let page = 0; page < 100; page += 1) {
    const response = await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page, size: pageSize } });
    const chunk: Message[] = response.data?.content || response.data || [];
    all.unshift(...chunk);
    if (chunk.length < pageSize) break;
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

function toLibrary(messages: Message[]) {
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

function ensureLibraryMount(panel: HTMLElement) {
  const label = Array.from(panel.querySelectorAll<HTMLElement>('p,label'))
    .find(node => text(node).toLowerCase().startsWith(LIBRARY_LABEL));
  const section = label?.parentElement;
  if (!label || !section) return null;

  Array.from(section.children).forEach(child => {
    const element = child as HTMLElement;
    if (child === label || element.dataset.lifonkInfoLibrary === 'true') return;
    element.style.display = 'none';
  });

  let mount = section.querySelector<HTMLElement>('[data-lifonk-info-library="true"]');
  if (!mount) {
    mount = document.createElement('div');
    mount.dataset.lifonkInfoLibrary = 'true';
    section.appendChild(mount);
  }
  return mount;
}

function closeInfoPanel(panel: HTMLElement) {
  const close = Array.from(panel.querySelectorAll<HTMLButtonElement>('button'))
    .find(button => Boolean(button.querySelector('svg.lucide-x')));
  close?.click();
}

function findVisibleMessage(message: Message) {
  const content = message.content?.trim();
  if (!content) return null;
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('div')).filter(node => {
    const cls = typeof node.className === 'string' ? node.className : '';
    return cls.includes('max-w-[82%]') || cls.includes('md:max-w-[75%]');
  });
  return candidates.find(node => (node.textContent || '').includes(content)) || null;
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
  const [historyContext, setHistoryContext] = useState<Message[]>([]);
  const loadedConversationRef = useRef('');
  const messagesRef = useRef<Message[]>([]);
  const panelRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false);

  const loadHistory = useCallback(async (panel: HTMLElement, force = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const conversation = await resolveConversation(panel);
      if (!conversation?.conversationId) throw new Error('conversation-not-found');
      if (!force && loadedConversationRef.current === conversation.conversationId && messagesRef.current.length) {
        setItems(toLibrary(messagesRef.current));
        return;
      }
      const messages = await loadAllMessages(conversation.conversationId);
      loadedConversationRef.current = conversation.conversationId;
      messagesRef.current = messages;
      setItems(toLibrary(messages));
    } catch (error) {
      console.error('Chat info history:', error);
      setNotice('No se pudo cargar el historial completo.');
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/chat')) return;
    let raf = 0;
    let lastUsername = '';

    const scan = () => {
      const panel = findInfoPanel();
      panelRef.current = panel;
      if (!panel) {
        setMount(null);
        return;
      }
      const username = findPanelUsername(panel);
      if (lastUsername && username && username !== lastUsername) {
        loadedConversationRef.current = '';
        messagesRef.current = [];
        setItems([]);
      }
      if (username) lastUsername = username;
      const nextMount = ensureLibraryMount(panel);
      setMount(current => current === nextMount ? current : nextMount);
      if (nextMount) void loadHistory(panel);
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(scan);
    };

    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(scan, 500);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [loadHistory]);

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setNotice('Escribe al menos 2 caracteres.');
      return;
    }
    const panel = panelRef.current || findInfoPanel();
    if (!panel) return;
    await loadHistory(panel);
    const found = messagesRef.current.filter(message => (message.content || '').toLocaleLowerCase('es').includes(trimmed.toLocaleLowerCase('es')));
    setQuery(trimmed);
    setResults(found);
    setResultIndex(0);
    setSearchOpen(true);
    closeInfoPanel(panel);
    window.setTimeout(() => {
      const first = found[0];
      if (!first) return;
      const node = findVisibleMessage(first);
      if (node) {
        node.classList.add('lifonk-chat-search-hit');
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const index = messagesRef.current.findIndex(message => message.messageId === first.messageId);
        setHistoryContext(index < 0 ? [first] : messagesRef.current.slice(Math.max(0, index - 3), index + 4));
      }
    }, 120);
    if (!found.length) setNotice(`No se encontraron mensajes con “${trimmed}”.`);
  }, [loadHistory]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest('button');
      if (!button) return;
      const panel = findInfoPanel();
      if (!panel || !panel.contains(button)) return;
      const label = Array.from(panel.querySelectorAll<HTMLElement>('label'))
        .find(node => text(node).toLowerCase() === SEARCH_LABEL);
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

  const goTo = (nextIndex: number) => {
    if (!results.length) return;
    document.querySelectorAll('.lifonk-chat-search-hit').forEach(node => node.classList.remove('lifonk-chat-search-hit'));
    const normalized = ((nextIndex % results.length) + results.length) % results.length;
    setResultIndex(normalized);
    const message = results[normalized];
    window.setTimeout(() => {
      const node = findVisibleMessage(message);
      if (node) {
        setHistoryContext([]);
        node.classList.add('lifonk-chat-search-hit');
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const index = messagesRef.current.findIndex(item => item.messageId === message.messageId);
        setHistoryContext(index < 0 ? [message] : messagesRef.current.slice(Math.max(0, index - 3), index + 4));
      }
    }, 30);
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
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400">{loading ? 'Cargando historial…' : `${items.length} elementos`}</span>
          {!loading && <button type="button" onClick={() => panelRef.current && void loadHistory(panelRef.current, true)} className="text-[9px] font-bold text-[#8b5cf6]">Actualizar</button>}
        </div>
        <div className="grid max-h-[430px] grid-cols-3 gap-2 overflow-y-auto pr-1">
          {items.map(item => item.kind === 'IMAGE' ? (
            <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl bg-slate-100 dark:bg-[#162033]"><img src={item.url} alt={item.label} className="aspect-square h-full w-full object-cover" /></a>
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
          <div className="flex items-center gap-2"><Search className="h-4 w-4 text-[#443C68] dark:text-[#b8add9]"/><input value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void runSearch(query)}}} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Buscar en el historial"/><span className="text-[10px] font-bold text-slate-500">{results.length ? `${resultIndex+1} de ${results.length}` : '0 de 0'}</span><button type="button" disabled={!results.length} onClick={()=>goTo(resultIndex-1)}><ChevronUp className="h-4 w-4"/></button><button type="button" disabled={!results.length} onClick={()=>goTo(resultIndex+1)}><ChevronDown className="h-4 w-4"/></button><button type="button" onClick={()=>{setSearchOpen(false);setHistoryContext([]);document.querySelectorAll('.lifonk-chat-search-hit').forEach(node=>node.classList.remove('lifonk-chat-search-hit'))}}><X className="h-4 w-4"/></button></div>
        </div>
      </div>, document.body)}

    {historyContext.length > 0 && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] top-[calc(env(safe-area-inset-top)+130px)] z-[2147481900] overflow-y-auto bg-[#f7f5f8]/98 px-4 py-5 backdrop-blur dark:bg-[#090713]/98"><div className="mx-auto max-w-3xl space-y-3">{historyContext.map(message=><div key={message.messageId} className={`rounded-2xl border p-3 ${message.messageId===results[resultIndex]?.messageId?'border-[#C97B63] bg-[#fff6f1] ring-2 ring-[#C97B63]/30 dark:bg-[#21151a]':'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#12101a]'}`}><div className="mb-1 flex justify-between text-[9px] font-bold text-slate-500"><span>@{message.senderUsername||'usuario'}</span><span>{message.createdAt?new Date(message.createdAt).toLocaleString():''}</span></div><p className="whitespace-pre-wrap text-sm">{message.content||'Archivo o multimedia'}</p></div>)}</div></div>, document.body)}

    {notice && typeof document !== 'undefined' && createPortal(<div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[2147483001] -translate-x-1/2 rounded-full bg-[#1A1620]/95 px-4 py-2 text-xs font-bold text-white shadow-xl">{notice}</div>, document.body)}
  </>;
}
