'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Bookmark, Heart, MessageCircle, Play, Plus, Share2, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import { useCreateHub } from '@/context/CreateHubContext';
import MobileBottomBar from '@/components/MobileBottomBar';
import UserAvatar from '@/components/UserAvatar';

interface PulsePost {
  postId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  caption: string;
  location?: string;
  musicTitle?: string;
  mediaUrls: string[];
  mediaTypes?: string[];
  mediaThumbnailUrls?: string[];
  isShortVideo?: boolean;
  likesCount: number;
  commentsCount: number;
  hasLiked: boolean;
  isSaved?: boolean;
  createdAt: string;
}

interface CommentItem {
  commentId?: string;
  id?: string;
  username?: string;
  displayName?: string;
  content: string;
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function ageHours(createdAt?: string) {
  if (!createdAt) return 9999;
  const value = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  return Number.isFinite(value) ? Math.max(0, value) : 9999;
}

function timeLabel(createdAt?: string) {
  if (!createdAt) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  if (seconds < 60) return 'ahora';
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  if (seconds < 172800) return 'ayer';
  return `hace ${Math.floor(seconds / 86400)} d`;
}

function PulseVideo({
  post,
  active,
  muted,
  onToggleMuted,
  onWatch,
}: {
  post: PulsePost;
  active: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  onWatch: (watchMillis: number, completed: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onWatchRef = useRef(onWatch);
  const startedAtRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const completedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => { onWatchRef.current = onWatch; }, [onWatch]);

  const flushWatch = useCallback(() => {
    if (!activeRef.current || startedAtRef.current == null) return;
    const watched = Math.max(0, Math.min(120000, Date.now() - startedAtRef.current));
    activeRef.current = false;
    startedAtRef.current = null;
    if (watched >= 800) onWatchRef.current(watched, completedRef.current);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      activeRef.current = true;
      startedAtRef.current = Date.now();
      completedRef.current = false;
      void video.play().then(() => setPaused(false)).catch(() => setPaused(true));
      return;
    }
    flushWatch();
    video.pause();
    video.currentTime = 0;
    setPaused(false);
  }, [active, flushWatch]);

  useEffect(() => () => flushWatch(), [flushWatch]);
  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted; }, [muted]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().then(() => setPaused(false));
    else { video.pause(); setPaused(true); }
  };

  return <>
    <button type="button" onClick={togglePlayback} className="absolute inset-0 h-full w-full bg-black" aria-label={paused ? 'Reproducir' : 'Pausar'}>
      <video
        ref={videoRef}
        src={post.mediaUrls[0]}
        poster={post.mediaThumbnailUrls?.[0]}
        loop
        muted={muted}
        playsInline
        preload={active ? 'auto' : 'metadata'}
        onTimeUpdate={event => {
          const video = event.currentTarget;
          if (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime / video.duration >= 0.9) completedRef.current = true;
        }}
        className="h-full w-full object-contain"
      />
      {paused && <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"><Play className="h-7 w-7 fill-current"/></span></span>}
    </button>
    <button type="button" onClick={onToggleMuted} className="absolute right-4 top-20 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur" aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
      {muted ? <VolumeX className="h-4 w-4"/> : <Volume2 className="h-4 w-4"/>}
    </button>
  </>;
}

export default function PulsePage() {
  const { user } = useAuth();
  const { openPulseComposer } = useCreateHub();
  const [posts, setPosts] = useState<PulsePost[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [commentsPost, setCommentsPost] = useState<PulsePost | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pulseResponse, profileResponse] = await Promise.all([
        api.get('/posts/reels', { params: { size: 40 } }),
        user?.username ? api.get(`/profiles/${encodeURIComponent(user.username)}`).catch(() => null) : Promise.resolve(null),
      ]);
      const values = pulseResponse.data?.posts || [];
      setPosts(Array.isArray(values) ? values.filter((post: PulsePost) => post.mediaUrls?.length) : []);
      setInterests(String(profileResponse?.data?.interests || '').split(',').map((item: string) => item.trim()).filter(Boolean));
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener('socialtush:pulse-published', refresh);
    return () => window.removeEventListener('socialtush:pulse-published', refresh);
  }, [load]);

  const rankedPosts = useMemo(() => {
    const normalizedInterests = interests.map(normalize);
    const sourceRank = new Map(posts.map((post, index) => [post.postId, posts.length - index]));
    return [...posts].sort((a, b) => {
      const score = (post: PulsePost) => {
        const text = normalize(`${post.caption || ''} ${post.musicTitle || ''} ${post.location || ''}`);
        const interestMatches = normalizedInterests.reduce((total, interest) => total + (interest && text.includes(interest) ? 1 : 0), 0);
        const retentionRank = (sourceRank.get(post.postId) || 0) * 0.45;
        const engagement = Math.log1p((post.likesCount || 0) * 2 + (post.commentsCount || 0) * 3);
        const freshness = Math.max(0, 4 - ageHours(post.createdAt) / 18);
        return interestMatches * 6 + retentionRank + engagement + freshness;
      };
      return score(b) - score(a);
    });
  }, [posts, interests]);

  useEffect(() => {
    if (!rankedPosts.length) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target) setActivePostId((visible.target as HTMLElement).dataset.postId || null);
    }, { threshold: [0.55, 0.72, 0.88] });
    Object.values(itemRefs.current).forEach(element => element && observer.observe(element));
    setActivePostId(previous => previous || rankedPosts[0]?.postId || null);
    return () => observer.disconnect();
  }, [rankedPosts]);

  const recordWatch = useCallback((postId: string, watchMillis: number, completed: boolean) => {
    void api.post(`/posts/${postId}/pulse-view`, { watchMillis, completed }).catch(() => {});
  }, []);

  const toggleLike = async (postId: string) => {
    try {
      const response = await api.post(`/likes/${postId}`);
      setPosts(previous => previous.map(post => post.postId === postId ? { ...post, hasLiked: response.data.liked, likesCount: response.data.count } : post));
    } catch {}
  };

  const toggleSave = async (postId: string) => {
    try {
      const response = await api.post(`/posts/${postId}/save`);
      setPosts(previous => previous.map(post => post.postId === postId ? { ...post, isSaved: response.data.saved } : post));
    } catch {}
  };

  const share = async (post: PulsePost) => {
    const url = `${window.location.origin}/post/${post.postId}`;
    let shared = false;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pulso · Lifonk', text: post.caption || 'Mira este Pulso en Lifonk', url });
        shared = true;
      } catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      shared = true;
    }
    if (shared) void api.post(`/posts/${post.postId}/pulse-share`).catch(() => {});
  };

  const openComments = async (post: PulsePost) => {
    setCommentsPost(post);
    setLoadingComments(true);
    try {
      const response = await api.get(`/comments/${post.postId}`);
      setComments(response.data || []);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!commentsPost || !commentText.trim()) return;
    try {
      const response = await api.post(`/comments/${commentsPost.postId}`, { content: commentText.trim() });
      setComments(previous => [...previous, response.data]);
      setPosts(previous => previous.map(post => post.postId === commentsPost.postId ? { ...post, commentsCount: (post.commentsCount || 0) + 1 } : post));
      setCommentText('');
    } catch {}
  };

  return <div className="h-[100dvh] overflow-hidden bg-black text-white">
    <header className="fixed left-0 right-0 top-0 z-40 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-4 pb-5 pt-[calc(.7rem+env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-xl items-center justify-between">
        <div className="flex items-center gap-1 rounded-full bg-black/35 p-1 text-sm font-black backdrop-blur"><Link href="/feed" className="rounded-full px-4 py-2 text-white/65">Ritmo</Link><span className="rounded-full bg-white px-4 py-2 text-slate-950">Pulso · Para ti</span></div>
        <div className="flex items-center gap-2">{user && <Link href="/pulse/studio" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur" aria-label="Estudio Pulso"><BarChart3 className="h-4 w-4"/></Link>}<button onClick={openPulseComposer} className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 shadow-lg shadow-black/30" aria-label="Crear Pulso"><Plus className="h-5 w-5"/></button></div>
      </div>
    </header>

    {loading ? <div className="flex h-full items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="h-11 w-11 animate-pulse rounded-2xl bg-teal-600"/><p className="text-sm font-bold text-white/70">Buscando pulsos…</p></div></div> : rankedPosts.length === 0 ? <div className="flex h-full items-center justify-center px-8 pb-16 text-center"><div className="max-w-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-600/20 text-teal-300"><Sparkles className="h-8 w-8"/></div><h1 className="mt-5 text-2xl font-black">Sé el primer Pulso</h1><p className="mt-2 text-sm leading-relaxed text-white/60">Publica un clip corto y deja que Lifonk lo descubra más allá de tus conexiones.</p><button onClick={openPulseComposer} className="mt-5 rounded-2xl bg-teal-600 px-6 py-3 text-sm font-black">Crear Pulso</button></div></div> : <main className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {rankedPosts.map(post => <article key={post.postId} ref={element => { itemRefs.current[post.postId] = element; }} data-post-id={post.postId} className="relative h-[calc(100dvh-4rem)] min-h-[calc(100dvh-4rem)] snap-start snap-always overflow-hidden bg-black md:h-[100dvh] md:min-h-[100dvh]">
        <PulseVideo post={post} active={activePostId === post.postId} muted={muted} onToggleMuted={() => setMuted(value => !value)} onWatch={(watchMillis, completed) => recordWatch(post.postId, watchMillis, completed)} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5 bg-gradient-to-t from-black via-black/45 to-transparent"/>
        <div className="absolute bottom-20 left-4 right-20 z-20 md:bottom-8"><Link href={`/profile/${encodeURIComponent(post.username)}`} className="inline-flex items-center gap-2.5"><UserAvatar avatarUrl={post.avatarUrl} name={post.displayName || post.username} className="h-10 w-10 rounded-full border-2 border-white/80 text-xs"/><div><p className="text-sm font-black drop-shadow">{post.displayName || post.username}</p><p className="text-[11px] font-semibold text-white/70">@{post.username} · {timeLabel(post.createdAt)}</p></div></Link>{post.caption && <p className="mt-3 line-clamp-3 text-sm font-semibold leading-relaxed text-white drop-shadow">{post.caption}</p>}{post.musicTitle && <p className="mt-2 text-[11px] font-bold text-white/75">♫ {post.musicTitle}</p>}</div>
        <div className="absolute bottom-20 right-3 z-20 flex flex-col items-center gap-4 md:bottom-8"><button onClick={() => void toggleLike(post.postId)} className="flex flex-col items-center gap-1"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 backdrop-blur"><Heart className={`h-5 w-5 ${post.hasLiked ? 'fill-rose-500 text-rose-500' : 'text-white'}`}/></span><span className="text-[10px] font-black">{post.likesCount || 0}</span></button><button onClick={() => void openComments(post)} className="flex flex-col items-center gap-1"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 backdrop-blur"><MessageCircle className="h-5 w-5"/></span><span className="text-[10px] font-black">{post.commentsCount || 0}</span></button><button onClick={() => void toggleSave(post.postId)} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 backdrop-blur"><Bookmark className={`h-5 w-5 ${post.isSaved ? 'fill-teal-300 text-teal-300' : ''}`}/></button><button onClick={() => void share(post)} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 backdrop-blur"><Share2 className="h-5 w-5"/></button></div>
      </article>)}
    </main>}

    {commentsPost && <div className="fixed inset-0 z-[80] flex items-end bg-black/55" onClick={() => setCommentsPost(null)}><section className="max-h-[72dvh] w-full rounded-t-[28px] bg-white text-slate-900 shadow-2xl dark:bg-[#0d1524] dark:text-white" onClick={event => event.stopPropagation()}><div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700"/><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="font-black">Ecos</h2><button onClick={() => setCommentsPost(null)} className="text-xs font-bold text-slate-500">Cerrar</button></div><div className="max-h-[48dvh] space-y-3 overflow-y-auto p-4">{loadingComments ? <p className="py-10 text-center text-xs text-slate-400">Cargando ecos…</p> : comments.length === 0 ? <p className="py-10 text-center text-xs text-slate-400">Todavía no hay ecos.</p> : comments.map((comment, index) => <div key={comment.commentId || comment.id || index} className="rounded-2xl bg-slate-100 p-3 text-xs dark:bg-[#152033]"><strong>{comment.displayName || comment.username || 'Lifonk'}</strong><p className="mt-1 text-slate-600 dark:text-slate-300">{comment.content}</p></div>)}</div><form onSubmit={addComment} className="flex gap-2 border-t border-slate-200 p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] dark:border-slate-800"><input value={commentText} onChange={event => setCommentText(event.target.value)} placeholder="Deja un eco…" className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none dark:bg-[#101827]"/><button disabled={!commentText.trim()} className="rounded-2xl bg-teal-600 px-5 text-sm font-black text-white disabled:opacity-40">Enviar</button></form></section></div>}
    <MobileBottomBar/>
  </div>;
}
