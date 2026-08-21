'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Compass, Sparkles } from 'lucide-react';
import MobileBottomBar from '@/components/MobileBottomBar';
import { api } from '@/context/AuthContext';

interface DiscoveryPost {
  postId: string;
  caption: string;
  mediaUrls?: string[];
  createdAt: string;
}

const FALLBACK_POSTS: DiscoveryPost[] = [
  {
    postId: 'fallback-1',
    caption: 'Hay lugares que parecen inventados\n\nMontañas, niebla y silencio. A veces descubrir también es detenerse un momento y mirar.',
    mediaUrls: ['https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=82'],
    createdAt: '2026-08-20T18:10:00-05:00'
  },
  {
    postId: 'fallback-2',
    caption: 'El desierto también guarda ritmo\n\nLas dunas cambian lentamente con el viento: un paisaje puede estar vivo aunque parezca inmóvil.',
    mediaUrls: ['https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=82'],
    createdAt: '2026-08-20T15:40:00-05:00'
  },
  {
    postId: 'fallback-3',
    caption: 'Un minuto de bosque\n\nLos ecosistemas forestales conectan raíces, hongos, agua y nutrientes en redes mucho más complejas de lo que vemos.',
    mediaUrls: ['https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=82'],
    createdAt: '2026-08-19T21:15:00-05:00'
  }
];

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
  return {
    title: title?.trim() || 'Descubre algo nuevo',
    body: rest.join('\n\n').trim()
  };
}

export default function LifonkDescubreProfile() {
  const [posts, setPosts] = useState<DiscoveryPost[]>(FALLBACK_POSTS);

  useEffect(() => {
    let active = true;
    api.get('/posts/user/lifonk-descubre?size=20')
      .then(response => {
        if (!active) return;
        const data = Array.isArray(response.data) ? response.data : response.data?.content;
        if (Array.isArray(data) && data.length) setPosts(data);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

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
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">Cuenta oficial de Lifonk para descubrir paisajes, ciencia, cultura, lugares e ideas interesantes. Su contenido aparece en Ritmo para que siempre haya algo nuevo que explorar.</p>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 dark:border-teal-900/70 dark:bg-teal-950/30 dark:text-teal-300"><Sparkles className="h-4 w-4"/>Contenido oficial de descubrimiento</div>
          </div>
        </section>

        <div className="flex items-center gap-2 px-1"><Compass className="h-4 w-4 text-teal-500"/><h3 className="text-sm font-black">Publicaciones</h3></div>

        {posts.map(post => {
          const copy = splitCaption(post.caption);
          const image = post.mediaUrls?.[0];
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
            </article>
          );
        })}
      </main>

      <MobileBottomBar />
    </div>
  );
}
