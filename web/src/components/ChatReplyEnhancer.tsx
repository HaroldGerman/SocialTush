'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';

type ChatMessage = { messageId: string; senderUsername: string; senderDisplayName: string; content: string; messageType: string; replyTo?: ReplyPreview };
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

function composerTextarea() {
  return document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="mensaje" i]');
}

function composerForm() {
  return composerTextarea()?.closest('form') || null;
}

function previewText(message: ChatMessage | ReplyPreview) {
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

function setTextIfChanged(node: HTMLElement | null, value: string) {
  if (node && node.textContent !== value) node.textContent = value;
}

function isEnhancerMutation(mutation: MutationRecord) {
  const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
  if (target?.closest('[data-lifonk-reply-action],[data-lifonk-reply-quote]')) return true;

  return Array.from(mutation.addedNodes).every((node) => {
    if (!(node instanceof Element)) return false;
    return node.matches('[data-lifonk-reply-action],[data-lifonk-reply-quote]') ||
      Boolean(node.closest('[data-lifonk-reply-action],[data-lifonk-reply-quote]'));
  });
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
  const decorateFrame = useRef<number | null>(null);

  const decorate = useCallback(() => {
    if (!window.location.pathname.startsWith('/chat')) return;
    const wrappers = messageWrappers();
    const messages = messagesRef.current;
    if (!wrappers.length || !messages.length) return;
    const offset = Math.max(0, messages.length - wrappers.length);

    wrappers.forEach((wrapper, index) => {
      const message = messages[offset + index];
      if (!message) return;
      if (wrapper.dataset.lifonkMessageId !== message.messageId) {
        wrapper.dataset.lifonkMessageId = message.messageId;
      }

      let action = wrapper.querySelector<HTMLButtonElement>('[data-lifonk-reply-action]');
      if (!action) {
        action = document.createElement('button');
        action.type = 'button';
        action.dataset.lifonkReplyAction = 'true';
        action.className = 'mt-1 inline-flex items-center gap-1 self-start rounded-full px-2 py-1 text-[10px] font-bold text-slate-400 transition hover:bg-slate-100 hover:text-violet-700 dark:hover:bg-slate-800';
        action.textContent = '↩ Responder';
        wrapper.appendChild(action);
      }
      if (action.dataset.messageId !== message.messageId) {
        action.dataset.messageId = message.messageId;
      }

      const context = contextsRef.current.get(message.messageId) || message.replyTo;
      if (message.replyTo && !contextsRef.current.has(message.messageId)) {
        contextsRef.current.set(message.messageId, message.replyTo);
      }
      const bubble = wrapper.firstElementChild as HTMLElement | null;
      const existingQuote = bubble?.querySelector<HTMLElement>('[data-lifonk-reply-quote]');
      if (!context || !bubble) {
        existingQuote?.remove();
        return;
      }

      let quote = existingQuote as HTMLButtonElement | null;
      if (!quote) {
        quote = document.createElement('button');
        quote.type = 'button';
        quote.dataset.lifonkReplyQuote = 'true';
        quote.className = 'mb-2 block w-full rounded-lg border-l-[3px] border-violet-400 bg-black/10 px-2.5 py-2 text-left text-[10px] transition hover:bg-black/15';
        quote.innerHTML = '<strong class="block text-[10px] opacity-95"></strong><span class="mt-0.5 block max-w-[250px] truncate opacity-75"></span>';
        bubble.insertBefore(quote, bubble.firstChild);
      }
      if (quote.dataset.parentId !== context.messageId) {
        quote.dataset.parentId = context.messageId;
      }
      setTextIfChanged(quote.querySelector('strong'), context.senderDisplayName || `@${context.senderUsername}`);
      setTextIfChanged(quote.querySelector('span'), previewText(context));
    });
  }, []);

  const scheduleDecorate = useCallback(() => {
    if (decorateFrame.current !== null) return;
    decorateFrame.current = window.requestAnimationFrame(() => {
      decorateFrame.current = null;
      decorate();
    });
  }, [decorate]);

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
      setConversationId((current) => current === conversation.conversationId ? current : conversation.conversationId!);
      const [messagesResponse, contextResponse] = await Promise.all([
        api.get(`/chat/conversations/${conversation.conversationId}/messages?size=50`),
        api.get(`/chat/conversations/${conversation.conversationId}/reply-context`),
      ]);
      messagesRef.current = (Array.isArray(messagesResponse.data) ? messagesResponse.data : messagesResponse.data?.content || []) as ChatMessage[];
      const map = new Map<string, ReplyPreview>();
      (Array.isArray(contextResponse.data) ? contextResponse.data : []).forEach((item: ReplyContext) => {
        if (item.messageId && item.replyTo) map.set(item.messageId, item.replyTo);
      });
      messagesRef.current.forEach((message) => {
        if (message.messageId && message.replyTo) map.set(message.messageId, message.replyTo);
      });
      contextsRef.current = map;
      scheduleDecorate();
    } catch (error) {
      console.error('Chat reply enhancer:', error);
    } finally {
      refreshBusy.current = false;
    }
  }, [scheduleDecorate]);

  const clearComposer = () => {
    const textarea = composerTextarea();
    if (!textarea) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, '');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const sendReply = useCallback(async () => {
    if (!replying || !conversationId || sending) return;
    const textarea = composerTextarea();
    const content = textarea?.value?.trim() || '';
    if (!content) {
      setNotice('Escribe una respuesta.');
      textarea?.focus();
      return;
    }

    setSending(true);
    setNotice('');
    try {
      const response = await api.post(`/chat/conversations/${conversationId}/replies`, {
        parentMessageId: replying.messageId,
        content,
      });
      const sent = response.data as ChatMessage;
      if (sent?.messageId) {
        const immediateContext = sent.replyTo || {
          messageId: replying.messageId,
          senderUsername: replying.senderUsername,
          senderDisplayName: replying.senderDisplayName,
          content: replying.content,
          messageType: replying.messageType,
        };
        contextsRef.current.set(sent.messageId, immediateContext);
        if (!messagesRef.current.some((item) => item.messageId === sent.messageId)) {
          messagesRef.current = [...messagesRef.current, { ...sent, replyTo: immediateContext }];
        }
      }
      clearComposer();
      setReplying(null);

      /* The backend already returns replyTo. Decorate immediately instead of
         waiting for a later refresh, which caused the quote to disappear until reload. */
      scheduleDecorate();
      window.setTimeout(scheduleDecorate, 60);
      window.setTimeout(scheduleDecorate, 180);
      window.setTimeout(() => {
        const end = document.querySelector<HTMLElement>('[data-lifonk-message-id]:last-of-type');
        end?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 220);
      window.setTimeout(() => void refresh(), 900);
    } catch (error: any) {
      setNotice(error?.response?.data?.message || 'No se pudo enviar la respuesta.');
    } finally {
      setSending(false);
    }
  }, [replying, conversationId, refresh, scheduleDecorate, sending]);

  useEffect(() => {
    if (!user || !accessToken) return;
    void refresh();
    const observer = new MutationObserver((mutations) => {
      if (mutations.length && mutations.every(isEnhancerMutation)) return;
      scheduleDecorate();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      if (decorateFrame.current !== null) {
        window.cancelAnimationFrame(decorateFrame.current);
        decorateFrame.current = null;
      }
    };
  }, [user, accessToken, refresh, scheduleDecorate]);

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
          window.setTimeout(() => composerTextarea()?.focus(), 30);
        }
        return;
      }

      const quote = target?.closest<HTMLButtonElement>('[data-lifonk-reply-quote]');
      if (quote?.dataset.parentId) {
        event.preventDefault();
        const original = document.querySelector<HTMLElement>(`[data-lifonk-message-id="${quote.dataset.parentId}"]`);
        if (original) {
          original.scrollIntoView({ behavior: 'smooth', block: 'center' });
          original.classList.add('ring-2', 'ring-violet-400', 'ring-offset-2');
          window.setTimeout(() => original.classList.remove('ring-2', 'ring-violet-400', 'ring-offset-2'), 1200);
        }
        return;
      }

      if (!replying || sending) return;
      const form = composerForm();
      const submitButton = target?.closest<HTMLButtonElement>('button[type="submit"]');
      if (!form || !submitButton || !form.contains(submitButton)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void sendReply();
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, [replying, sending, sendReply]);

  useEffect(() => {
    const submit = (event: SubmitEvent) => {
      if (!replying || sending || !window.location.pathname.startsWith('/chat')) return;
      const form = event.target as HTMLFormElement | null;
      if (!form || form !== composerForm()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void sendReply();
    };
    document.addEventListener('submit', submit, true);
    return () => document.removeEventListener('submit', submit, true);
  }, [replying, sending, sendReply]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!replying || sending || event.key !== 'Enter' || event.shiftKey || !window.matchMedia('(pointer:fine)').matches) return;
      const target = event.target as HTMLElement | null;
      if (!(target instanceof HTMLTextAreaElement) || target !== composerTextarea()) return;
      event.preventDefault();
      event.stopPropagation();
      void sendReply();
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [replying, sending, sendReply]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return <>
    {replying && typeof document !== 'undefined' && createPortal(
      <div className="pointer-events-none fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-0 right-0 z-[2147481500] px-3">
        <div className="pointer-events-auto mx-auto max-w-xl overflow-hidden rounded-t-xl border border-b-0 border-slate-200 bg-white shadow-[0_-6px_20px_rgba(15,23,42,.08)] dark:border-[#26364c] dark:bg-[#111b2a]">
          <div className="flex items-center gap-3 border-l-4 border-violet-500 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-extrabold text-violet-700 dark:text-violet-300">{replying.senderDisplayName || `@${replying.senderUsername}`}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-300">{previewText(replying)}</p>
            </div>
            <button type="button" aria-label="Cancelar respuesta" onClick={() => setReplying(null)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
          </div>
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
