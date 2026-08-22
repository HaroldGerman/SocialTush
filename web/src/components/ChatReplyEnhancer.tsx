'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Reply, X } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';

type ChatMessage = { messageId: string; senderUsername: string; senderDisplayName: string; content: string; messageType: string };
type Conversation = { conversationId: string | null; otherUsername?: string; name?: string };
type ReplyPreview = { messageId: string; senderUsername: string; senderDisplayName: string; content: string; messageType: string };
type ReplyContext = { messageId: string; replyTo: ReplyPreview };

function activeUsername() {
  const query = new URLSearchParams(window.location.search).get('username');
  if (query) return query;
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('span,p'));
  const found = nodes.find((node) => {
    const text = node.textContent?.trim() || '';
    if (!/^@[A-Za-z0-9_.-]+$/.test(text)) return false;
    const rect = node.getBoundingClientRect();
    return rect.top >= 0 && rect.top < 270 && rect.width > 0;
  });
  return found?.textContent?.trim().replace(/^@/, '') || '';
}

function messageWrappers() {
  return Array.from(document.querySelectorAll<HTMLElement>('div.flex.flex-col')).filter(
    (node) => typeof node.className === 'string' && node.className.includes('max-w-[82%]'),
  );
}

function previewText(message: ChatMessage) {
  const text = (message.content || '').trim();
  if (text) return text.slice(0, 180);
  switch ((message.messageType || '').toUpperCase()) {
    case 'IMAGE': return '📷 Foto';
    case 'VIDEO': return '🎬 Video';
    case 'AUDIO': return '🎤 Nota de voz';
    case 'STORY_REPLY':
    case 'STORY_REACTION': return 'Momento';
    default: return 'Mensaje';
  }
}

export default function ChatReplyEnhancer() {
  const { user, accessToken } = useAuth();
  const [replying, setReplying] = useState<ChatMessage | null>(null);
  const [conversationId, setConversationId] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const contextsRef = useRef<Map<string, ReplyPreview>>(new Map());
  const refreshBusy = useRef(false);

  const decorate = useCallback(() => {
    if (!window.location.pathname.startsWith('/chat')) return;
    const wrappers = messageWrappers();
    const messages = messagesRef.current;
    if (!wrappers.length || !messages.length) return;
    const offset = Math.max(0, messages.length - wrappers.length);

    wrappers.forEach((wrapper, index) => {
      const message = messages[offset + index];
      if (!message) return;
      wrapper.dataset.lifonkMessageId = message.messageId;

      let action = wrapper.querySelector<HTMLButtonElement>('[data-lifonk-reply-action]');
      if (!action) {
        action = document.createElement('button');
        action.type = 'button';
        action.dataset.lifonkReplyAction = 'true';
        action.className = 'mt-1 inline-flex items-center gap-1 self-start rounded-full px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-100 hover:text-teal-700 dark:hover:bg-slate-800';
        action.textContent = '↩ Responder';
        wrapper.appendChild(action);
      }
      action.dataset.messageId = message.messageId;

      const context = contextsRef.current.get(message.messageId);
      const bubble = wrapper.firstElementChild as HTMLElement | null;
      if (context && bubble && !bubble.querySelector('[data-lifonk-reply-quote]')) {
        const quote = document.createElement('button');
        quote.type = 'button';
        quote.dataset.lifonkReplyQuote = 'true';
        quote.dataset.parentId = context.messageId;
        quote.className = 'mb-2 block w-full rounded-xl border-l-[3px] border-teal-300 bg-black/10 px-2.5 py-2 text-left text-[10px]';
        quote.innerHTML = '<strong class="block text-[10px] opacity-90"></strong><span class="mt-0.5 block max-w-[250px] truncate opacity-75"></span>';
        (quote.querySelector('strong') as HTMLElement).textContent = context.senderDisplayName || `@${context.senderUsername}`;
        (quote.querySelector('span') as HTMLElement).textContent = context.content || 'Mensaje';
        bubble.insertBefore(quote, bubble.firstChild);
      }
    });
  }, []);

  const refresh = useCallback(async () => {
    if (refreshBusy.current || !window.location.pathname.startsWith('/chat')) return;
    refreshBusy.current = true;
    try {
      const username = activeUsername();
      if (!username) return;
      const conversationsResponse = await api.get('/chat/conversations');
      const conversations = (Array.isArray(conversationsResponse.data) ? conversationsResponse.data : []) as Conversation[];
      const conversation = conversations.find((item) => item.otherUsername?.toLowerCase() === username.toLowerCase());
      if (!conversation?.conversationId) return;
      setConversationId(conversation.conversationId);
      const [messagesResponse, contextResponse] = await Promise.all([
        api.get(`/chat/conversations/${conversation.conversationId}/messages?size=50`),
        api.get(`/chat/conversations/${conversation.conversationId}/reply-context`),
      ]);
      messagesRef.current = (Array.isArray(messagesResponse.data) ? messagesResponse.data : messagesResponse.data?.content || []) as ChatMessage[];
      const map = new Map<string, ReplyPreview>();
      (Array.isArray(contextResponse.data) ? contextResponse.data : []).forEach((item: ReplyContext) => {
        if (item.messageId && item.replyTo) map.set(item.messageId, item.replyTo);
      });
      contextsRef.current = map;
      window.setTimeout(decorate, 20);
    } catch (error) {
      console.error('Chat reply enhancer:', error);
    } finally {
      refreshBusy.current = false;
    }
  }, [decorate]);

  const sendReply = useCallback(async () => {
    if (!replying || !conversationId || sending) return;
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="mensaje" i]');
    const content = textarea?.value?.trim() || '';
    if (!content) {
      setNotice('Escribe una respuesta.');
      return;
    }
    setSending(true);
    try {
      await api.post(`/chat/conversations/${conversationId}/replies`, {
        parentMessageId: replying.messageId,
        content,
      });
      if (textarea) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(textarea, '');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      setReplying(null);
      window.setTimeout(() => void refresh(), 250);
      window.setTimeout(() => void refresh(), 900);
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'No se pudo enviar la respuesta.');
    } finally {
      setSending(false);
    }
  }, [replying, conversationId, refresh, sending]);

  useEffect(() => {
    if (!user || !accessToken) return;
    void refresh();
    const observer = new MutationObserver(() => decorate());
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [user, accessToken, refresh, decorate]);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!window.location.pathname.startsWith('/chat')) return;
      const target = event.target as HTMLElement | null;
      const action = target?.closest<HTMLButtonElement>('[data-lifonk-reply-action]');
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        const message = messagesRef.current.find((item) => item.messageId === action.dataset.messageId);
        if (message) {
          setReplying(message);
          window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="mensaje" i]')?.focus(), 30);
        }
        return;
      }
      const quote = target?.closest<HTMLButtonElement>('[data-lifonk-reply-quote]');
      if (quote?.dataset.parentId) {
        event.preventDefault();
        const original = document.querySelector<HTMLElement>(`[data-lifonk-message-id="${quote.dataset.parentId}"]`);
        if (original) {
          original.scrollIntoView({ behavior: 'smooth', block: 'center' });
          original.classList.add('ring-2', 'ring-teal-400', 'ring-offset-2');
          window.setTimeout(() => original.classList.remove('ring-2', 'ring-teal-400', 'ring-offset-2'), 1400);
        }
      }
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, []);

  useEffect(() => {
    const submit = (event: SubmitEvent) => {
      if (!replying || !window.location.pathname.startsWith('/chat')) return;
      const form = event.target as HTMLFormElement | null;
      if (!form?.querySelector('textarea[placeholder*="mensaje" i]')) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void sendReply();
    };
    document.addEventListener('submit', submit, true);
    return () => document.removeEventListener('submit', submit, true);
  }, [replying, sendReply]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!replying || event.key !== 'Enter' || event.shiftKey || !window.matchMedia('(pointer:fine)').matches) return;
      const target = event.target as HTMLElement | null;
      if (!(target instanceof HTMLTextAreaElement)) return;
      event.preventDefault();
      event.stopPropagation();
      void sendReply();
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [replying, sendReply]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return <>
    {replying && typeof document !== 'undefined' && createPortal(
      <div className="fixed bottom-[calc(78px+env(safe-area-inset-bottom))] left-4 right-[72px] z-[2147481500] mx-auto max-w-xl rounded-2xl border border-teal-200 bg-white/95 p-2.5 shadow-xl backdrop-blur dark:border-teal-900 dark:bg-[#111b2a]/95">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><Reply className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black text-teal-700 dark:text-teal-300">Respondiendo a {replying.senderDisplayName || `@${replying.senderUsername}`}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-300">{previewText(replying)}</p>
          </div>
          <button type="button" onClick={() => setReplying(null)} className="p-1 text-slate-400"><X className="h-4 w-4" /></button>
        </div>
      </div>,
      document.body,
    )}
    {notice && typeof document !== 'undefined' && createPortal(
      <div className="fixed left-1/2 top-4 z-[2147483002] -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-xl">{notice}</div>,
      document.body,
    )}
  </>;
}
