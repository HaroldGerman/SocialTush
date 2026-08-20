'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Heart, MessageCircle } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { api } from '@/context/AuthContext';
import { formatLocalTimestamp } from '@/lib/dateUtils';

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const [post, setPost] = useState<any>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = async () => { setLoading(true); try { const res = await api.get(`/posts/${postId}`); setPost(res.data); setError(''); } catch (requestError: any) { console.error(requestError); setError(requestError.response?.status === 403 ? 'No tienes acceso a esta publicación.' : requestError.response?.status === 404 ? 'Publicación no encontrada.' : 'No se pudo cargar la publicación.'); } finally { setLoading(false); } };
  useEffect(() => { if (postId) void load(); }, [postId]);
  const like = async () => { try { const res = await api.post(`/likes/${postId}`); setPost((old: any) => ({ ...old, hasLiked: res.data.liked, likesCount: res.data.count })); } catch (requestError) { console.error(requestError); setError('No se pudo actualizar el Me gusta.'); } };
  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#090d16]">Cargando…</main>;
  return <main className="min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-[#090d16] dark:text-white"><div className="mx-auto max-w-xl"><button onClick={() => router.back()} className="mb-4 rounded-full border border-slate-200 p-2 dark:border-slate-700"><ArrowLeft className="h-5 w-5"/></button>{error && !post ? <section className="rounded-2xl bg-white p-8 text-center dark:bg-slate-900"><p>{error}</p><button onClick={() => void load()} className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white">Reintentar</button></section> : post && <article className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><header className="flex items-center gap-3"><Link href={`/profile/${post.username}`}><UserAvatar avatarUrl={post.avatarUrl} name={post.displayName || post.username} className="h-10 w-10 rounded-full text-xs"/></Link><div><Link href={`/profile/${post.username}`} className="text-sm font-bold">{post.displayName || post.username}</Link><p className="text-xs text-slate-500">@{post.username} · {formatLocalTimestamp(post.createdAt)}</p></div></header>{post.caption && <p className="whitespace-pre-wrap text-sm">{post.caption}</p>}{post.mediaUrls?.map((url: string, index: number) => post.mediaTypes?.[index] === 'VIDEO' ? <video key={url} src={url} controls playsInline className="max-h-[70dvh] w-full rounded-2xl bg-black object-contain"/> : <img key={url} src={url} alt="Contenido de la publicación" className="max-h-[70dvh] w-full rounded-2xl object-contain"/>)}<footer className="flex gap-5 border-t border-slate-100 pt-3 dark:border-slate-800"><button onClick={() => void like()} className={post.hasLiked ? 'flex items-center gap-1 text-rose-600' : 'flex items-center gap-1 text-slate-500'}><Heart className={`h-4 w-4 ${post.hasLiked ? 'fill-current' : ''}`}/>{post.likesCount}</button><Link href={`/post/${postId}#comments`} className="flex items-center gap-1 text-slate-500"><MessageCircle className="h-4 w-4"/>{post.commentsCount}</Link></footer>{error && <p className="text-xs text-rose-600">{error}</p>}</article>}</div></main>;
}
