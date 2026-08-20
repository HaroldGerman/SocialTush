'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Heart, Image as ImageIcon, MapPin, MessageCircle, Send, Trash2, UserPlus, Users, X } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';
import { formatLocalTimestamp } from '@/lib/dateUtils';

interface CircleDetail {
  id: string; name: string; slug: string; description: string; avatarUrl?: string;
  visibility: string; type: string; city?: string; membersCount: number;
  activeNowCount: number; isMember: boolean;
}

interface CirclePost {
  postId: string; userId: string; username: string; displayName: string; avatarUrl?: string;
  caption: string; mediaUrls: string[]; mediaTypes?: string[]; likesCount: number;
  commentsCount: number; hasLiked: boolean; isSaved: boolean; createdAt: string;
}

interface CommentDto { commentId: string; username: string; displayName: string; avatarUrl?: string; content: string; }

export default function CircleDetailPage() {
  const slug = useParams()?.slug as string;
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [circle, setCircle] = useState<CircleDetail | null>(null);
  const [posts, setPosts] = useState<CirclePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [postText, setPostText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, CommentDto[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const fetchCircle = useCallback(async () => {
    const response = await api.get(`/circles/${slug}`);
    setCircle(response.data);
  }, [slug]);

  const fetchPosts = useCallback(async () => {
    const response = await api.get(`/circles/${slug}/posts?page=0&size=20`);
    setPosts(response.data.posts || []);
  }, [slug]);

  const loadPage = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      await Promise.all([fetchCircle(), fetchPosts()]);
    } catch (error: any) {
      console.error('Error cargando círculo:', error);
      setLoadError(error.response?.data?.message || 'No se pudo cargar el círculo.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchCircle, fetchPosts]);

  useEffect(() => { if (slug) loadPage(); }, [slug, loadPage]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const selectFile = (file?: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) { setSelectedFile(null); setPreviewUrl(''); return; }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleJoinToggle = async () => {
    if (!circle) return;
    setActionError('');
    try {
      await api.post(`/circles/${circle.id}/${circle.isMember ? 'leave' : 'join'}`);
      await Promise.all([fetchCircle(), fetchPosts()]);
    } catch (error: any) {
      setActionError(error.response?.data?.message || 'No se pudo cambiar la membresía.');
    }
  };

  const handlePostSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!circle || (!postText.trim() && !selectedFile)) return;
    setIsSubmitting(true);
    setActionError('');
    try {
      const formData = new FormData();
      if (postText.trim()) formData.append('caption', postText.trim());
      formData.append('circleId', circle.id);
      if (selectedFile) formData.append('files', selectedFile);
      await api.post('/posts', formData);
      setPostText('');
      selectFile();
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchPosts();
    } catch (error: any) {
      setActionError(error.response?.data?.message || 'No se pudo publicar el momento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLike = async (postId: string) => {
    try {
      const response = await api.post(`/likes/${postId}`);
      setPosts(current => current.map(post => post.postId === postId ? { ...post, hasLiked: response.data.liked, likesCount: response.data.count } : post));
    } catch (error: any) { setActionError(error.response?.data?.message || 'No se pudo actualizar el Me gusta.'); }
  };

  const toggleSave = async (postId: string) => {
    try {
      const response = await api.post(`/posts/${postId}/save`);
      setPosts(current => current.map(post => post.postId === postId ? { ...post, isSaved: response.data.saved } : post));
    } catch (error: any) { setActionError(error.response?.data?.message || 'No se pudo guardar la publicación.'); }
  };

  const toggleComments = async (postId: string) => {
    const next = !expandedComments[postId];
    setExpandedComments(current => ({ ...current, [postId]: next }));
    if (next && !comments[postId]) try {
      const response = await api.get(`/comments/${postId}`);
      setComments(current => ({ ...current, [postId]: response.data || [] }));
    } catch (error: any) { setActionError(error.response?.data?.message || 'No se pudieron cargar los comentarios.'); }
  };

  const addComment = async (postId: string, event: React.FormEvent) => {
    event.preventDefault();
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    try {
      const response = await api.post(`/comments/${postId}`, { content });
      setComments(current => ({ ...current, [postId]: [...(current[postId] || []), response.data] }));
      setCommentInputs(current => ({ ...current, [postId]: '' }));
      setPosts(current => current.map(post => post.postId === postId ? { ...post, commentsCount: post.commentsCount + 1 } : post));
    } catch (error: any) { setActionError(error.response?.data?.message || 'No se pudo publicar el comentario.'); }
  };

  const deletePost = async (postId: string) => {
    if (!window.confirm('¿Eliminar esta publicación?')) return;
    try {
      await api.delete(`/posts/${postId}`);
      setPosts(current => current.filter(post => post.postId !== postId));
    } catch (error: any) { setActionError(error.response?.data?.message || 'No se pudo eliminar la publicación.'); }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-[#090d16]">Cargando Círculo…</div>;
  if (!circle || loadError) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-[#090d16]"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#0f172a]"><Users className="mx-auto h-12 w-12 text-slate-400" /><h2 className="mt-3 font-bold text-slate-900 dark:text-white">No se pudo abrir el círculo</h2><p className="mt-2 text-sm text-rose-600">{loadError}</p><button onClick={loadPage} className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white">Reintentar</button><Link href="/circles" className="ml-3 text-xs font-bold text-teal-700">Volver</Link></div></div>;

  return <div className="min-h-screen bg-[#f4f6f9] text-slate-800 dark:bg-[#090d16] dark:text-slate-100">
    <header className="sticky top-0 z-40 border-b border-teal-100 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-[#0f172a]/90"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Link href="/circles" className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 dark:bg-slate-900 dark:text-teal-300"><ArrowLeft className="h-4 w-4" />Círculos</Link><strong className="truncate text-sm">{circle.name}</strong><button onClick={handleJoinToggle} className={`rounded-xl px-4 py-2 text-xs font-bold ${circle.isMember ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' : 'bg-teal-700 text-white'}`}>{circle.isMember ? <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Unido</span> : <span className="flex items-center gap-1"><UserPlus className="h-4 w-4" />Unirse</span>}</button></div></header>

    <section className="bg-gradient-to-r from-teal-800 to-emerald-700 px-4 py-10 text-white"><div className="mx-auto flex max-w-5xl flex-col justify-between gap-6 md:flex-row md:items-center"><div className="flex items-center gap-4"><UserAvatar avatarUrl={circle.avatarUrl} name={circle.name} className="h-20 w-20 rounded-3xl border border-white/20 text-2xl" /><div><div className="flex gap-2 text-[10px] font-bold uppercase text-teal-100"><span>{circle.type}</span>{circle.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{circle.city}</span>}</div><h1 className="text-3xl font-black">{circle.name}</h1><p className="mt-1 max-w-xl text-sm text-teal-100">{circle.description || 'Sin descripción.'}</p></div></div><div className="flex gap-6 rounded-2xl border border-white/15 bg-white/10 px-6 py-3 text-center"><div><b className="block text-xl">{circle.membersCount}</b><span className="text-[11px] text-teal-100">Miembros</span></div><div><b className="block text-xl">{circle.activeNowCount}</b><span className="text-[11px] text-teal-100">Hablando ahora</span></div></div></div></section>

    <main className="mx-auto grid max-w-5xl grid-cols-1 gap-7 px-4 py-8 lg:grid-cols-3"><div className="space-y-5 lg:col-span-2">
      {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{actionError}</p>}
      {circle.isMember ? <PostForm circle={circle} postText={postText} setPostText={setPostText} selectedFile={selectedFile} previewUrl={previewUrl} selectFile={selectFile} fileInputRef={fileInputRef} isSubmitting={isSubmitting} onSubmit={handlePostSubmit} /> : <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-[#0f172a]">Únete al círculo para publicar.</div>}
      {posts.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#0f172a]"><MessageCircle className="mx-auto h-10 w-10 text-teal-400" /><h3 className="mt-2 font-bold">Todavía no hay publicaciones</h3><p className="text-xs text-slate-500">Sé la primera persona en compartir un momento.</p></div> : posts.map(post => <PostCard key={post.postId} post={post} own={user?.userId === post.userId} commentsOpen={Boolean(expandedComments[post.postId])} comments={comments[post.postId] || []} commentText={commentInputs[post.postId] || ''} setCommentText={(value: string) => setCommentInputs(current => ({ ...current, [post.postId]: value }))} onLike={() => toggleLike(post.postId)} onSave={() => toggleSave(post.postId)} onComments={() => toggleComments(post.postId)} onComment={(event: React.FormEvent) => addComment(post.postId, event)} onDelete={() => deletePost(post.postId)} />)}
    </div><aside><div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-[#0f172a]"><h3 className="font-bold">Privacidad</h3><p className="mt-2 text-xs text-slate-500">{circle.visibility === 'PUBLIC' ? 'El contenido de este círculo es público.' : 'Solo miembros autorizados pueden ver este círculo.'}</p></div></aside></main>
  </div>;
}

function PostForm({ circle, postText, setPostText, selectedFile, previewUrl, selectFile, fileInputRef, isSubmitting, onSubmit }: any) {
  return <form onSubmit={onSubmit} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0f172a]"><h2 className="text-xs font-bold uppercase tracking-wide">Publicar en {circle.name}</h2><textarea rows={3} value={postText} onChange={event => setPostText(event.target.value)} placeholder="¿Qué quieres compartir?" className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900" />{selectedFile && <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">{selectedFile.type.startsWith('video/') ? <video src={previewUrl} controls playsInline className="max-h-72 w-full bg-black object-contain" /> : <img src={previewUrl} alt="Vista previa" className="max-h-72 w-full object-contain" />}<button type="button" aria-label="Quitar archivo" onClick={() => selectFile()} className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white"><X className="h-4 w-4" /></button><p className="p-2 text-xs text-slate-500">{selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p></div>}<div className="flex justify-between"><input ref={fileInputRef} hidden type="file" accept="image/*,video/*" onChange={event => selectFile(event.target.files?.[0])} /><button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-300"><ImageIcon className="h-4 w-4" />Foto/Video</button><button disabled={isSubmitting || (!postText.trim() && !selectedFile)} className="flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />{isSubmitting ? 'Publicando…' : 'Publicar'}</button></div></form>;
}

function PostCard({ post, own, commentsOpen, comments, commentText, setCommentText, onLike, onSave, onComments, onComment, onDelete }: any) {
  return <article className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0f172a]"><header className="flex justify-between"><div className="flex items-center gap-3"><UserAvatar avatarUrl={post.avatarUrl} name={post.displayName || post.username} className="h-10 w-10 rounded-full text-xs" /><div><b className="block text-sm">{post.displayName || post.username}</b><span className="text-xs text-slate-500">@{post.username} · {formatLocalTimestamp(post.createdAt)}</span></div></div>{own && <button aria-label="Eliminar publicación" onClick={onDelete} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}</header>{post.caption && <p className="whitespace-pre-wrap text-sm">{post.caption}</p>}{post.mediaUrls?.map((url: string, index: number) => post.mediaTypes?.[index] === 'VIDEO' ? <video key={url} src={url} controls playsInline className="max-h-[32rem] w-full rounded-2xl bg-black object-contain" /> : <img key={url} src={url} alt="Contenido de la publicación" className="max-h-[32rem] w-full rounded-2xl object-contain" />)}<div className="flex flex-wrap gap-5 border-t border-slate-100 pt-3 text-xs font-bold dark:border-slate-800"><button onClick={onLike} className={post.hasLiked ? 'flex items-center gap-1 text-rose-600' : 'flex items-center gap-1 text-slate-500'}><Heart className={`h-4 w-4 ${post.hasLiked ? 'fill-current' : ''}`} />{post.likesCount}</button><button onClick={onComments} className="flex items-center gap-1 text-slate-500"><MessageCircle className="h-4 w-4" />{post.commentsCount}</button><button onClick={onSave} className={post.isSaved ? 'text-teal-700 dark:text-teal-300' : 'text-slate-500'}>{post.isSaved ? 'Guardado' : 'Guardar'}</button></div>{commentsOpen && <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800"><form onSubmit={onComment} className="flex gap-2"><input value={commentText} onChange={event => setCommentText(event.target.value)} placeholder="Escribe un comentario…" className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" /><button className="rounded-xl bg-teal-700 px-3 text-xs font-bold text-white">Enviar</button></form>{comments.map((comment: CommentDto) => <div key={comment.commentId} className="flex gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><UserAvatar avatarUrl={comment.avatarUrl} name={comment.displayName || comment.username} className="h-7 w-7 rounded-full text-[10px]" /><p className="text-xs"><b>@{comment.username}</b><br />{comment.content}</p></div>)}</div>}</article>;
}
