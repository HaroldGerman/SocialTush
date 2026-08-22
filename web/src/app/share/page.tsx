'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Link2, Search, Send, Share2 } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';

type Conversation = {
  conversationId: string | null;
  name: string;
  avatarUrl?: string;
  isGroup: boolean;
  otherUsername?: string;
};

function ShareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const sharedText = useMemo(() => {
    const title = (searchParams?.get('title') || '').trim();
    const text = (searchParams?.get('text') || '').trim();
    const url = (searchParams?.get('url') || '').trim();
    return [title, text, url].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join('\n').trim();
  }, [searchParams]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const returnTo = `/share?${searchParams?.toString() || ''}`;
      router.replace(`/login?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    void api.get('/chat/conversations')
      .then(response => setConversations(Array.isArray(response.data) ? response.data : []))
      .catch(() => setError('No pudimos cargar tus conversaciones.'));
  }, [user, isLoading, router, searchParams]);

  const filtered = conversations.filter(item => {
    const needle = query.trim().toLowerCase();
    return !needle || item.name?.toLowerCase().includes(needle) || item.otherUsername?.toLowerCase().includes(needle);
  });

  const sendTo = async (conversation: Conversation) => {
    if (!sharedText || sendingId) return;
    const key = conversation.conversationId || conversation.otherUsername || conversation.name;
    setSendingId(key);
    setError('');
    try {
      if (conversation.conversationId) {
        await api.post(`/chat/conversations/${conversation.conversationId}/messages`, {
          content: sharedText,
          messageType: 'TEXT',
        });
      } else if (conversation.otherUsername) {
        await api.post(`/chat/direct/${encodeURIComponent(conversation.otherUsername)}/messages`, {
          content: sharedText,
          messageType: 'TEXT',
        });
      } else {
        throw new Error('Conversación inválida');
      }
      router.replace('/chat');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo compartir en esta conversación.');
      setSendingId(null);
    }
  };

  if (isLoading || !user) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-[#f7f6fb] text-[#1a1620] dark:bg-[#0d0b14] dark:text-white"><div className="animate-pulse text-sm font-bold">Abriendo Lifonk…</div></main>;
  }

  return (
    <main className="min-h-[100dvh] bg-[#f7f6fb] px-4 pb-8 pt-[calc(1rem+env(safe-area-inset-top))] text-[#1a1620] dark:bg-[#0d0b14] dark:text-white">
      <div className="mx-auto max-w-xl">
        <header className="mb-5 flex items-center gap-3">
          <button onClick={() => router.back()} className="rounded-xl border border-black/10 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-white/5" aria-label="Volver"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#6d28d9]">Lifonk</p>
            <h1 className="text-xl font-extrabold">Compartir en chat</h1>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6d28d9] text-white shadow-lg shadow-[#6d28d9]/20"><Share2 className="h-5 w-5" /></div>
        </header>

        <section className="mb-5 rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#6d28d9]"><Link2 className="h-4 w-4" />Contenido compartido</div>
          <p className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{sharedText || 'No se recibió contenido para compartir.'}</p>
        </section>

        <label className="relative mb-4 block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar conversación…" className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-10 pr-4 text-sm outline-none focus:border-[#6d28d9] dark:border-white/10 dark:bg-white/5" />
        </label>

        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}

        <div className="space-y-2">
          {filtered.map(conversation => {
            const key = conversation.conversationId || conversation.otherUsername || conversation.name;
            const busy = sendingId === key;
            return <button key={key} disabled={!sharedText || Boolean(sendingId)} onClick={() => void sendTo(conversation)} className="flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 text-left shadow-sm transition active:scale-[.99] disabled:opacity-60 dark:border-white/10 dark:bg-white/5">
              <UserAvatar avatarUrl={conversation.avatarUrl || ''} name={conversation.name} className="h-11 w-11 rounded-full text-xs" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{conversation.name}</p><p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{conversation.isGroup ? 'Círculo' : conversation.otherUsername ? `@${conversation.otherUsername}` : 'Conversación'}</p></div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6d28d9]/10 text-[#6d28d9]">{busy ? <span className="text-[10px] font-bold">…</span> : <Send className="h-4 w-4" />}</span>
            </button>;
          })}
          {!filtered.length && <div className="py-12 text-center text-sm text-slate-400">No encontramos conversaciones.</div>}
        </div>
      </div>
    </main>
  );
}

export default function SharePage() {
  return <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f6fb] text-sm font-bold">Abriendo Lifonk…</div>}><ShareContent /></Suspense>;
}
