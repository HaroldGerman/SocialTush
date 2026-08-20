'use client';

import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, Heart, MessageCircle, MoreVertical, Pause, Play, Share2, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import MobileBottomBar from '@/components/MobileBottomBar';
import UserAvatar from '@/components/UserAvatar';
import { useAuth, api } from '@/context/AuthContext';
import { formatLocalTimestamp } from '@/lib/dateUtils';

interface ReelDto { postId: string; userId: string; username: string; displayName: string; avatarUrl?: string; caption: string; mediaUrls: string[]; mediaTypes: string[]; likesCount: number; commentsCount: number; hasLiked: boolean; isSaved: boolean; createdAt: string; }
interface CommentDto { commentId: string; username: string; displayName: string; avatarUrl?: string; content: string; createdAt: string; }

export default function ReelsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [reels, setReels] = useState<ReelDto[]>([]);
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0), [isLast, setIsLast] = useState(true);
  const [muted, setMuted] = useState(true), [activeIndex, setActiveIndex] = useState(0);
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set());
  const [statusIcon, setStatusIcon] = useState<'PLAY' | 'PAUSE' | null>(null);
  const [error, setError] = useState('');
  const [commentsFor, setCommentsFor] = useState<ReelDto | null>(null);
  const [comments, setComments] = useState<CommentDto[]>([]), [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false), [deleteTarget, setDeleteTarget] = useState<ReelDto | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null), videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const requestInFlight = useRef(false);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); }, [user, isLoading, router]);
  const fetchPage = useCallback(async (nextPage: number, replace = false) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true; replace ? setLoading(true) : setLoadingMore(true);
    try {
      const res = await api.get(`/posts/reels?page=${nextPage}&size=10`), incoming: ReelDto[] = res.data?.posts || [];
      setReels(previous => replace ? incoming : [...previous, ...incoming.filter(item => !previous.some(old => old.postId === item.postId))]);
      setPage(nextPage); setIsLast(Boolean(res.data?.isLast)); setError('');
    } catch (requestError) { console.error('No se pudieron cargar los Destellos:', requestError); setError('No se pudieron cargar los Destellos.'); }
    finally { requestInFlight.current = false; setLoading(false); setLoadingMore(false); }
  }, []);
  useEffect(() => { if (user) void fetchPage(0, true); }, [user, fetchPage]);
  useEffect(() => { reels.forEach((reel, index) => { const video = videoRefs.current[reel.postId]; if (!video) return; if (index === activeIndex && !pausedIds.has(reel.postId) && !commentsFor && !deleteTarget) video.play().catch(() => undefined); else video.pause(); }); }, [activeIndex, reels, pausedIds, commentsFor, deleteTarget]);

  const handleScroll = () => { const node = containerRef.current; if (!node) return; const index = Math.max(0, Math.min(reels.length - 1, Math.round(node.scrollTop / node.clientHeight))); if (index !== activeIndex) setActiveIndex(index); if (!isLast && !loadingMore && index >= reels.length - 3) void fetchPage(page + 1); };
  const handleLike = async (postId: string) => { try { const res = await api.post(`/likes/${postId}`); setReels(old => old.map(reel => reel.postId === postId ? { ...reel, hasLiked: res.data.liked, likesCount: res.data.count } : reel)); setError(''); } catch (requestError) { console.error(requestError); setError('No se pudo actualizar la resonancia.'); } };
  const handleSave = async (postId: string) => { try { const res = await api.post(`/posts/${postId}/save`); setReels(old => old.map(reel => reel.postId === postId ? { ...reel, isSaved: res.data.saved } : reel)); setError(''); } catch (requestError) { console.error(requestError); setError('No se pudo actualizar la colección.'); } };
  const togglePlayback = (reel: ReelDto) => { const wasPaused = pausedIds.has(reel.postId); setPausedIds(old => { const next = new Set(old); wasPaused ? next.delete(reel.postId) : next.add(reel.postId); return next; }); setStatusIcon(wasPaused ? 'PLAY' : 'PAUSE'); window.setTimeout(() => setStatusIcon(null), 600); };
  const openComments = async (reel: ReelDto) => { setCommentsFor(reel); setComments([]); setCommentsLoading(true); setError(''); try { const res = await api.get(`/comments/${reel.postId}`); setComments(res.data || []); } catch (requestError) { console.error(requestError); setError('No se pudieron cargar los ecos.'); } finally { setCommentsLoading(false); } };
  const sendComment = async (event: FormEvent) => { event.preventDefault(); if (!commentsFor || !commentText.trim()) return; try { const res = await api.post(`/comments/${commentsFor.postId}`, { content: commentText.trim() }); setComments(old => [...old, res.data]); setCommentText(''); setReels(old => old.map(reel => reel.postId === commentsFor.postId ? { ...reel, commentsCount: reel.commentsCount + 1 } : reel)); setCommentsFor(current => current ? { ...current, commentsCount: current.commentsCount + 1 } : current); setError(''); } catch (requestError) { console.error(requestError); setError('No se pudo publicar. Conservamos tu texto para reintentar.'); } };
  const deleteReel = async () => { if (!deleteTarget) return; try { await api.delete(`/posts/${deleteTarget.postId}`); setReels(old => old.filter(reel => reel.postId !== deleteTarget.postId)); setActiveIndex(index => Math.max(0, Math.min(index, reels.length - 2))); setDeleteTarget(null); setError(''); } catch (requestError) { console.error(requestError); setError('No se pudo eliminar el Destello.'); } };
  const share = async (reel: ReelDto) => { const url = `${window.location.origin}/post/${reel.postId}`; try { if (navigator.share) await navigator.share({ title: `Destello de @${reel.username}`, url }); else { await navigator.clipboard.writeText(url); setError('Enlace copiado.'); } } catch (shareError) { if ((shareError as DOMException).name !== 'AbortError') setError('No se pudo expandir el enlace.'); } };

  if (loading || isLoading) return <div className="flex min-h-screen items-center justify-center bg-[#090d16] text-teal-400">Cargando Destellos…</div>;
  if (!reels.length) return <div className="flex min-h-screen flex-col items-center justify-center bg-[#090d16] p-6 pb-20 text-white"><Sparkles className="mb-4 h-12 w-12 text-teal-400"/><h3 className="text-lg font-extrabold">No hay Destellos disponibles</h3><p className="mb-6 text-xs text-slate-400">Los Destellos compartidos aparecerán aquí.</p>{error && <p className="mb-3 text-xs text-rose-400">{error}</p>}<button onClick={() => void fetchPage(0, true)} className="rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold">Reintentar</button><MobileBottomBar/></div>;

  return <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090d16] pb-16 text-white md:pb-0">
    <div className="absolute left-4 right-4 top-[max(1rem,env(safe-area-inset-top))] z-40 mx-auto flex max-w-md items-center justify-between"><button aria-label="Volver" onClick={() => router.back()} className="rounded-full border border-white/10 bg-black/40 p-2.5"><ArrowLeft className="h-5 w-5"/></button><b className="text-sm uppercase tracking-wider text-teal-400">Destellos</b><button aria-label={muted ? 'Activar sonido' : 'Silenciar'} onClick={() => setMuted(value => !value)} className="rounded-full border border-white/10 bg-black/40 p-2.5">{muted ? <VolumeX className="h-5 w-5"/> : <Volume2 className="h-5 w-5"/>}</button></div>
    {error && !deleteTarget && <button onClick={() => setError('')} className="absolute left-1/2 top-16 z-[70] -translate-x-1/2 rounded-xl bg-rose-950/95 px-4 py-2 text-xs text-rose-100">{error}</button>}
    <div ref={containerRef} onScroll={handleScroll} className="relative h-[100dvh] w-full max-w-md snap-y snap-mandatory overflow-y-scroll scrollbar-none">
      {reels.map((reel, index) => <article key={reel.postId} className="relative flex h-full w-full snap-start items-center justify-center overflow-hidden bg-slate-900">
        {reel.mediaTypes?.[0] === 'VIDEO' && reel.mediaUrls?.[0] ? <video ref={element => { videoRefs.current[reel.postId] = element; }} src={reel.mediaUrls[0]} loop muted={muted} playsInline preload={Math.abs(index - activeIndex) <= 1 ? 'auto' : 'metadata'} onClick={() => togglePlayback(reel)} className="h-full w-full object-cover"/> : <div className="p-8 text-center text-sm text-slate-400">Este Destello no contiene un video válido.</div>}
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-black/80"/>{index === activeIndex && statusIcon && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">{statusIcon === 'PLAY' ? <Play className="h-16 w-16 fill-white/80"/> : <Pause className="h-16 w-16 fill-white/80"/>}</div>}
        <div className="absolute bottom-24 right-4 z-30 flex flex-col items-center gap-5">{user?.userId === reel.userId && <button aria-label="Opciones del Destello" onClick={() => setDeleteTarget(reel)} className="rounded-full border border-white/10 bg-black/40 p-3"><MoreVertical className="h-6 w-6"/></button>}<button aria-label="Resonar con este Destello" onClick={() => void handleLike(reel.postId)} className="flex flex-col items-center gap-1"><span className="rounded-full border border-white/10 bg-black/40 p-3"><Heart className={`h-6 w-6 ${reel.hasLiked ? 'fill-rose-500 text-rose-500' : ''}`}/></span><b className="text-[11px]">{reel.likesCount}</b></button><button aria-label="Ecos" onClick={() => void openComments(reel)} className="flex flex-col items-center gap-1"><span className="rounded-full border border-white/10 bg-black/40 p-3"><MessageCircle className="h-6 w-6"/></span><b className="text-[11px]">{reel.commentsCount}</b></button><button aria-label="Coleccionar" onClick={() => void handleSave(reel.postId)} className="rounded-full border border-white/10 bg-black/40 p-3"><Bookmark className={`h-6 w-6 ${reel.isSaved ? 'fill-teal-400 text-teal-400' : ''}`}/></button><button aria-label="Expandir" onClick={() => void share(reel)} className="rounded-full border border-white/10 bg-black/40 p-3"><Share2 className="h-6 w-6"/></button></div>
        <div className="absolute bottom-20 left-4 right-20 z-30 space-y-3"><div className="flex items-center gap-3"><Link href={`/profile/${reel.username}`}><UserAvatar avatarUrl={reel.avatarUrl} name={reel.displayName || reel.username} className="h-10 w-10 rounded-full border border-white/20 text-xs"/></Link><Link href={`/profile/${reel.username}`} className="text-sm font-extrabold">@{reel.username}</Link></div>{reel.caption && <p className="line-clamp-3 text-xs text-slate-100">{reel.caption}</p>}</div>
      </article>)}{loadingMore && <div className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs">Cargando…</div>}
    </div><MobileBottomBar/>
    {commentsFor && <div className="fixed inset-0 z-[80] flex items-end bg-black/60 md:items-center md:justify-center" onMouseDown={event => { if (event.target === event.currentTarget) setCommentsFor(null); }}><section className="flex max-h-[75dvh] w-full flex-col rounded-t-3xl bg-white text-slate-900 md:max-w-lg md:rounded-3xl"><header className="flex items-center justify-between border-b p-4"><b>Ecos ({commentsFor.commentsCount})</b><button aria-label="Cerrar" onClick={() => setCommentsFor(null)}><X className="h-5 w-5"/></button></header><div className="min-h-32 flex-1 space-y-3 overflow-y-auto p-4">{commentsLoading ? <p className="text-sm text-slate-500">Cargando…</p> : comments.length ? comments.map(comment => <div key={comment.commentId} className="flex gap-3"><UserAvatar avatarUrl={comment.avatarUrl} name={comment.displayName || comment.username} className="h-8 w-8 rounded-full text-[10px]"/><div><p className="text-xs"><b>@{comment.username}</b> <span className="text-slate-400">· {formatLocalTimestamp(comment.createdAt)}</span></p><p className="break-words text-sm">{comment.content}</p></div></div>) : <p className="text-center text-sm text-slate-500">Sé el primero en dejar un eco.</p>}</div><form onSubmit={sendComment} className="flex gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><input value={commentText} onChange={event => setCommentText(event.target.value)} placeholder="Escribe un eco…" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"/><button disabled={!commentText.trim()} className="rounded-xl bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50">Responder</button></form></section></div>}
    {deleteTarget && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4"><section className="w-full max-w-sm rounded-2xl bg-white p-5 text-slate-900"><h2 className="font-bold">¿Eliminar este Destello?</h2><p className="mt-1 text-sm text-slate-500">Esta acción no se puede deshacer.</p>{error && <p className="mt-3 text-xs text-rose-600">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => { setDeleteTarget(null); setError(''); }} className="rounded-xl px-4 py-2 text-sm">Cancelar</button><button onClick={() => void deleteReel()} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white">Eliminar</button></div></section></div>}
  </div>;
}
