'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/context/AuthContext';

type Message = {
  messageId: string;
  senderUsername?: string;
  content?: string;
  createdAt?: string;
};

type Conversation = {
  conversationId: string | null;
  otherUsername?: string;
  name?: string;
};

function visible(node: Element) {
  const rect = (node as HTMLElement).getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

async function resolveConversationId() {
  const username = Array.from(document.querySelectorAll<HTMLElement>('span,p,div'))
    .filter(visible)
    .find((node) => {
      const text = node.textContent?.trim() || '';
      const rect = node.getBoundingClientRect();
      return /^@[A-Za-z0-9_.-]+$/.test(text) && rect.top >= 0 && rect.top < 260;
    })?.textContent?.trim().replace(/^@/, '');

  if (!username) return '';
  const response = await api.get('/chat/conversations');
  const conversations: Conversation[] = Array.isArray(response.data) ? response.data : [];
  return conversations.find((item) => item.otherUsername?.toLowerCase() === username.toLowerCase())?.conversationId || '';
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

export default function ChatSearchHistoryNavigator() {
  const [focus, setFocus] = useState<Message | null>(null);
  const [context, setContext] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const conversationRef = useRef('');
  const lastSignatureRef = useRef('');

  useEffect(() => {
    if (!window.location.pathname.startsWith('/chat')) return;

    let cancelled = false;
    let busy = false;

    const inspect = async () => {
      if (busy || cancelled) return;
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Buscar en esta conversación"]');
      if (!searchInput) {
        lastSignatureRef.current = '';
        setFocus(null);
        return;
      }

      if (document.querySelector('.lifonk-chat-search-hit')) {
        setFocus(null);
        return;
      }

      const panel = searchInput.closest('div.rounded-2xl');
      const resultText = panel?.querySelector<HTMLElement>('p.line-clamp-3')?.textContent?.trim() || '';
      const counter = Array.from(panel?.querySelectorAll<HTMLElement>('span') || []).find((node) => /^\d+ de \d+$/.test(node.textContent?.trim() || ''))?.textContent?.trim() || '';
      const signature = `${counter}|${resultText}`;
      if (!resultText || signature === lastSignatureRef.current) return;
      lastSignatureRef.current = signature;
      busy = true;

      try {
        let conversationId = conversationRef.current;
        if (!conversationId) {
          conversationId = await resolveConversationId();
          conversationRef.current = conversationId;
        }
        if (!conversationId) return;

        if (!messagesRef.current.length) messagesRef.current = await loadAllMessages(conversationId);
        const matches = messagesRef.current.filter((message) => (message.content || '').trim() === resultText);
        const match = matches[0] || messagesRef.current.find((message) => (message.content || '').includes(resultText));
        if (!match || cancelled) return;

        const index = messagesRef.current.findIndex((message) => message.messageId === match.messageId);
        setFocus(match);
        setContext(index < 0 ? [match] : messagesRef.current.slice(Math.max(0, index - 3), Math.min(messagesRef.current.length, index + 4)));
      } catch (error) {
        console.error('No se pudo abrir el contexto del resultado:', error);
      } finally {
        busy = false;
      }
    };

    const observer = new MutationObserver(() => { void inspect(); });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(() => { void inspect(); }, 500);
    void inspect();

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  if (!focus) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(82px+env(safe-area-inset-bottom))] top-[calc(env(safe-area-inset-top)+205px)] z-[2147481900] overflow-y-auto bg-[#f7f5f8]/98 px-4 py-5 backdrop-blur dark:bg-[#090713]/98">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-[#443C68] dark:text-[#c4b5fd]">Ubicación en el historial</p>
            <p className="text-[10px] text-slate-500">La coincidencia aparece con sus mensajes anteriores y posteriores.</p>
          </div>
          <button type="button" onClick={() => setFocus(null)} className="rounded-full border border-slate-300 p-2 text-slate-500 dark:border-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          {context.map((message) => {
            const selected = message.messageId === focus.messageId;
            return (
              <div key={message.messageId} className={`rounded-2xl border p-3 shadow-sm ${selected ? 'border-[#C97B63] bg-[#fff6f1] ring-2 ring-[#C97B63]/30 dark:bg-[#21151a]' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#12101a]'}`}>
                <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-bold text-slate-500">
                  <span>@{message.senderUsername || 'usuario'}</span>
                  <span>{message.createdAt ? new Date(message.createdAt).toLocaleString() : ''}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{message.content || 'Archivo o multimedia'}</p>
                {selected && <p className="mt-2 text-[10px] font-black text-[#C97B63]">Coincidencia encontrada</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
