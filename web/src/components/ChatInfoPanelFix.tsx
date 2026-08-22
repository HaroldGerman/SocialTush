'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/context/AuthContext';

type Attachment = {
  id: string;
  fileUrl: string;
  fileType: string;
  fileName?: string;
};

type Message = {
  messageId: string;
  content?: string;
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
const URL_RE = /https?:\/\/[^\s]+/gi;

function text(node?: Element | null) {
  return node?.textContent?.trim() || '';
}

function findLibraryLabel() {
  return Array.from(document.querySelectorAll<HTMLElement>('p,label'))
    .find(node => text(node).toLocaleLowerCase('es').startsWith(LIBRARY_LABEL)) || null;
}

function findInfoRoot(label: HTMLElement) {
  return label.closest('aside') as HTMLElement | null;
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

async function fetchMedia(conversationId: string) {
  const all: Message[] = [];
  const size = 50;
  for (let page = 0; page < 100; page += 1) {
    const response = await api.get(`/chat/conversations/${conversationId}/media`, { params: { page, size } });
    const chunk: Message[] = Array.isArray(response.data?.content) ? response.data.content : [];
    all.push(...chunk);
    const totalPages = Number(response.data?.totalPages);
    if ((Number.isFinite(totalPages) && page + 1 >= totalPages) || chunk.length < size) break;
  }
  return all;
}

async function fetchMessages(conversationId: string) {
  const all: Message[] = [];
  const size = 100;
  for (let page = 0; page < 100; page += 1) {
    const response = await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page, size } });
    const chunk: Message[] = response.data?.content || response.data || [];
    all.unshift(...chunk);
    if (!Array.isArray(chunk) || chunk.length < size) break;
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

function kindFor(fileType: string): LibraryItem['kind'] {
  if (fileType === 'IMAGE') return 'IMAGE';
  if (fileType === 'VIDEO') return 'VIDEO';
  if (fileType === 'AUDIO') return 'AUDIO';
  if (fileType === 'DOCUMENT') return 'DOCUMENT';
  return 'OTHER';
}

function buildItems(mediaMessages: Message[], messages: Message[]) {
  const map = new Map<string, LibraryItem>();

  mediaMessages.forEach(message => {
    (message.attachments || []).forEach(attachment => {
      if (!attachment.fileUrl || attachment.fileType.startsWith('VIEW_ONCE_')) return;
      map.set(`attachment-${attachment.id}`, {
        key: `attachment-${attachment.id}`,
        kind: kindFor(attachment.fileType),
        url: attachment.fileUrl,
        label: attachment.fileName || attachment.fileType,
      });
    });
  });

  messages.forEach(message => {
    ((message.content || '').match(URL_RE) || []).forEach((raw, index) => {
      const url = cleanUrl(raw);
      map.set(`link-${message.messageId}-${index}`, {
        key: `link-${message.messageId}-${index}`,
        kind: 'LINK',
        url,
        label: hostLabel(url),
      });
    });
  });

  return Array.from(map.values());
}

function mediaMount(label: HTMLElement) {
  const section = label.parentElement;
  if (!section) return null;

  let mount = section.querySelector<HTMLElement>('[data-lifonk-media-library="true"]');
  if (!mount) {
    mount = document.createElement('div');
    mount.dataset.lifonkMediaLibrary = 'true';
    label.insertAdjacentElement('afterend', mount);
  }

  Array.from(section.children).forEach(child => {
    const element = child as HTMLElement;
    if (child === label || element === mount) return;
    element.style.setProperty('display', 'none', 'important');
  });
  mount.style.removeProperty('display');
  return mount;
}

function iconTile(item: LibraryItem) {
  const link = document.createElement('a');
  link.href = item.url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.className = 'flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-100 p-2 text-center dark:bg-[#111a29]';
  const icon = document.createElement('span');
  icon.className = 'text-xl text-[#8b5cf6]';
  icon.textContent = item.kind === 'LINK' ? '🔗' : item.kind === 'AUDIO' ? '🎵' : '📄';
  const label = document.createElement('span');
  label.className = 'line-clamp-2 break-all text-[9px] font-bold text-slate-500 dark:text-slate-300';
  label.textContent = item.label;
  link.append(icon, label);
  return link;
}

function renderLibrary(mount: HTMLElement, items: LibraryItem[], loading = false) {
  mount.replaceChildren();

  const header = document.createElement('div');
  header.className = 'mb-2 flex items-center justify-between gap-2';
  const count = document.createElement('span');
  count.className = 'text-[10px] font-bold text-slate-400';
  count.textContent = loading ? 'Cargando historial…' : `${items.length} elementos`;
  header.appendChild(count);
  mount.appendChild(header);

  if (loading) return;
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-[10px] text-slate-400 dark:border-slate-700';
    empty.textContent = 'Aún no hay multimedia, enlaces o archivos.';
    mount.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid max-h-[430px] grid-cols-3 gap-2 overflow-y-auto pr-1';

  items.forEach(item => {
    if (item.kind === 'IMAGE') {
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.className = 'block overflow-hidden rounded-xl bg-slate-100 dark:bg-[#111a29]';
      const image = document.createElement('img');
      image.src = item.url;
      image.alt = item.label;
      image.loading = 'lazy';
      image.className = 'aspect-square h-full w-full object-cover';
      link.appendChild(image);
      grid.appendChild(link);
      return;
    }

    if (item.kind === 'VIDEO') {
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.className = 'relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-[#111a29]';
      const video = document.createElement('video');
      video.src = item.url;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.className = 'h-full w-full object-cover';
      const badge = document.createElement('span');
      badge.className = 'absolute rounded-full bg-black/60 px-2 py-1 text-xs text-white';
      badge.textContent = '▶';
      link.append(video, badge);
      grid.appendChild(link);
      return;
    }

    grid.appendChild(iconTile(item));
  });

  mount.appendChild(grid);
}

export default function ChatInfoPanelFix() {
  const cacheRef = useRef(new Map<string, LibraryItem[]>());
  const loadingRef = useRef(new Set<string>());
  const activeConversationRef = useRef('');

  useEffect(() => {
    if (!window.location.pathname.startsWith('/chat')) return;
    let cancelled = false;
    let raf = 0;

    const hydrate = async () => {
      const label = findLibraryLabel();
      if (!label) return;
      const root = findInfoRoot(label);
      const mount = mediaMount(label);
      if (!root || !mount) return;

      const conversation = await resolveConversation(root);
      if (cancelled || !conversation?.conversationId) return;
      const conversationId = conversation.conversationId;
      activeConversationRef.current = conversationId;

      const cached = cacheRef.current.get(conversationId);
      if (cached) {
        renderLibrary(mount, cached);
        return;
      }
      if (loadingRef.current.has(conversationId)) return;

      loadingRef.current.add(conversationId);
      renderLibrary(mount, [], true);
      try {
        const [mediaMessages, messages] = await Promise.all([
          fetchMedia(conversationId),
          fetchMessages(conversationId),
        ]);
        if (cancelled || activeConversationRef.current !== conversationId) return;
        const items = buildItems(mediaMessages, messages);
        cacheRef.current.set(conversationId, items);
        const currentLabel = findLibraryLabel();
        const currentMount = currentLabel ? mediaMount(currentLabel) : null;
        if (currentMount) renderLibrary(currentMount, items);
      } catch (error) {
        console.error('No se pudo cargar multimedia completa:', error);
        const currentLabel = findLibraryLabel();
        const currentMount = currentLabel ? mediaMount(currentLabel) : null;
        if (currentMount) renderLibrary(currentMount, []);
      } finally {
        loadingRef.current.delete(conversationId);
      }
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { void hydrate(); });
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(schedule, 700);

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
