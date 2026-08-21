'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Heart, MessageCircle, Pause, Play, Plus, Send, Share2, Sparkles, Volume2, VolumeX } from 'lucide-react';
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
  avatarUrl?: string;
  content: string;
  createdAt?: string;
}

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv)(?:$|\?)/i;

function isVideoUrl(url?: string) {
  return Boolean(url && VIDEO_EXTENSIONS.test(url));
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function ageHours(createdAt?: string) {
  if (!createdAt) return 9999;
  const age = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  return Number.isFinite(age) ? Math.max(0, age) : 9999;
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
}: {
  post: PulsePost;
  active: boolean;
  muted: boolean;
  onToggleMuted: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      video.pause();
      video.currentTime = 0;
      setPaused(false);
    }
  }, [active]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().then(() => setPaused(false)).catch(() => {});
    else { video.pause(); setPaused(true); }
  };

  return <>
    <button type="button" onClick={togglePlayback} className="absolute inset-0 z-0 h-full w-full bg-black" aria-label={paused ? 'Reproducir' : 'Pausar'}>
      <video
        ref={videoRef}
        src={post.mediaUrls[0]}
        loop
        muted={muted}
        playsInline
        preload={active ? 'auto' : 'metadata'}
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
  const { openCreateHub } = useCreateHub();
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
      const [feedResponse, profileResponse] = await Promise.all([
        api.get('/posts/feed'),
        user?.username ? api.get(`/profiles/${encodeURIComponent(user.username)}`).catch(() => null) : Promise.resolve(null),
      ]);
      const data = feedResponse.data?.posts || feedResponse.data?.content || (Array.isArray(feedResponse.data) ? feedResponse.data : []);
      setPosts((Array.isArray(data) ? data : []).filter((post: PulsePost) => post.mediaUrls?.some(isVideoUrl)));
      const rawInterests = String(profileResponse?.data?.interests || '');
      setInterests(rawInterests.split(',').map((item: string) => item.trim()).filter(Boolean));
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  useEffect(() => { void load(); }, [load]);

  const rankedPosts = useMemo(() => {
    const normalizedInterests = interests.map(normalize);
    return [...posts].sort((a, b) => {
      const score = (post: PulsePost) => {
        const text = normalize(`${post.caption || ''} ${post.musicTitle || ''} ${post.location || ''}`);
        const interestMatches = normalizedInterests.reduce((total, interest) => total + (interest && text.includes(interest) ? 1 : 0), 0);
        const engagement = Math.log1p((post.likesCount || 0) * 2 + (post.commentsCount || 0) * 3);
        const freshness = Math.max(0, 4 - ageHours(post.createdAt) / 24);
        return interestMatches * 6 + engagement + freshness;
      };
      return score(b) - score(a);
    });
  }, [posts, interests]);

  useEffect(() => {
    if (!rankedPosts.length) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target) setActivePostId((visible.target as HTMLElement).dataset.postId || null);
    }, { threshold: [0.55, 0.7, 0.85] });
    Object.values(itemRefs.current).forEach(element => element && observer.observe(element));
    setActivePostId(previous => previous || rankedPosts[0]?.postId || null);
    return () => observer.disconnect();
  }, [rankedPosts]);

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
    const url = `${window.location.origin}/pulse`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Pulso · Lifonk', text: post.caption || 'Mira este Pulso en Lifonk', url }); } catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  };

  const openComments = async (post: PulsePost) => {
    setCommentsPost(post);
    setLoadingComments(true);
    try {
      const response = await api.get(`/comments/${post.postId}`);
      setComments(response.data || []);
    } catch { setComments([]); }
    finally { setLoadingComments(false); }
  };

  const addComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!commentsPost || !commentText.trim()) return;
    try {
      const response = await api.post(`/comments/${commentsPost.postId}`, { content: commentText.trim() });
      setComments(previous => [...previous, response.data]);
      setPosts(previous => previous.map(post => post.postId === commentsPost.postId ? { ...post, commentsCount: (post.commentsCount || 0) + 1 } : post));
      setCommentsPost(previous => previous ? { ...previous, commentsCount: previous.commentsCount + 1 } : previous);
      setCommentText('');
    } catch {}
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-black text-white">
      <header className="fixed left-0 right-0 top-0 z-40 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-4 pb-5 pt-[calc(.7rem+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="flex items-center gap-1 rounded-full bg-black/35 p-1 text-sm font-black backdrop-blur">
            <Link href="/feed" className="rounded-full px-4 py-2 text-white/65">Ritmo</Link>
            <span className="rounded-full bg-white px-4 py-2 text-slate-950">Pulso</span>
          </div>
          <button onClick={openCreateHub} className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 shadow-lg shadow-black/30" aria-label="Crear"><Plus className="h-5 w-5"/></button>
        </div>
      </header>

      {loading ? (
        <div className="flex h-full items-center justify-center"><div className="flex flex-col items-center gap-3"><div className="h-11 w-11 animate-pulse rounded-2xl bg-teal-600"/><p className="text-sm font-bold text-white/70">Buscando pulsos…</p></div></div>
      ) : rankedPosts.length === 0 ? (
        <div className="flex h-full items-center justify-center px-8 pb-16 text-center">
          <div className="max-w-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-600/20 text-teal-300"><Sparkles className="h-8 w-8"/></div><h1 className="mt-5 text-2xl font-black">Pulso está esperando su primer video</h1><p className="mt-2 text-sm leading-relaxed text-white/60">Los videos que publiques en Lifonk podrán aparecer aquí y llegar a personas fuera de tus conexiones.</p><button onClick={openCreateHub} className="mt-5 rounded-2xl bg-teal-600 px-6 py-3 text-sm font-black">Publicar un video</button></div>
        </div>
      ) : (
        <main className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rankedPosts.map(post => (
            <article
              key={post.postId}
              ref={element => { itemRefs.current[post.postId] = element; }}
              data-post-id={post.postId}
              className="relative h-[calc(100dvh-4rem)] min-h-[calc(100dvh-4rem)] snap-start snap-always overflow-hidden bg-black md:h-[100dvh] md:min-h-[100dvh]"
            >
              <PulseVideo post={post} active={activePostId === post.postId} muted={muted} onToggleMuted={() => setMuted(value => !value)} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5 bg-gradient-to-t from-black via-black/45 to-transparent"/>

              <div className="absolute bottom-20 left-4 right-20 z-20 md:bottom-8">
                <Link href={`/profile/${encodeURIComponent(post.username)}`} className="inline-flex items-center gap-2.5">
                  <UserAvatar avatarUrl={post.avatarUrl} name={post.displayName || post.username} className="h-10 w-10 rounded-full border-2 border-white/80 text-xs"/>
                  <div><p className="text-sm font-black drop-shadow">{post.displayName || post.username}</p><p className="text-[11px] font-semibold text-white/70">@{post.username} · {timeLabel(post.createdAt)}</p></div>
                </Link>
                {post.caption && <p className="mt-3 line-clamp-3 text-sm font-semibold leading-relaxed text-white drop-shadow">{post.caption}</p>}
                {post.musicTitle && <p className="mt-2 text-[11px] font-bold text-white/75">♫ {post.musicTitle}</p>}
              </div>

              <div className="absolute bottom-20 right-3 z-20 flex flex-col items-center gap-4 md:bottom-8">
                <button onClick={() => void toggleLike(post.postId)} className="flex flex-col items-center gap-1"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 backdrop-blur"><Heart className={`h-5 w-5 ${post.hasLiked ? 'fill-rose-500 text-rose-500' : 'text-white'}`}/></span><span className="text-[10px] font-black">{post.likesCount || 0}</span></button>
                <button onClick={() => void openComments(post)} className="flex flex-col items-center gap-1"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 backdrop-blur"><MessageCircle className="h-5 w-5"/></span><span className="text-[10px] font-black">{post.commentsCount || 0}</span></button>
                <button onClick={() => void toggleSave(post.postId)} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 backdrop-blur"><Bookmark className={`h-5 w-5 ${post.isSaved ? 'fill-teal-300 text-teal-300' : ''}`}/></button>
                <button onClick={() => void share(post)} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 backdrop-blur"><Share2 className="h-5 w-5"/></button>
              </div>
            </article>
          ))}
        </main>
      )}

      {commentsPost && <div className="fixed inset-0 z-[80] flex items-end bg-black/55" onClick={() => setCommentsPost(null)}><section className="max-h-[72dvh] w-full rounded-t-[28px] bg-white text-slate-900 shadow-2xl dark:bg-[#0d1524] dark:text-white" onClick={event => event.stopPropagation()}><div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700"/><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="font-black">Ecos <span className="text-slate-400">{commentsPost.commentsCount || 0}</span></h2><button onClick={() => setCommentsPost(null)} className="text-sm font-black text-teal-600">Cerrar</button></div><div className="max-h-[48dvh] space-y-4 overflow-y-auto p-5">{loadingComments ? <p className="text-center text-sm text-slate-400">Cargando ecos…</p> : comments.length ? comments.map((comment, index) => <div key={comment.commentId || comment.id || index} className="flex gap-3"><UserAvatar avatarUrl={comment.avatarUrl} name={comment.displayName || comment.username || 'L'} className="h-9 w-9 rounded-full text-[10px]"/><div className="min-w-0"><p className="text-xs font-black">{comment.displayName || comment.username || 'Usuario'}</p><p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{comment.content}</p></div></div>) : <p className="py-8 text-center text-sm text-slate-400">Todavía no hay ecos. Sé el primero.</p>}</div><form onSubmit={addComment} className="flex gap-2 border-t border-slate-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-slate-800"><input value={commentText} onChange={event => setCommentText(event.target.value)} placeholder="Deja un eco…" className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 dark:bg-[#111e2d]"/><button disabled={!commentText.trim()} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white disabled:opacity-40"><Send className="h-4 w-4"/></button></form></section></div>}

      <MobileBottomBar />
    </div>
  );
}
