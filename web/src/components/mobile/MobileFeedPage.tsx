'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Heart, Image as ImageIcon, MessageCircle, Plus, Search, Share2, Sparkles, X } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import { useCreateHub } from '@/context/CreateHubContext';
import StoryViewer from '@/components/StoryViewer';
import DailyQuestionCard from '@/components/DailyQuestionCard';
import MobileBottomBar from '@/components/MobileBottomBar';
import UserAvatar from '@/components/UserAvatar';
import NotificationBell from '@/components/NotificationBell';
import { formatLocalTimestamp } from '@/lib/dateUtils';

interface PostData {
  postId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  caption: string;
  mediaUrls: string[];
  likesCount: number;
  commentsCount: number;
  hasLiked: boolean;
  isSaved?: boolean;
  createdAt: string;
}

interface StoryData {
  storyId: string;
  mediaType: string;
  mediaUrl: string;
  textContent: string;
  backgroundColor: string;
  musicTitle: string;
  overlayData?: string;
  viewedByMe?: boolean;
  createdAt: string;
}

interface StoryGroup {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  hasUnseenStories?: boolean;
  stories: StoryData[];
}

interface SearchResultUser {
  username: string;
  displayName: string;
  avatarUrl: string;
}

export default function MobileFeedPage() {
  const { user } = useAuth();
  const { openCreateHub, openStoryComposer } = useCreateHub();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const loadPosts = async () => {
    try {
      const response = await api.get('/posts/feed');
      const data = response.data?.posts || response.data?.content || (Array.isArray(response.data) ? response.data : []);
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
    }
  };

  const loadStories = async () => {
    try {
      const response = await api.get('/stories/active');
      setStories(response.data || []);
    } catch {
      setStories([]);
    }
  };

  useEffect(() => {
    if (!user) return;
    Promise.all([loadPosts(), loadStories()]).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    const storyPublished = () => void loadStories();
    const postPublished = () => void loadPosts();
    window.addEventListener('socialtush:story-published', storyPublished);
    window.addEventListener('socialtush:post-published', postPublished);
    return () => {
      window.removeEventListener('socialtush:story-published', storyPublished);
      window.removeEventListener('socialtush:post-published', postPublished);
    };
  }, []);

  useEffect(() => {
    if (!searchOpen || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.get(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(response.data?.users || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchOpen, searchQuery]);

  const ownStoryIndex = stories.findIndex(group =>
    (user?.userId && String(group.userId) === String(user.userId))
    || (user?.username && group.username?.toLowerCase() === user.username.toLowerCase())
  );
  const ownStory = ownStoryIndex >= 0 ? stories[ownStoryIndex] : null;
  const others = stories.map((group, index) => ({ group, index })).filter(item => item.index !== ownStoryIndex);

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

  const sharePost = async (post: PostData) => {
    try {
      if (navigator.share) await navigator.share({ title: 'Lifonk', text: post.caption || 'Mira esto en Lifonk', url: `${location.origin}/post/${post.postId}` });
      else await navigator.clipboard.writeText(`${location.origin}/post/${post.postId}`);
    } catch {}
  };

  const toggleComments = async (postId: string) => {
    const next = !expandedComments[postId];
    setExpandedComments(previous => ({ ...previous, [postId]: next }));
    if (next && !comments[postId]) {
      try {
        const response = await api.get(`/comments/${postId}`);
        setComments(previous => ({ ...previous, [postId]: response.data || [] }));
      } catch {
        setComments(previous => ({ ...previous, [postId]: [] }));
      }
    }
  };

  const addComment = async (postId: string) => {
    const value = commentDrafts[postId]?.trim();
    if (!value) return;
    try {
      const response = await api.post(`/comments/${postId}`, { content: value });
      setComments(previous => ({ ...previous, [postId]: [...(previous[postId] || []), response.data] }));
      setCommentDrafts(previous => ({ ...previous, [postId]: '' }));
      setPosts(previous => previous.map(post => post.postId === postId ? { ...post, commentsCount: (post.commentsCount || 0) + 1 } : post));
    } catch {}
  };

  return (
    <div className="min-h-[100dvh] bg-[#f4f7f7] pb-24 text-slate-900 dark:bg-[#07151d] dark:text-white">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 pb-3 pt-[calc(.7rem+env(safe-area-inset-top))] backdrop-blur-xl dark:border-slate-800 dark:bg-[#0f172a]/95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-700 text-lg font-black text-white shadow-sm">L</div><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-600 dark:text-teal-400">Lifonk</p><h1 className="text-lg font-black leading-none">Ritmo</h1></div></div>
          <div className="flex items-center gap-1"><button aria-label="Buscar" onClick={() => setSearchOpen(value => !value)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300"><Search className="h-5 w-5"/></button><NotificationBell /></div>
        </div>
        {searchOpen && <div className="mt-3"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} autoFocus placeholder="Buscar personas" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-10 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-[#07151d]"/>{searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-slate-400"/></button>}</div>{searching && <p className="px-2 py-3 text-xs text-slate-400">Buscando…</p>}{Boolean(searchQuery.trim()) && !searching && <div className="mt-2 max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-[#0f172a]">{searchResults.map(result => <Link key={result.username} href={`/profile/${result.username}`} className="flex items-center gap-3 rounded-xl p-2.5" onClick={() => setSearchOpen(false)}><UserAvatar avatarUrl={result.avatarUrl} name={result.displayName || result.username} className="h-9 w-9 rounded-full text-xs"/><div><p className="text-sm font-bold">{result.displayName || result.username}</p><p className="text-[10px] text-teal-500">@{result.username}</p></div></Link>)}{!searchResults.length && <p className="p-4 text-center text-xs text-slate-400">Sin resultados</p>}</div>}</div>}
      </header>

      <main className="mx-auto w-full max-w-xl space-y-4 px-3 py-4">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white py-3 shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-3">
            <div className="flex w-[66px] shrink-0 flex-col items-center gap-1.5">
              <div className="relative">
                {ownStory ? <button onClick={() => setStoryIndex(ownStoryIndex)} className="h-15 w-15 rounded-full bg-gradient-to-tr from-teal-600 via-emerald-500 to-cyan-400 p-[2px]"><UserAvatar avatarUrl={ownStory.avatarUrl || user?.avatarUrl} name={ownStory.displayName || user?.displayName || user?.username} className="h-full w-full rounded-full text-xs"/></button> : <button onClick={openStoryComposer} className="flex h-15 w-15 items-center justify-center rounded-full border-2 border-dashed border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400"><Plus className="h-5 w-5"/></button>}
                {ownStory && <button onClick={openStoryComposer} className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-teal-700 text-white dark:border-[#0f172a]"><Plus className="h-3.5 w-3.5"/></button>}
              </div>
              <span className="w-full truncate text-center text-[10px] font-bold">Tú</span>
            </div>

            {others.map(({ group, index }) => {
              const unseen = group.hasUnseenStories ?? group.stories.some(story => !story.viewedByMe);
              return <button key={group.userId || group.username} onClick={() => setStoryIndex(index)} className="relative flex w-[66px] shrink-0 flex-col items-center gap-1.5">
                <div className={`relative h-15 w-15 rounded-full p-[2.5px] transition ${unseen ? 'bg-gradient-to-tr from-teal-600 via-emerald-400 to-cyan-400 shadow-[0_0_0_1px_rgba(20,184,166,.12)]' : 'bg-slate-300 dark:bg-slate-700 opacity-75'}`}>
                  <UserAvatar avatarUrl={group.avatarUrl} name={group.displayName} className="h-full w-full rounded-full border-2 border-white text-xs dark:border-[#0f172a]"/>
                  {unseen && <span className="absolute -right-0.5 top-0 h-3 w-3 rounded-full border-2 border-white bg-teal-500 dark:border-[#0f172a]"/>}
                </div>
                <span className={`w-full truncate text-center text-[10px] font-bold ${unseen ? 'text-slate-800 dark:text-white' : 'text-slate-400'}`}>{group.displayName}</span>
                {unseen && <span className="absolute -bottom-2 text-[8px] font-black uppercase tracking-wide text-teal-600 dark:text-teal-400">Nuevo</span>}
              </button>;
            })}
          </div>
        </section>

        <DailyQuestionCard onPublished={(post) => setPosts(previous => [post, ...previous])} />

        <button onClick={openCreateHub} className="flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white p-3 text-left shadow-sm dark:border-slate-800 dark:bg-[#0f172a]"><UserAvatar avatarUrl={user?.avatarUrl} name={user?.displayName || user?.username} className="h-10 w-10 rounded-full text-xs"/><span className="flex-1 text-sm text-slate-400">¿Qué quieres compartir?</span><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400"><Plus className="h-4 w-4"/></div></button>

        {loading ? <div className="flex h-44 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"/></div> : <section className="space-y-4">{posts.map(post => <article key={post.postId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
          <div className="flex items-center justify-between p-4 pb-3"><Link href={`/profile/${post.username}`} className="flex min-w-0 items-center gap-3"><UserAvatar avatarUrl={post.avatarUrl} name={post.displayName || post.username} className="h-10 w-10 rounded-full text-xs"/><div className="min-w-0"><p className="truncate text-sm font-extrabold">{post.displayName || post.username}</p><p className="text-[10px] text-slate-400">@{post.username} · {formatLocalTimestamp(post.createdAt)}</p></div></Link></div>
          {post.caption && <p className="whitespace-pre-wrap px-4 pb-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{post.caption}</p>}
          {post.mediaUrls?.[0] && (failedImages[post.mediaUrls[0]] ? <div className="flex h-48 items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-900"><ImageIcon className="h-7 w-7"/></div> : <img src={post.mediaUrls[0]} alt="Publicación" onError={() => setFailedImages(previous => ({ ...previous, [post.mediaUrls[0]]: true }))} className="max-h-[520px] w-full object-cover"/>)}
          <div className="flex items-center justify-between px-4 py-3"><div className="flex items-center gap-5"><button onClick={() => void toggleLike(post.postId)} className={`flex items-center gap-1.5 text-xs font-bold ${post.hasLiked ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}><Heart className={`h-5 w-5 ${post.hasLiked ? 'fill-current' : ''}`}/><span>{post.likesCount || 0}</span></button><button onClick={() => void toggleComments(post.postId)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400"><MessageCircle className="h-5 w-5"/><span>{post.commentsCount || 0}</span></button><button onClick={() => void sharePost(post)} className="text-slate-500 dark:text-slate-400"><Share2 className="h-5 w-5"/></button></div><button onClick={() => void toggleSave(post.postId)} className={post.isSaved ? 'text-teal-600' : 'text-slate-500 dark:text-slate-400'}><Bookmark className={`h-5 w-5 ${post.isSaved ? 'fill-current' : ''}`}/></button></div>
          {expandedComments[post.postId] && <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800"><div className="mb-3 flex gap-2"><input value={commentDrafts[post.postId] || ''} onChange={event => setCommentDrafts(previous => ({ ...previous, [post.postId]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void addComment(post.postId); } }} placeholder="Escribe un eco…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-[#07151d]"/><button onClick={() => void addComment(post.postId)} className="rounded-xl bg-teal-700 px-3 text-xs font-bold text-white">Enviar</button></div><div className="space-y-2">{(comments[post.postId] || []).map((comment: any, index: number) => <div key={comment.commentId || index} className="rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-900/60"><p className="mb-0.5 font-black text-teal-600 dark:text-teal-400">@{comment.authorUsername || comment.username || 'usuario'}</p><p>{comment.content || comment.text}</p></div>)}{comments[post.postId]?.length === 0 && <p className="py-2 text-center text-xs text-slate-400">Sé el primero en responder.</p>}</div></div>}
        </article>)}{!posts.length && <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#0f172a]"><Sparkles className="mx-auto mb-3 h-7 w-7 text-teal-500"/><p className="font-black">Tu Ritmo está tranquilo</p><p className="mt-1 text-xs text-slate-400">Responde la pregunta del día o crea una contribución.</p></div>}</section>}
      </main>

      <MobileBottomBar />

      {storyIndex !== null && <StoryViewer groupedStories={stories} initialUserIndex={storyIndex} onStoriesChange={setStories} onClose={() => { setStoryIndex(null); void loadStories(); }} />}
    </div>
  );
}
