'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import StoryViewer from '@/components/StoryViewer';
import {
  Home, Activity, Bookmark, Calendar, Compass, Plus, Search, Bell,
  User, MessageSquare, Image as ImageIcon, Mic, HelpCircle, Smile,
  MapPin, Play, Pause, ChevronRight, Settings, Users, Sparkles, Check, Share2, Layers, Heart, X, Upload, Sun, Moon
} from 'lucide-react';
import { formatLocalTimestamp } from '@/lib/dateUtils';
import { useTheme } from '@/context/ThemeContext';
import { useCreateHub } from '@/context/CreateHubContext';
import MobileBottomBar from '@/components/MobileBottomBar';
import UserAvatar from '@/components/UserAvatar';
import EcoThread from '@/components/EcoThread';
import { useRealtimeActivity } from '@/context/RealtimeActivityContext';

interface PostData {
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

interface GroupedStory {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  stories: {
    storyId: string;
    mediaType: string;
    mediaUrl: string;
    textContent: string;
    backgroundColor: string;
    musicTitle: string;
    createdAt: string;
  }[];
}

interface SearchResults {
  users: { username: string; displayName: string; avatarUrl: string; bio: string }[];
  circles: { name: string; slug: string; description: string }[];
  posts: { id: string; content: string; authorUsername: string }[];
}

export default function FeedPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { openCreateHub, openStoryComposer } = useCreateHub();
  const { totalUnreadMessages } = useRealtimeActivity();

  const [postsList, setPostsList] = useState<PostData[]>([]);
  const [newMomentText, setNewMomentText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [showMobilePublisherModal, setShowMobilePublisherModal] = useState(false);
  const [failedWebImages, setFailedWebImages] = useState<Record<string, boolean>>({});
  const [failedWebVideos, setFailedWebVideos] = useState<Record<string, boolean>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  const [groupedStories, setGroupedStories] = useState<GroupedStory[]>([]);
  const [activeStoryViewerIndex, setActiveStoryViewerIndex] = useState<number | null>(null);
  const ownStoryIndex = groupedStories.findIndex((group) =>
    (Boolean(user?.userId) && String(group.userId) === String(user?.userId))
    || (
      !user?.userId
      && Boolean(user?.username)
      && group.username?.toLowerCase() === user?.username.toLowerCase()
    )
  );
  const ownStoryGroup = ownStoryIndex >= 0 ? groupedStories[ownStoryIndex] : null;
  const otherStories = groupedStories
    .map((group, originalIndex) => ({ group, originalIndex }))
    .filter(({ originalIndex }) => originalIndex !== ownStoryIndex);

  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [postMenuOpenId, setPostMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedPosts();
    fetchActiveStories();
  }, [user]);

  useEffect(() => {
    const refreshStories = () => fetchActiveStories();
    window.addEventListener('socialtush:story-published', refreshStories);
    return () => window.removeEventListener('socialtush:story-published', refreshStories);
  }, []);

  useEffect(() => {
    const refreshPosts = () => { void fetchFeedPosts(); };
    window.addEventListener('socialtush:post-published', refreshPosts);
    return () => window.removeEventListener('socialtush:post-published', refreshPosts);
  }, []);

  const fetchFeedPosts = async () => {
    setLoadingPosts(true);
    try {
      const res = await api.get('/posts/feed');
      const data = res.data?.posts || res.data?.content || (Array.isArray(res.data) ? res.data : []);
      setPostsList(Array.isArray(data) ? data : []);
    } catch (err) {
      setPostsList([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchActiveStories = async () => {
    try {
      const res = await api.get('/stories/active');
      setGroupedStories(res.data || []);
    } catch (err) {
      setGroupedStories([]);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setShowSearchDropdown(false);
      return;
    }

    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);

    searchDebounceTimer.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/search?query=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data);
        setShowSearchDropdown(true);
      } catch (err) {
        setSearchResults({ users: [], circles: [], posts: [] });
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchQuery]);

  const handlePublishMoment = async () => {
    if (!newMomentText.trim() && !selectedFile) return;
    setIsPublishing(true);

    try {
      const formData = new FormData();
      formData.append('caption', newMomentText);
      if (selectedFile) formData.append('files', selectedFile);

      const res = await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setPostsList(prev => [res.data, ...prev]);
      setNewMomentText('');
      setSelectedFile(null);
      setShowMobilePublisherModal(false);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Error al publicar la entrada';
      console.error('Error al publicar post:', err);
      alert(errorMsg);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      const res = await api.post(`/likes/${postId}`);
      setPostsList(prev => prev.map(p => p.postId === postId ? { ...p, hasLiked: res.data.liked, likesCount: res.data.count } : p));
    } catch (err: any) {
      alert(err.response?.data?.message || 'No se pudo actualizar la resonancia.');
    }
  };

  const handleSavePost = async (postId: string) => {
    try {
      const res = await api.post(`/posts/${postId}/save`);
      setPostsList(prev => prev.map(p => p.postId === postId ? { ...p, isSaved: res.data.saved } : p));
    } catch (err: any) {
      alert(err.response?.data?.message || 'No se pudo actualizar Colecciones.');
    }
  };

  const handleSharePost = async (post: PostData) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Lifonk', text: post.caption || 'Mira esta publicación en Lifonk', url: window.location.href });
      } catch (e) {}
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      alert('¡Enlace copiado al portapapeles!');
    }
  };

  const handleDeletePost = async (postId: string) => {
    setIsDeletingPost(true);
    try {
      await api.delete(`/posts/${postId}`);
      setPostsList(prev => prev.filter(p => p.postId !== postId));
      setDeleteConfirmPostId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'No se pudo eliminar la publicación.');
    } finally {
      setIsDeletingPost(false);
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const incrementCommentCount = (postId: string) => {
    setPostsList(prev => prev.map(post => post.postId === postId
      ? { ...post, commentsCount: (post.commentsCount || 0) + 1 }
      : post));
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] dark:bg-[#090d16] text-slate-800 dark:text-slate-100 flex flex-col font-sans pb-20 md:pb-6">
      <header className="bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
            <div className="h-9 w-9 rounded-xl bg-teal-700 flex items-center justify-center text-white font-black shadow-md shadow-teal-900/30">L</div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">Lifonk</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-50 dark:bg-teal-800/30 text-teal-700 dark:text-teal-400 font-bold text-xs border border-teal-200 dark:border-teal-700/50"><Home className="w-4 h-4" /><span>Ritmo</span></button>
            <Link href="/circles" className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium text-xs transition-all"><Compass className="w-4 h-4" /><span>Círculos</span></Link>
            <button onClick={openCreateHub} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs shadow-md shadow-teal-900/30 transition-all mx-2"><Plus className="w-4 h-4" /><span>Crear</span></button>
            <Link href="/chat" className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium text-xs transition-all relative"><MessageSquare className="w-4 h-4" /><span>Conversaciones</span>{totalUnreadMessages > 0 && <span className="px-1.5 py-0.5 bg-rose-600 text-white font-extrabold text-[10px] rounded-full min-w-[18px] text-center shadow-sm">{totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}</span>}</Link>
            <Link href={user ? `/profile/${user.username}` : '/login'} className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium text-xs transition-all"><User className="w-4 h-4" /><span>Espacio</span></Link>
          </nav>
          <div className="flex items-center gap-3 relative">
            <div className="relative hidden md:block w-64 lg:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Descubrir usuarios, círculos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => searchQuery && setShowSearchDropdown(true)} className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-full text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-teal-600" />
              {showSearchDropdown && searchResults && <><div className="fixed inset-0 z-30" onClick={() => setShowSearchDropdown(false)} /><div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-40 max-h-96 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 p-2">{searchResults.users?.map(u => <div key={u.username} onClick={() => { router.push(`/profile/${u.username}`); setShowSearchDropdown(false); }} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"><UserAvatar avatarUrl={u.avatarUrl} name={u.displayName || u.username} className="w-8 h-8 rounded-full text-xs" /><div><h5 className="font-bold text-xs text-slate-900 dark:text-white">{u.displayName || u.username}</h5><span className="text-[10px] text-teal-400 font-semibold">@{u.username}</span></div></div>)}</div></>}
            </div>
            <button onClick={() => setShowMobileSearch(!showMobileSearch)} className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-white"><Search className="w-5 h-5" /></button>
            <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors" title={theme === 'light' ? 'Usar tema oscuro' : 'Usar tema claro'} aria-label="Cambiar tema">{theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</button>
            <NotificationBell />
            <Link href={user ? `/profile/${user.username}` : '/login'} className="flex items-center gap-2"><div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-700 to-emerald-600 p-[2px]"><UserAvatar avatarUrl={user?.avatarUrl} name={user?.displayName || user?.username} className="w-full h-full rounded-full text-xs" /></div></Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto w-full px-4 md:px-6 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="hidden lg:block lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-teal-800/30 text-teal-400 font-bold text-xs border border-teal-200 dark:border-teal-700/50"><Home className="w-4 h-4 text-teal-400" /><span>Ritmo</span></button>
            <Link href="/circles" className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:bg-slate-800/50 font-semibold text-xs transition-all"><Compass className="w-4 h-4 text-slate-500" /><span>Descubrir círculos</span></Link>
            <Link href="/chat" className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:bg-slate-800/50 font-semibold text-xs transition-all"><MessageSquare className="w-4 h-4 text-slate-500" /><span>Conversaciones</span></Link>
            <Link href={user ? `/profile/${user.username}` : '/login'} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:bg-slate-800/50 font-semibold text-xs transition-all"><User className="w-4 h-4 text-slate-500" /><span>Tu espacio</span></Link>
          </div>
        </aside>

        <main className="lg:col-span-6 space-y-6">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm overflow-x-auto">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0 flex flex-col items-center gap-1.5 group">
                {ownStoryGroup ? <div className="relative"><button type="button" aria-label="Ver tu historia" onClick={() => setActiveStoryViewerIndex(ownStoryIndex)} className="block h-14 w-14 rounded-full bg-gradient-to-tr from-teal-600 via-emerald-500 to-amber-500 p-[2px] shadow-sm transition-transform group-hover:scale-105 md:h-16 md:w-16"><UserAvatar avatarUrl={ownStoryGroup.avatarUrl || user?.avatarUrl} name={ownStoryGroup.displayName || user?.displayName || user?.username || 'Tú'} className="h-full w-full rounded-full text-xs md:text-sm" /></button><button type="button" aria-label="Crear otra historia" onClick={(event) => { event.stopPropagation(); openStoryComposer(); }} className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-teal-700 text-white shadow-md transition-colors hover:bg-teal-600 dark:border-[#0f172a]"><Plus className="h-3.5 w-3.5 stroke-[3]" /></button></div> : <button type="button" aria-label="Crear tu historia" onClick={openStoryComposer} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-teal-500 bg-teal-50 text-teal-700 shadow-sm transition-all hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-400 dark:hover:bg-teal-900/60 md:h-16 md:w-16"><Plus className="h-5 w-5 stroke-[2.5]" /></button>}
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Tu momento</span>
              </div>
              {otherStories.map(({ group: gs, originalIndex }) => <div key={gs.userId || originalIndex} onClick={() => setActiveStoryViewerIndex(originalIndex)} className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer group"><div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-tr from-teal-600 via-emerald-500 to-amber-500 p-[2px] shadow-sm group-hover:scale-105 transition-transform"><UserAvatar avatarUrl={gs.avatarUrl} name={gs.displayName} className="w-full h-full rounded-full text-xs md:text-sm" /></div><span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[64px]">{gs.displayName}</span></div>)}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-6 shadow-sm space-y-3">
            <h3 className="hidden md:block text-sm font-extrabold text-slate-900 dark:text-white">Crear un momento</h3>
            <div className="space-y-3">
              <input type="text" placeholder="¿Qué quieres compartir hoy?..." value={newMomentText} onChange={(e) => setNewMomentText(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-[#090d16] border border-slate-200 dark:border-slate-800 rounded-2xl text-xs md:text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-teal-600" />
              {selectedFile && <div className="flex items-center justify-between p-2.5 bg-teal-950/40 border border-teal-800/60 rounded-xl text-xs text-teal-300 font-semibold"><span className="truncate max-w-xs">{selectedFile.type.startsWith('video/') ? '🎬' : '📷'} {selectedFile.name}</span><button onClick={() => setSelectedFile(null)} className="p-1 text-slate-400 hover:text-rose-400"><X className="w-4 h-4" /></button></div>}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-all border border-slate-200 dark:border-slate-800"><ImageIcon className="w-4 h-4 text-emerald-400" /><span>Foto/Video</span><input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} accept="image/*,video/*" className="hidden" /></label>
                <button onClick={handlePublishMoment} disabled={isPublishing || (!newMomentText.trim() && !selectedFile)} className="px-6 py-2 bg-teal-700 text-white font-bold text-xs rounded-xl hover:bg-teal-600 shadow-md shadow-teal-900/30 disabled:opacity-50 transition-all">{isPublishing ? 'Contribuyendo...' : 'Contribuir'}</button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {postsList.map(post => {
              const firstMediaUrl = post.mediaUrls?.[0] || '';
              const mediaType = post.mediaTypes?.[0]?.toUpperCase() || '';
              const isVideo = Boolean(post.isShortVideo) || mediaType.includes('VIDEO') || /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(firstMediaUrl);
              return (
                <div key={post.postId} className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 md:p-6 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <Link href={`/profile/${post.username}`} className="flex items-center gap-3 group"><UserAvatar avatarUrl={post.avatarUrl} name={post.displayName || post.username} className="w-10 h-10 rounded-full text-xs shadow-sm group-hover:scale-105 transition-transform border border-teal-600/40" /><div><h5 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{post.displayName || post.username}</h5><span className="text-[10px] text-slate-400 font-medium">@{post.username}</span></div></Link>
                    <div className="flex items-center gap-1.5"><span className="text-[10px] text-slate-500 font-semibold">{formatLocalTimestamp(post.createdAt)}</span>{user && post.userId && user.userId === post.userId && <div className="relative"><button onClick={() => setPostMenuOpenId(postMenuOpenId === post.postId ? null : post.postId)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-bold text-base leading-none" aria-label="Opciones">···</button>{postMenuOpenId === post.postId && <><div className="fixed inset-0 z-40" onClick={() => setPostMenuOpenId(null)} /><div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden"><button onClick={() => { setDeleteConfirmPostId(post.postId); setPostMenuOpenId(null); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-rose-400 hover:bg-rose-500/10 text-sm font-semibold transition-colors">Eliminar publicación</button></div></>}</div>}</div>
                  </div>
                  {post.caption ? <p className="text-sm text-slate-700 dark:text-slate-200 font-normal leading-relaxed">{post.caption}</p> : null}
                  {firstMediaUrl ? (
                    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black">
                      {isVideo ? (
                        failedWebVideos[firstMediaUrl] ? (
                          <div className="flex min-h-[240px] w-full flex-col items-center justify-center gap-3 bg-black text-slate-300"><Play className="h-10 w-10" /><span className="text-xs font-semibold">Este video no pudo cargarse</span></div>
                        ) : (
                          <>
                            <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">{post.isShortVideo ? 'Pulso' : 'Video'}</span>
                            <video
                              key={firstMediaUrl}
                              src={firstMediaUrl}
                              controls
                              playsInline
                              preload="auto"
                              onError={() => setFailedWebVideos(prev => ({ ...prev, [firstMediaUrl]: true }))}
                              className="block min-h-[220px] max-h-[72vh] w-full bg-black object-contain"
                            >
                              Tu navegador no puede reproducir este video.
                            </video>
                          </>
                        )
                      ) : failedWebImages[firstMediaUrl] ? (
                        <div className="flex h-40 w-full flex-col items-center justify-center gap-2 text-slate-400"><ImageIcon className="h-8 w-8 stroke-[1.5]" /><span className="text-xs font-semibold">No se pudo cargar el archivo multimedia</span></div>
                      ) : (
                        <img src={firstMediaUrl} alt="Media" onError={() => setFailedWebImages(prev => ({ ...prev, [firstMediaUrl]: true }))} className="max-h-[70vh] w-full object-contain" />
                      )}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    <div className="flex items-center gap-6"><button onClick={() => handleToggleLike(post.postId)} className={`flex items-center gap-1.5 hover:text-rose-500 transition-colors ${post.hasLiked ? 'text-rose-500 font-bold' : ''}`}><Heart className={`w-4 h-4 ${post.hasLiked ? 'fill-current text-rose-500' : ''}`} /><span>{post.likesCount}</span></button><button onClick={() => toggleComments(post.postId)} className="flex items-center gap-1.5 hover:text-teal-400 transition-colors cursor-pointer"><MessageSquare className="w-4 h-4" /><span>{post.commentsCount}</span></button><button onClick={() => handleSharePost(post)} className="flex items-center gap-1.5 hover:text-teal-400 transition-colors cursor-pointer"><Share2 className="w-4 h-4" /></button></div>
                    <button onClick={() => handleSavePost(post.postId)} className="hover:text-teal-400 transition-colors" aria-label={post.isSaved ? 'Retirar de colección' : 'Coleccionar contribución'}><Bookmark className={`w-4 h-4 ${post.isSaved ? 'fill-current text-teal-400' : ''}`} /></button>
                  </div>
                  {expandedComments[post.postId] && <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80"><EcoThread postId={post.postId} onCommentAdded={() => incrementCommentCount(post.postId)} /></div>}
                </div>
              );
            })}
            {postsList.length === 0 && !loadingPosts && <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500 dark:text-slate-400 space-y-2"><Sparkles className="w-8 h-8 mx-auto text-teal-400" /><p className="text-sm font-bold text-slate-900 dark:text-white">Tu Ritmo está tranquilo.</p><p className="text-xs text-slate-500 dark:text-slate-400">Conecta con personas o crea una contribución.</p></div>}
          </div>
        </main>

        <aside className="hidden lg:block lg:col-span-3 space-y-6"><div className="bg-white dark:bg-gradient-to-br dark:from-teal-950 dark:to-slate-900 border border-slate-200 dark:border-teal-800/60 rounded-3xl p-6 text-slate-900 dark:text-white shadow-sm space-y-4"><div className="flex items-center gap-4"><UserAvatar avatarUrl={user?.avatarUrl} name={user?.displayName || user?.username} className="w-14 h-14 rounded-2xl text-xl border border-teal-600/40" /><div><h4 className="font-extrabold text-base leading-tight">{user?.displayName || user?.username}</h4><span className="text-xs text-teal-300 font-medium">@{user?.username}</span></div></div><Link href={`/profile/${user?.username}`} className="block w-full py-2.5 bg-teal-700 text-white font-bold text-xs text-center rounded-xl hover:bg-teal-600 transition-all shadow-md">Ver tu espacio</Link></div></aside>
      </div>

      <MobileBottomBar />
      {deleteConfirmPostId && <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4" onClick={() => !isDeletingPost && setDeleteConfirmPostId(null)}><div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}><h3 className="font-bold text-slate-900 dark:text-white text-base">Eliminar contribución</h3><p className="text-sm text-slate-400">¿Seguro que quieres eliminar esta contribución? Esta acción no se puede deshacer.</p><div className="flex gap-3 pt-1"><button onClick={() => setDeleteConfirmPostId(null)} disabled={isDeletingPost} className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancelar</button><button onClick={() => handleDeletePost(deleteConfirmPostId)} disabled={isDeletingPost} className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-500 disabled:opacity-60 transition-colors">{isDeletingPost ? 'Eliminando...' : 'Eliminar'}</button></div></div></div>}
      {activeStoryViewerIndex !== null && <StoryViewer groupedStories={groupedStories} initialUserIndex={activeStoryViewerIndex} onClose={() => setActiveStoryViewerIndex(null)} onStoriesChange={setGroupedStories} />}
    </div>
  );
}
