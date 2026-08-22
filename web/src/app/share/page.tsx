'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Link2, MessageSquare, Search, Send, Share2, Sparkles, Activity } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';

type Conversation = {
  conversationId: string | null;
  name: string;
  avatarUrl?: string;
  isGroup: boolean;
  otherUsername?: string;
};

type Destination = 'chat' | 'momento' | 'ritmo';

function ShareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const [destination, setDestination] = useState<Destination>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const sharedText = useMemo(() => {
    const title = (searchParams?.get('title') || '').trim();
    const text = (searchParams?.get('text') || '').trim();
    const url = (searchParams?.get('url') || '').trim();
    return [title, text, url].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join('\n').trim();
  }, [searchParams]);

  const [ritmoText, setRitmoText] = useState('');
  const [momentoText, setMomentoText] = useState('');

  useEffect(() => {
    setRitmoText(sharedText);
    setMomentoText(sharedText.slice(0, 250));
  }, [sharedText]);

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

  const publishToRitmo = async () => {
    const caption = ritmoText.trim();
    if (!caption || publishing) return;
    setPublishing(true);
    setError('');
    try {
      const form = new FormData();
      form.append('caption', caption);
      await api.post('/posts', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      window.dispatchEvent(new CustomEvent('socialtush:post-published'));
      router.replace('/feed');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo compartir en Ritmo.');
    } finally {
      setPublishing(false);
    }
  };

  const publishMomento = async () => {
    const textContent = momentoText.trim();
    if (!textContent || publishing) return;
    setPublishing(true);
    setError('');
    try {
      const form = new FormData();
      form.append('mediaType', 'TEXT');
      form.append('textContent', textContent);
      form.append('backgroundColor', 'linear-gradient(135deg, #443C68 0%, #1A1620 100%)');
      form.append('isBestFriends', 'false');
      await api.post('/stories', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      window.dispatchEvent(new CustomEvent('socialtush:story-published'));
      router.replace('/feed');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo publicar el Momento.');
    } finally {
      setPublishing(false);
    }
  };

  if (isLoading || !user) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-[#EFE8E3] text-[#1A1620] dark:bg-[#1A1620] dark:text-white"><div className="animate-pulse text-sm font-bold">Abriendo Lifonk…</div></main>;
  }

  const destinationButton = (value: Destination, label: string, Icon: typeof MessageSquare) => (
    <button type="button" onClick={() => { setDestination(value); setError(''); }} className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-extrabold transition ${destination === value ? 'bg-[#443C68] text-white shadow-lg shadow-[#443C68]/20' : 'bg-white text-[#443C68] dark:bg-white/5 dark:text-[#D8D1E8]'}`}>
      <Icon className="h-4 w-4" />{label}
    </button>
  );

  return (
    <main className="min-h-[100dvh] bg-[#EFE8E3] px-4 pb-8 pt-[calc(1rem+env(safe-area-inset-top))] text-[#1A1620] dark:bg-[#1A1620] dark:text-white">
      <div className="mx-auto max-w-xl">
        <header className="mb-5 flex items-center gap-3">
          <button onClick={() => router.back()} className="rounded-xl border border-black/10 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-white/5" aria-label="Volver"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#C97B63]">Lifonk</p>
            <h1 className="text-xl font-extrabold">Compartir en Lifonk</h1>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#443C68] text-white shadow-lg shadow-[#443C68]/20"><Share2 className="h-5 w-5" /></div>
        </header>

        <section className="mb-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#443C68] dark:text-[#D8D1E8]"><Link2 className="h-4 w-4" />Contenido compartido</div>
          <p className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{sharedText || 'No se recibió contenido para compartir.'}</p>
        </section>

        <div className="mb-5 flex gap-2 rounded-3xl bg-black/5 p-1.5 dark:bg-white/5">
          {destinationButton('chat', 'Chat', MessageSquare)}
          {destinationButton('momento', 'Momento', Sparkles)}
          {destinationButton('ritmo', 'Ritmo', Activity)}
        </div>

        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}

        {destination === 'chat' && <>
          <label className="relative mb-4 block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar conversación…" className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-10 pr-4 text-sm outline-none focus:border-[#443C68] dark:border-white/10 dark:bg-white/5" />
          </label>

          <div className="space-y-2">
            {filtered.map(conversation => {
              const key = conversation.conversationId || conversation.otherUsername || conversation.name;
              const busy = sendingId === key;
              return <button key={key} disabled={!sharedText || Boolean(sendingId)} onClick={() => void sendTo(conversation)} className="flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 text-left shadow-sm transition active:scale-[.99] disabled:opacity-60 dark:border-white/10 dark:bg-white/5">
                <UserAvatar avatarUrl={conversation.avatarUrl || ''} name={conversation.name} className="h-11 w-11 rounded-full text-xs" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{conversation.name}</p><p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{conversation.isGroup ? 'Círculo' : conversation.otherUsername ? `@${conversation.otherUsername}` : 'Conversación'}</p></div>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#443C68]/10 text-[#443C68] dark:text-[#D8D1E8]">{busy ? <span className="text-[10px] font-bold">…</span> : <Send className="h-4 w-4" />}</span>
              </button>;
            })}
            {!filtered.length && <div className="py-12 text-center text-sm text-slate-400">No encontramos conversaciones.</div>}
          </div>
        </>}

        {destination === 'momento' && <section className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#443C68,#1A1620)] p-5 text-white shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#E7B9AA]">Momento</p>
            <textarea value={momentoText} onChange={event => setMomentoText(event.target.value.slice(0, 250))} maxLength={250} rows={7} className="mt-3 w-full resize-none bg-transparent text-center text-lg font-extrabold leading-relaxed text-white outline-none placeholder:text-white/50" placeholder="Comparte este contenido como Momento…" />
            <div className="text-right text-[10px] text-white/60">{momentoText.length}/250</div>
          </div>
          <button disabled={!momentoText.trim() || publishing} onClick={() => void publishMomento()} className="mt-4 w-full rounded-2xl bg-[#443C68] py-3.5 text-sm font-black text-white shadow-lg disabled:opacity-50">{publishing ? 'Publicando…' : 'Publicar Momento'}</button>
        </section>}

        {destination === 'ritmo' && <section className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#C97B63]">Ritmo</p>
          <h2 className="mt-1 text-lg font-extrabold">Compartir con tu comunidad</h2>
          <textarea value={ritmoText} onChange={event => setRitmoText(event.target.value)} rows={8} className="mt-4 w-full resize-none rounded-2xl border border-black/10 bg-[#EFE8E3]/60 px-4 py-3 text-sm outline-none focus:border-[#443C68] dark:border-white/10 dark:bg-black/20" placeholder="Añade algo antes de compartir…" />
          <button disabled={!ritmoText.trim() || publishing} onClick={() => void publishToRitmo()} className="mt-4 w-full rounded-2xl bg-[#443C68] py-3.5 text-sm font-black text-white shadow-lg disabled:opacity-50">{publishing ? 'Compartiendo…' : 'Compartir en Ritmo'}</button>
        </section>}
      </div>
    </main>
  );
}

export default function SharePage() {
  return <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-[#EFE8E3] text-sm font-bold">Abriendo Lifonk…</div>}><ShareContent /></Suspense>;
}
