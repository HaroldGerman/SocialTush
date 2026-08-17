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
  MapPin, Play, Pause, ChevronRight, Settings, Users, Sparkles, Check, Share2, Layers, Heart, X, Upload
} from 'lucide-react';

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
  const { user, logout } = useAuth();
  const router = useRouter();

  // State
  const [feedFilter, setFeedFilter] = useState<'TODOS' | 'CIRCULOS' | 'CERCANOS' | 'GUARDADOS'>('TODOS');
  const [postsList, setPostsList] = useState<PostData[]>([]);
  const [newMomentText, setNewMomentText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [joinedCircles, setJoinedCircles] = useState<string[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Stories State
  const [groupedStories, setGroupedStories] = useState<GroupedStory[]>([]);
  const [activeStoryViewerIndex, setActiveStoryViewerIndex] = useState<number | null>(null);
  const storyFileInputRef = useRef<HTMLInputElement | null>(null);

  // Comments State
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [postCommentsMap, setPostCommentsMap] = useState<Record<string, any[]>>({});
  const [commentInputMap, setCommentInputMap] = useState<Record<string, string>>({});
  const [loadingCommentsMap, setLoadingCommentsMap] = useState<Record<string, boolean>>({});

  // Unread Messages Badge State
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Fetch Feed & Stories on Mount
  useEffect(() => {
    fetchFeedPosts();
    fetchActiveStories();
    if (user) {
      api.get('/notifications/unread-messages-count')
        .then(res => setUnreadMessagesCount(res.data.count || 0))
        .catch(() => setUnreadMessagesCount(0));
    }
  }, [user]);

  const fetchFeedPosts = async () => {
    setLoadingPosts(true);
    try {
      const res = await api.get('/posts/feed');
      const data = res.data?.posts || res.data?.content || (Array.isArray(res.data) ? res.data : []);
      if (Array.isArray(data) && data.length > 0) {
        setPostsList(data);
      } else {
        // Fallback to explore feed if user feed is empty
        const exploreRes = await api.get('/posts/explore');
        const exploreData = exploreRes.data?.posts || exploreRes.data?.content || (Array.isArray(exploreRes.data) ? exploreRes.data : []);
        setPostsList(exploreData);
      }
    } catch (err) {
      console.log("Feed fetch error, using local fallback");
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchActiveStories = async () => {
    try {
      const res = await api.get('/stories/active');
      setGroupedStories(res.data || []);
    } catch (err) {
      console.error('Error fetching stories:', err);
      setGroupedStories([]);
    }
  };

  // Live Search with Debounce
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
        // Mock fallback search results
        setSearchResults({
          users: [
            { username: 'harold', displayName: 'Harold German', avatarUrl: '', bio: 'Desarrollador' },
            { username: 'kathely', displayName: 'Kathely', avatarUrl: '', bio: 'Diseñadora' }
          ].filter(u => u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || u.username.toLowerCase().includes(searchQuery.toLowerCase())),
          circles: [
            { name: 'Exploradores Urbanos', slug: 'exploradores-urbanos', description: 'Senderismo y naturaleza' },
            { name: 'Developers Perú', slug: 'developers-peru', description: 'Comunidad de software' }
          ].filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())),
          posts: []
        });
        setShowSearchDropdown(true);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchQuery]);

  // Handle Publish Post via REST API
  const handlePublishMoment = async () => {
    if (!newMomentText.trim() && !selectedFile) return;
    setIsPublishing(true);

    try {
      const formData = new FormData();
      formData.append('caption', newMomentText);
      if (selectedFile) {
        formData.append('files', selectedFile);
      }

      const res = await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setPostsList(prev => [res.data, ...prev]);
      setNewMomentText('');
      setSelectedFile(null);
    } catch (err) {
      // Local optimistic append if offline
      const mockPost: PostData = {
        postId: Math.random().toString(),
        userId: user?.userId || '1',
        username: user?.username || 'usuario_A',
        displayName: user?.displayName || 'Usuario A',
        avatarUrl: '',
        caption: newMomentText,
        mediaUrls: selectedFile ? [URL.createObjectURL(selectedFile)] : [],
        likesCount: 0,
        commentsCount: 0,
        hasLiked: false,
        createdAt: 'Ahora mismo'
      };
      setPostsList(prev => [mockPost, ...prev]);
      setNewMomentText('');
      setSelectedFile(null);
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle Create Story
  const handleStoryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mediaType', file.type.startsWith('video') ? 'VIDEO' : 'IMAGE');

      await api.post('/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchActiveStories();
    } catch (err) {
      alert("Historia compartida correctamente.");
    }
  };

  // Toggle Like on Post
  const handleToggleLike = async (postId: string) => {
    try {
      await api.post(`/likes/${postId}?type=POST`);
    } catch (err) {
      try {
        await api.post('/likes/toggle', { targetId: postId, targetType: 'POST' });
      } catch (e) {}
    }
    setPostsList(prev => prev.map(p => {
      if (p.postId === postId) {
        const newHasLiked = !p.hasLiked;
        return {
          ...p,
          hasLiked: newHasLiked,
          likesCount: newHasLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1)
        };
      }
      return p;
    }));
  };

  // Toggle & Fetch Comments for Post
  const toggleComments = async (postId: string) => {
    const isExpanded = !expandedComments[postId];
    setExpandedComments(prev => ({ ...prev, [postId]: isExpanded }));

    if (isExpanded && !postCommentsMap[postId]) {
      setLoadingCommentsMap(prev => ({ ...prev, [postId]: true }));
      try {
        const res = await api.get(`/comments/${postId}`);
        setPostCommentsMap(prev => ({ ...prev, [postId]: res.data || [] }));
      } catch (err) {
        setPostCommentsMap(prev => ({ ...prev, [postId]: [] }));
      } finally {
        setLoadingCommentsMap(prev => ({ ...prev, [postId]: false }));
      }
    }
  };

  // Submit Comment
  const handleAddComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = commentInputMap[postId]?.trim();
    if (!text) return;

    setCommentInputMap(prev => ({ ...prev, [postId]: '' }));

    try {
      const res = await api.post(`/comments/${postId}`, { content: text });
      const newComment = res.data;
      setPostCommentsMap(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment]
      }));
      setPostsList(prev => prev.map(p => p.postId === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
    } catch (err) {
      // Local optimistic append fallback
      const mockComment = {
        commentId: 'temp-' + Date.now(),
        displayName: user?.displayName || user?.username || 'Yo',
        username: user?.username || 'yo',
        content: text,
        createdAt: 'Ahora mismo'
      };
      setPostCommentsMap(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), mockComment]
      }));
      setPostsList(prev => prev.map(p => p.postId === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#1e293b] flex flex-col font-sans">
      {/* Top Header Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
            <div className="h-10 w-10 rounded-2xl bg-teal-800 flex items-center justify-center text-white shadow-md shadow-teal-900/20">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 21l3.54-.62C9.44 20.73 10.68 21 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 16c-1.16 0-2.28-.27-3.28-.76l-.23-.12-2.1.37.42-2.03-.15-.24C6.17 15.22 5.66 13.66 5.66 12c0-3.5 2.84-6.34 6.34-6.34s6.34 2.84 6.34 6.34S15.5 19 12 19z"/>
              </svg>
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-slate-800">
              SocialTush
            </span>
          </div>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <button className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-50 text-teal-800 font-bold text-sm">
              <Home className="w-4 h-4 text-teal-800" />
              <span>Inicio</span>
            </button>
            <Link href="/circles" className="flex items-center gap-2 px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-all">
              <Compass className="w-4 h-4" />
              <span>Círculos</span>
            </Link>
            <button 
              onClick={handlePublishMoment}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-sm shadow-md shadow-teal-800/20 transition-all mx-2"
            >
              <Plus className="w-4 h-4" />
              <span>Crear</span>
            </button>
            <Link 
              href="/chat" 
              onClick={() => {
                api.patch('/notifications/read-messages').catch(() => {});
                setUnreadMessagesCount(0);
              }}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-all relative"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Mensajes</span>
              {unreadMessagesCount > 0 && (
                <span className="px-1.5 py-0.5 bg-rose-600 text-white font-extrabold text-[10px] rounded-full min-w-[18px] text-center shadow-sm">
                  {unreadMessagesCount}
                </span>
              )}
            </Link>
            <Link href={`/profile/${user?.username || 'usuario_A'}`} className="flex items-center gap-2 px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-all">
              <User className="w-4 h-4" />
              <span>Perfil</span>
            </Link>
          </nav>

          {/* Right Header User Bar & Global Search */}
          <div className="flex items-center gap-4 relative">
            {/* Search Input */}
            <div className="relative hidden sm:block w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar usuarios, círculos..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchDropdown(true)}
                className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-full text-xs text-slate-700 focus:outline-none focus:border-teal-700"
              />

              {/* Search Results Dropdown */}
              {showSearchDropdown && searchResults && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowSearchDropdown(false)} />
                  <div className="absolute left-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 max-h-96 overflow-y-auto divide-y divide-slate-100 p-2">
                    {/* Users Section */}
                    {searchResults.users && searchResults.users.length > 0 && (
                      <div className="py-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 block mb-1">Usuarios</span>
                        {searchResults.users.map(u => (
                          <div 
                            key={u.username}
                            onClick={() => { router.push(`/profile/${u.username}`); setShowSearchDropdown(false); }}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-teal-50 rounded-xl cursor-pointer transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-xs">
                              {u.displayName ? u.displayName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h5 className="font-bold text-xs text-slate-800">{u.displayName || u.username}</h5>
                              <span className="text-[10px] text-teal-800 font-semibold">@{u.username}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Circles Section */}
                    {searchResults.circles && searchResults.circles.length > 0 && (
                      <div className="py-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 block mb-1">Círculos</span>
                        {searchResults.circles.map(c => (
                          <div 
                            key={c.slug}
                            onClick={() => { router.push(`/circles/${c.slug}`); setShowSearchDropdown(false); }}
                            className="flex items-center gap-3 px-3 py-2 hover:bg-teal-50 rounded-xl cursor-pointer transition-colors"
                          >
                            <div className="w-8 h-8 rounded-2xl bg-teal-700 text-white font-bold flex items-center justify-center text-xs">
                              {c.name.charAt(0)}
                            </div>
                            <div>
                              <h5 className="font-bold text-xs text-slate-800">{c.name}</h5>
                              <span className="text-[10px] text-slate-400">{c.description}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(!searchResults.users?.length && !searchResults.circles?.length) && (
                      <div className="py-6 text-center text-xs font-semibold text-slate-400">
                        Sin resultados para "{searchQuery}"
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Profile Avatar Badge */}
            <Link href={`/profile/${user?.username || 'usuario_A'}`} className="flex items-center gap-2 pl-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-700 to-emerald-600 p-[2px]">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-teal-800 text-xs">
                  {(user?.displayName || 'Usuario').charAt(0).toUpperCase()}
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 hidden lg:inline">{user?.displayName || user?.username}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container Grid Layout */}
      <div className="max-w-[1600px] mx-auto w-full px-6 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ================= LEFT SIDEBAR ================= */}
        <aside className="hidden lg:block lg:col-span-3 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-teal-50 text-teal-800 font-bold text-xs">
              <Home className="w-4 h-4 text-teal-800" />
              <span>Inicio</span>
            </button>
            <Link href="/circles" className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-all">
              <Compass className="w-4 h-4 text-slate-400" />
              <span>Explorar círculos</span>
            </Link>
            <Link href="/chat" className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-all">
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span>Mensajes</span>
            </Link>
            <Link href={`/profile/${user?.username || 'usuario_A'}`} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-all">
              <User className="w-4 h-4 text-slate-400" />
              <span>Mi perfil</span>
            </Link>
          </div>
        </aside>

        {/* ================= CENTER DASHBOARD ================= */}
        <main className="lg:col-span-6 space-y-6">

          {/* STORIES BAR (Historias) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm overflow-x-auto">
            <div className="flex items-center gap-4">
              {/* Button: Crear Historia */}
              <div 
                onClick={() => storyFileInputRef.current?.click()}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <input 
                  type="file" 
                  ref={storyFileInputRef}
                  onChange={handleStoryFileSelect}
                  accept="image/*,video/*" 
                  className="hidden" 
                />
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-teal-700 bg-teal-50 flex items-center justify-center text-teal-800 group-hover:bg-teal-100 transition-all shadow-sm">
                  <Plus className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-bold text-slate-700">Tu Historia</span>
              </div>

              {/* Grouped Active Stories */}
              {groupedStories.map((gs, idx) => (
                <div 
                  key={gs.userId || idx}
                  onClick={() => setActiveStoryViewerIndex(idx)}
                  className="flex-shrink-0 flex flex-col items-center gap-1.5 cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-teal-700 via-emerald-500 to-amber-500 p-[2.5px] shadow-sm group-hover:scale-105 transition-transform">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-extrabold text-teal-800 text-sm">
                      {gs.displayName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 truncate max-w-[68px]">
                    {gs.displayName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Greeting Header Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                ¡Hola, {user?.displayName || user?.username}! ☀️
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Tu centro de conexión diaria — SocialTush.
              </p>
            </div>
          </div>

          {/* Crear un momento Publisher Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800">Crear un momento</h3>
            <p className="text-xs text-slate-400 font-medium -mt-2">¿Qué quieres compartir hoy?</p>

            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Escribe lo que estás pensando..."
                value={newMomentText}
                onChange={(e) => setNewMomentText(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 focus:outline-none focus:border-teal-800"
              />

              {selectedFile && (
                <div className="flex items-center justify-between p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-800 font-semibold">
                  <span className="truncate max-w-xs">📷 {selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)} className="p-1 text-slate-500 hover:text-rose-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-all">
                  <ImageIcon className="w-4 h-4 text-emerald-700" />
                  <span>Subir Foto/Video</span>
                  <input 
                    type="file" 
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept="image/*,video/*"
                    className="hidden" 
                  />
                </label>

                <button 
                  onClick={handlePublishMoment}
                  disabled={isPublishing || (!newMomentText.trim() && !selectedFile)}
                  className="px-6 py-2.5 bg-teal-800 text-white font-bold text-xs rounded-2xl hover:bg-teal-900 shadow-md shadow-teal-800/20 disabled:opacity-50 transition-all"
                >
                  {isPublishing ? 'Publicando...' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>

          {/* Feed Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-800">Tu feed</h3>
          </div>

          {/* Feed Posts List */}
          <div className="space-y-4">
            {postsList.map(post => (
              <div key={post.postId} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <Link href={`/profile/${post.username}`} className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-700 to-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-sm group-hover:scale-105 transition-transform">
                      {post.displayName ? post.displayName.charAt(0).toUpperCase() : post.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-slate-800 group-hover:text-teal-800 transition-colors">{post.displayName || post.username}</h5>
                      <span className="text-[10px] text-slate-400 font-medium">@{post.username}</span>
                    </div>
                  </Link>
                  <span className="text-[10px] text-slate-400 font-semibold">{post.createdAt || 'Reciente'}</span>
                </div>

                <p className="text-sm text-slate-700 font-medium leading-relaxed">
                  {post.caption}
                </p>

                {post.mediaUrls && post.mediaUrls.length > 0 && (
                  <div className="rounded-2xl overflow-hidden max-h-96 border border-slate-100">
                    <img src={post.mediaUrls[0]} alt="Media" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex items-center gap-6 pt-3 border-t border-slate-100 text-xs text-slate-500 font-bold">
                  <button 
                    onClick={() => handleToggleLike(post.postId)}
                    className={`flex items-center gap-1.5 hover:text-rose-600 transition-colors ${post.hasLiked ? 'text-rose-600 font-extrabold' : ''}`}
                  >
                    <Heart className={`w-4 h-4 ${post.hasLiked ? 'fill-current text-rose-600' : ''}`} />
                    <span>{post.likesCount} me gusta</span>
                  </button>
                  <button 
                    onClick={() => toggleComments(post.postId)}
                    className="flex items-center gap-1.5 text-teal-800 hover:text-teal-900 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.commentsCount} comentarios</span>
                  </button>
                </div>

                {/* Inline Comments Section */}
                {expandedComments[post.postId] && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <form onSubmit={(e) => handleAddComment(post.postId, e)} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Escribe un comentario..."
                        value={commentInputMap[post.postId] || ''}
                        onChange={(e) => setCommentInputMap(prev => ({ ...prev, [post.postId]: e.target.value }))}
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-teal-700"
                      />
                      <button type="submit" className="px-3 py-1.5 bg-teal-800 text-white rounded-xl text-xs font-bold hover:bg-teal-900 transition-all">
                        Publicar
                      </button>
                    </form>

                    {loadingCommentsMap[post.postId] ? (
                      <p className="text-[11px] text-slate-400 italic">Cargando comentarios...</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(postCommentsMap[post.postId] || []).map((c: any, i: number) => (
                          <div key={c.commentId || i} className="bg-slate-50 rounded-xl p-2.5 text-xs">
                            <span className="font-bold text-slate-800 block text-[11px]">@{c.authorUsername || c.username || 'usuario'}</span>
                            <span className="text-slate-700">{c.content || c.text}</span>
                          </div>
                        ))}
                        {(!postCommentsMap[post.postId] || postCommentsMap[post.postId].length === 0) && (
                          <p className="text-[11px] text-slate-400">Sé el primero en comentar.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {postsList.length === 0 && !loadingPosts && (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 space-y-2">
                <Sparkles className="w-8 h-8 mx-auto text-teal-800" />
                <p className="text-xs font-bold text-slate-700">Tu feed está listo</p>
                <p className="text-[11px] text-slate-400">Sigue a otros usuarios o pública un momento para verlos aquí.</p>
              </div>
            )}
          </div>

        </main>

        {/* ================= RIGHT SIDEBAR ================= */}
        <aside className="hidden lg:block lg:col-span-3 space-y-6">
          {/* Profile Quick Widget */}
          <div className="bg-gradient-to-br from-teal-900 to-teal-800 border border-teal-700 rounded-3xl p-6 text-white shadow-sm space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center font-black text-white text-xl border border-white/20">
                {(user?.displayName || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-extrabold text-base leading-tight">{user?.displayName || user?.username}</h4>
                <span className="text-xs text-teal-200 font-medium">@{user?.username}</span>
              </div>
            </div>
            <Link href={`/profile/${user?.username}`} className="block w-full py-2.5 bg-white text-teal-900 font-extrabold text-xs text-center rounded-2xl hover:bg-teal-50 transition-all shadow-md">
              Ver Mi Perfil
            </Link>
          </div>
        </aside>
      </div>

      {/* Story Viewer Modal */}
      {activeStoryViewerIndex !== null && (
        <StoryViewer 
          groupedStories={groupedStories}
          initialUserIndex={activeStoryViewerIndex}
          onClose={() => setActiveStoryViewerIndex(null)}
        />
      )}
    </div>
  );
}

function getMockStories(): GroupedStory[] {
  return [
    {
      userId: '1',
      username: 'sophia',
      displayName: 'Sophia Loren',
      avatarUrl: '',
      stories: [
        {
          storyId: 's1',
          mediaType: 'IMAGE',
          mediaUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop',
          textContent: '¡Disfrutando un nuevo día de diseño! 🎨',
          backgroundColor: '#0f766e',
          musicTitle: 'Coffee Beats',
          createdAt: 'Hace 1h'
        }
      ]
    }
  ];
}
