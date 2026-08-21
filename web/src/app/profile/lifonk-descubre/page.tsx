'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Compass, Heart, MessageCircle, Sparkles } from 'lucide-react';
import MobileBottomBar from '@/components/MobileBottomBar';
import EcoThread from '@/components/EcoThread';
import { api } from '@/context/AuthContext';

interface DiscoveryPost {
  postId: string;
  caption: string;
  mediaUrls?: string[];
  mediaTypes?: string[];
  createdAt: string;
  likesCount?: number;
  commentsCount?: number;
  hasLiked?: boolean;
}

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSeconds < 45) return 'Ahora';
  if (diffSeconds < 3600) return `hace ${Math.max(1, Math.floor(diffSeconds / 60))} min`;
  if (diffSeconds < 86400) return `hace ${Math.floor(diffSeconds / 3600)} h`;
  const days = Math.floor(diffSeconds / 86400);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} d`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  if (days < 365) return `hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) === 1 ? '' : 'es'}`;
  const years = Math.floor(days / 365);
  return `hace ${years} año${years === 1 ? '' : 's'}`;
}

function splitCaption(caption = '') {
  const [title, ...rest] = caption.split(/\n\n+/);
  return { title: title?.trim() || 'Descubre algo nuevo', body: rest.join('\n\n').trim() };
}

export default function LifonkDescubreProfile() {
  const [posts, setPosts] = useState<DiscoveryPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedEcos, setExpandedEcos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get('/posts/user/lifonk-descubre?size=20')
      .then(response => {
        if (!active) return;
        const data = Array.isArray(response.data) ? response.data : response.data?.content;
        setPosts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setPosts([]);
        setError('No pudimos cargar las publicaciones oficiales en este momento.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const toggleResonance = async (postId: string) => {
    try {
      const response = await api.post(`/likes/${postId}`);
      setPosts(previous => previous.map(post => post.postId === postId
        ? { ...post, hasLiked: Boolean(response.data?.liked), likesCount: Number(response.data?.count || 0) }
        : post));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'No se pudo actualizar la resonancia.');
    }
  };

  const incrementEcoCount = (postId: string) => {
    setPosts(previous => previous.map(post => post.postId === postId
      ? { ...post, commentsCount: Number(post.commentsCount || 0) + 1 }
      : post));
  };

  return (
    <div className="min-h-[100dvh] bg-[#f4f7f7] pb-24 text-slate-900 dark:bg-[#07151d] dark:text-white">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 pb-3 pt-[calc(.7rem+env(safe-area-inset-top))] backdrop-blur-xl dark:border-slate-800 dark:bg-[#0f172a]/95">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          <Link href="/feed" aria-label="Volver a Ritmo" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300"><ArrowLeft className="h-5 w-5"/></Link>
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-600 dark:text-teal-400">Perfil oficial</p><h1 className="text-lg font-black leading-none">Lifonk Descubre</h1></div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl space-y-4 px-3 py-4">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
          <div className="bg-gradient-to-br from-teal-700 via-teal-800 to-cyan-950 px-5 pb-5 pt-8 text-white">
            <div className="flex items-end gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20 bg-white/10 text-3xl font-black shadow-xl backdrop-blur">L</div>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><h2 className="truncate text-xl font-black">Lifonk Descubre</h2><BadgeCheck className="h-5 w-5 text-cyan-300"/></div><p className="text-xs text-cyan-100">@lifonk-descubre</p></div>
            </div>
          </div>
          <div className="p-5">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">Cuenta oficial de Lifonk para descubrir paisajes, ciencia, cultura, lugares e ideas interesantes. Aquí también puedes resonar y dejar Ecos como en cualquier perfil.</p>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 dark:border-teal-900/70 dark:bg-teal-950/30 dark:text-teal-300"><Sparkles className="h-4 w-4"/>Contenido oficial de descubrimiento</div>
          </div>
        </section>

        <div className="flex items-center gap-2 px-1"><Compass className="h-4 w-4 text-teal-500"/><h3 className="text-sm font-black">Publicaciones</h3></div>

        {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">{error}</p>}
        {loading && <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-[#0f172a]">Cargando publicaciones…</p>}
        {!loading && posts.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-[#0f172a]">Lifonk Descubre todavía no tiene publicaciones reales para mostrar.</p>}

        {posts.map(post => {
          const copy = splitCaption(post.caption);
          const image = post.mediaUrls?.[0];
          const likes = Number(post.likesCount || 0);
          const ecos = Number(post.commentsCount || 0);
          return (
            <article key={post.postId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 text-sm font-black text-white">L</div>
                  <div><div className="flex items-center gap-1"><span className="text-sm font-black">Lifonk Descubre</span><BadgeCheck className="h-3.5 w-3.5 text-teal-500"/></div><span className="text-[10px] text-slate-400">@lifonk-descubre</span></div>
                </div>
                <time dateTime={post.createdAt} className="text-[10px] font-semibold text-slate-400">{relativeTime(post.createdAt)}</time>
              </div>
              {image && <img src={image} alt={copy.title} className="max-h-[68dvh] w-full object-cover" loading="lazy" />}
              <div className="p-4"><h4 className="text-base font-black">{copy.title}</h4>{copy.body && <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{copy.body}</p>}</div>

              <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="flex items-center gap-5">
                  <button type="button" onClick={() => void toggleResonance(post.postId)} className={`inline-flex items-center gap-1.5 text-xs font-extrabold transition ${post.hasLiked ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500 dark:text-slate-400'}`}>
                    <Heart className={`h-5 w-5 ${post.hasLiked ? 'fill-current' : ''}`} />
                    <span>Resonar{likes > 0 ? ` ${likes}` : ''}</span>
                  </button>
                  <button type="button" onClick={() => setExpandedEcos(previous => ({ ...previous, [post.postId]: !previous[post.postId] }))} className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400">
                    <MessageCircle className="h-5 w-5" />
                    <span>Ecos{ecos > 0 ? ` ${ecos}` : ''}</span>
                  </button>
                </div>
                {expandedEcos[post.postId] && <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800"><EcoThread postId={post.postId} onCommentAdded={() => incrementEcoCount(post.postId)} /></div>}
              </div>
            </article>
          );
        })}
      </main>

      <MobileBottomBar />
    </div>
  );
}
