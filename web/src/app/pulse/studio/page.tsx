'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Eye, Heart, MessageCircle, Play, Share2, Timer, Trophy } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import MobileBottomBar from '@/components/MobileBottomBar';

interface PulsePost {
  postId: string;
  caption: string;
  mediaUrls: string[];
  mediaThumbnailUrls?: string[];
  isShortVideo?: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

interface Insight {
  postId: string;
  views: number;
  averageWatchSeconds: number;
  completionRate: number;
  completions: number;
  shares: number;
  resonances: number;
  echoes: number;
}

function timeLabel(createdAt: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  if (seconds < 60) return 'Ahora';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return `Hace ${Math.floor(seconds / 86400)} d`;
}

export default function PulseStudioPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PulsePost[]>([]);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.username) return;
    setLoading(true);
    try {
      const response = await api.get(`/posts/user/${encodeURIComponent(user.username)}`, { params: { size: 50 } });
      const all = response.data?.content || response.data || [];
      const pulses = (Array.isArray(all) ? all : []).filter((post: PulsePost) => post.isShortVideo);
      setPosts(pulses);
      const results = await Promise.all(pulses.map(async (post: PulsePost) => {
        try {
          const metric = await api.get(`/posts/${post.postId}/pulse-insights`);
          return metric.data as Insight;
        } catch { return null; }
      }));
      const next: Record<string, Insight> = {};
      results.filter(Boolean).forEach(value => { if (value) next[value.postId] = value; });
      setInsights(next);
    } catch { setPosts([]); setInsights({}); }
    finally { setLoading(false); }
  }, [user?.username]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const values = Object.values(insights);
    const views = values.reduce((sum, item) => sum + item.views, 0);
    const shares = values.reduce((sum, item) => sum + item.shares, 0);
    const resonances = values.reduce((sum, item) => sum + item.resonances, 0);
    const weightedWatch = values.reduce((sum, item) => sum + item.averageWatchSeconds * item.views, 0);
    const weightedCompletion = values.reduce((sum, item) => sum + item.completionRate * item.views, 0);
    return {
      views,
      shares,
      resonances,
      averageWatch: views ? Math.round((weightedWatch / views) * 10) / 10 : 0,
      completion: views ? Math.round((weightedCompletion / views) * 10) / 10 : 0,
    };
  }, [insights]);

  return <div className="min-h-[100dvh] bg-[#f4f6f9] pb-20 text-slate-900 dark:bg-[#090d16] dark:text-white">
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-[#0f172a]/95">
      <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4"><Link href="/pulse" className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"><ArrowLeft className="h-4 w-4"/></Link><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-600">Solo para ti</p><h1 className="text-lg font-black">Estudio Pulso</h1></div></div>
    </header>

    <main className="mx-auto max-w-4xl space-y-5 px-4 py-5">
      <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0f766e,#164e63)] p-5 text-white shadow-lg">
        <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5"/><h2 className="font-black">Cómo están funcionando tus Pulsos</h2></div>
        <p className="mt-1 text-xs text-white/70">Estas cifras son privadas y ayudan a entender qué contenido mantiene la atención.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-white/10 p-3 backdrop-blur"><Eye className="h-4 w-4 text-teal-200"/><strong className="mt-2 block text-xl">{totals.views}</strong><span className="text-[9px] font-black uppercase text-white/60">Vistas</span></div><div className="rounded-2xl bg-white/10 p-3 backdrop-blur"><Timer className="h-4 w-4 text-teal-200"/><strong className="mt-2 block text-xl">{totals.averageWatch}s</strong><span className="text-[9px] font-black uppercase text-white/60">Promedio visto</span></div><div className="rounded-2xl bg-white/10 p-3 backdrop-blur"><Trophy className="h-4 w-4 text-amber-300"/><strong className="mt-2 block text-xl">{totals.completion}%</strong><span className="text-[9px] font-black uppercase text-white/60">Finalización</span></div><div className="rounded-2xl bg-white/10 p-3 backdrop-blur"><Share2 className="h-4 w-4 text-teal-200"/><strong className="mt-2 block text-xl">{totals.shares}</strong><span className="text-[9px] font-black uppercase text-white/60">Compartidos</span></div></div>
      </section>

      {loading ? <div className="py-20 text-center text-sm font-bold text-slate-400">Calculando tus métricas…</div> : posts.length === 0 ? <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#0f172a]"><Play className="mx-auto h-8 w-8 text-teal-500"/><h2 className="mt-3 font-black">Todavía no tienes Pulsos</h2><p className="mt-1 text-sm text-slate-500">Cuando publiques uno, aquí verás cómo responde la gente.</p><Link href="/pulse" className="mt-5 inline-block rounded-2xl bg-teal-700 px-5 py-3 text-xs font-black text-white">Ir a Pulso</Link></section> : <div className="space-y-4">{posts.map(post => {
        const metric = insights[post.postId];
        return <article key={post.postId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f172a]"><div className="flex gap-4 p-4"><div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-2xl bg-black">{post.mediaThumbnailUrls?.[0] ? <img src={post.mediaThumbnailUrls[0]} alt="Portada" className="h-full w-full object-cover"/> : <video src={post.mediaUrls[0]} muted playsInline preload="metadata" className="h-full w-full object-cover"/>}<span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-black/40 p-2 text-white"><Play className="h-4 w-4 fill-current"/></span></span></div><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-slate-400">{timeLabel(post.createdAt)}</p><h3 className="mt-1 line-clamp-2 text-sm font-black">{post.caption || 'Pulso sin descripción'}</h3>{metric ? <div className="mt-4 grid grid-cols-3 gap-2"><div><strong className="block text-sm">{metric.views}</strong><span className="text-[9px] text-slate-400">vistas</span></div><div><strong className="block text-sm">{metric.averageWatchSeconds}s</strong><span className="text-[9px] text-slate-400">promedio</span></div><div><strong className="block text-sm">{metric.completionRate}%</strong><span className="text-[9px] text-slate-400">completo</span></div></div> : <p className="mt-4 text-[10px] text-slate-400">Sin datos todavía.</p>}</div></div>{metric && <div className="grid grid-cols-3 border-t border-slate-100 text-center dark:border-slate-800"><div className="p-3"><Heart className="mx-auto h-4 w-4 text-rose-500"/><strong className="mt-1 block text-xs">{metric.resonances}</strong><span className="text-[8px] uppercase text-slate-400">Resonancias</span></div><div className="border-x border-slate-100 p-3 dark:border-slate-800"><MessageCircle className="mx-auto h-4 w-4 text-teal-500"/><strong className="mt-1 block text-xs">{metric.echoes}</strong><span className="text-[8px] uppercase text-slate-400">Ecos</span></div><div className="p-3"><Share2 className="mx-auto h-4 w-4 text-cyan-500"/><strong className="mt-1 block text-xs">{metric.shares}</strong><span className="text-[8px] uppercase text-slate-400">Compartidos</span></div></div>}</article>;
      })}</div>}
    </main>
    <MobileBottomBar/>
  </div>;
}
