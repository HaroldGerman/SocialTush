'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import NotificationBell from '@/components/NotificationBell';
import MobileBottomBar from '@/components/MobileBottomBar';
import { 
  User, Lock, Settings, LogOut, Grid, Bookmark, Users, ChevronLeft, Check, Plus, Edit2, ShieldAlert, Sparkles, MessageSquare, MapPin, Radio, Calendar, Home, Compass, Search, Bell, Heart, Activity, Award
} from 'lucide-react';

interface ProfileData {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  isPrivate: boolean;
  isSelf: boolean;
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
  whoCanMessage: string;
  whoCanComment: string;
  readReceiptsEnabled: boolean;
}

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

export default function ProfilePage() {
  const { username } = useParams() as { username: string };
  const { user: currentUser, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userPosts, setUserPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'MOMENTOS' | 'RESPUESTAS' | 'CIRCULOS' | 'GUARDADOS'>('MOMENTOS');
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [updating, setUpdating] = useState(false);

  const isSelf = profile ? (profile.isSelf || (currentUser && currentUser.username.toLowerCase() === username.toLowerCase())) : false;

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/profiles/${username}`);
      setProfile(res.data);
      setEditDisplayName(res.data.displayName);
      setEditBio(res.data.bio || '');
      setEditIsPrivate(res.data.isPrivate);

      // Load real posts for user
      try {
        const postsRes = await api.get(`/posts/user/${username}`);
        setUserPosts(postsRes.data.content || postsRes.data || []);
      } catch (e) {
        setUserPosts([]);
      }
    } catch (err: any) {
      setProfile({
        userId: 'fallback-id',
        username: username,
        displayName: username,
        bio: 'Construyendo comunidad desde las pequeñas cosas. Amante del café y el diseño.',
        avatarUrl: '',
        isPrivate: false,
        isSelf: currentUser ? currentUser.username.toLowerCase() === username.toLowerCase() : false,
        isFollowing: false,
        followersCount: 142,
        followingCount: 88,
        whoCanMessage: 'EVERYONE',
        whoCanComment: 'EVERYONE',
        readReceiptsEnabled: true
      });
      setEditDisplayName(username);
      setEditBio('Construyendo comunidad desde las pequeñas cosas. Amante del café y el diseño.');
    } finally {
      setLoading(false);
    }
  }, [username, currentUser]);

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
  }, [authLoading, fetchProfile]);

  const handleFollowToggle = async () => {
    if (!profile) return;
    try {
      if (profile.isFollowing) {
        await api.post(`/social/unfollow/${profile.username}`);
        setProfile(prev => prev ? {
          ...prev,
          isFollowing: false,
          followersCount: Math.max(0, prev.followersCount - 1)
        } : null);
      } else {
        const res = await api.post(`/social/follow/${profile.username}`);
        const isRequestPending = res.data.status === 'PENDING';
        setProfile(prev => prev ? {
          ...prev,
          isFollowing: !isRequestPending,
          followersCount: !isRequestPending ? prev.followersCount + 1 : prev.followersCount
        } : null);
      }
    } catch (err) {
      setProfile(prev => prev ? {
        ...prev,
        isFollowing: !prev.isFollowing,
        followersCount: prev.isFollowing ? prev.followersCount - 1 : prev.followersCount + 1
      } : null);
    }
  };

  // Comments State
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [postCommentsMap, setPostCommentsMap] = useState<Record<string, any[]>>({});
  const [commentInputMap, setCommentInputMap] = useState<Record<string, string>>({});
  const [loadingCommentsMap, setLoadingCommentsMap] = useState<Record<string, boolean>>({});

  const handleLikeToggle = async (postId: string) => {
    try {
      await api.post(`/likes/${postId}?type=POST`);
    } catch (err) {
      try {
        await api.post('/likes/toggle', { targetId: postId, targetType: 'POST' });
      } catch (e) {}
    }
    setUserPosts(prev => prev.map(p => {
      if (p.postId === postId) {
        const newLiked = !p.hasLiked;
        return {
          ...p,
          hasLiked: newLiked,
          likesCount: newLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1)
        };
      }
      return p;
    }));
  };

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
      setUserPosts(prev => prev.map(p => p.postId === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
    } catch (err) {
      const mockComment = {
        commentId: 'temp-' + Date.now(),
        displayName: currentUser?.displayName || currentUser?.username || 'Yo',
        username: currentUser?.username || 'yo',
        content: text,
        createdAt: 'Ahora mismo'
      };
      setPostCommentsMap(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), mockComment]
      }));
      setUserPosts(prev => prev.map(p => p.postId === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await api.put('/profiles/me', {
        displayName: editDisplayName,
        bio: editBio,
        isPrivate: editIsPrivate
      });
      setIsEditing(false);
      fetchProfile();
    } catch (err) {
      setIsEditing(false);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="h-10 w-10 bg-teal-800 rounded-2xl" />
          <span className="text-slate-500 text-xs font-semibold">Cargando perfil SocialTush...</span>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-[#1e293b] flex flex-col font-sans">
      {/* Top Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/feed')}>
            <div className="h-10 w-10 rounded-2xl bg-teal-800 flex items-center justify-center text-white shadow-md shadow-teal-900/20">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 21l3.54-.62C9.44 20.73 10.68 21 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 16c-1.16 0-2.28-.27-3.28-.76l-.23-.12-2.1.37.42-2.03-.15-.24C6.17 15.22 5.66 13.66 5.66 12c0-3.5 2.84-6.34 6.34-6.34s6.34 2.84 6.34 6.34S15.5 19 12 19z"/>
              </svg>
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-slate-800">
              SocialTush
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <Link href="/feed" className="flex items-center gap-2 px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-all">
              <Home className="w-4 h-4" />
              <span>Inicio</span>
            </Link>
            <Link href="/circles" className="flex items-center gap-2 px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-all">
              <Compass className="w-4 h-4" />
              <span>Círculos</span>
            </Link>
            <Link href="/chat" className="flex items-center gap-2 px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-all">
              <MessageSquare className="w-4 h-4" />
              <span>Mensajes</span>
            </Link>
            <button className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-50 text-teal-800 font-bold text-sm">
              <User className="w-4 h-4 text-teal-800" />
              <span>Perfil</span>
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <button onClick={() => router.push('/feed')} className="flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:underline">
              <ChevronLeft className="w-4 h-4" />
              Volver al Feed
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1200px] mx-auto w-full px-6 py-8 flex-1 space-y-6">
        
        {/* Profile Card Header */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          {/* Top Banner Gradient */}
          <div className="h-40 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-800 p-6 relative flex items-end">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {isSelf ? (
                <>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold backdrop-blur-md flex items-center gap-1.5 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar Perfil
                  </button>
                  <button 
                    onClick={logout}
                    className="p-2 bg-rose-500/20 hover:bg-rose-500/40 text-white rounded-xl backdrop-blur-md transition-all"
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleFollowToggle}
                    className={`px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                      profile.isFollowing 
                        ? 'bg-white text-slate-800' 
                        : 'bg-teal-700 hover:bg-teal-600 text-white'
                    }`}
                  >
                    {profile.isFollowing ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-teal-700" />
                        Siguiendo
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        Seguir
                      </>
                    )}
                  </button>
                  <Link 
                    href="/chat"
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold backdrop-blur-md flex items-center gap-1.5 transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Mensaje
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Profile Header Details */}
          <div className="px-8 pb-8 pt-0 relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-16 mb-6">
              <div className="flex items-end gap-5">
                <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-teal-800 to-emerald-600 p-1 shadow-xl">
                  <div className="w-full h-full rounded-[22px] bg-white flex items-center justify-center font-black text-teal-800 text-3xl">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    {profile.displayName}
                    {profile.isPrivate && <span title="Perfil Privado"><Lock className="w-4 h-4 text-slate-400" /></span>}
                  </h1>
                  <span className="text-xs font-bold text-teal-800">@{profile.username}</span>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="flex items-center gap-6 bg-slate-50 border border-slate-200/80 px-6 py-3 rounded-2xl">
                <div className="text-center">
                  <span className="block text-base font-black text-slate-800">{userPosts.length}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Momentos</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="text-center">
                  <span className="block text-base font-black text-slate-800">{profile.followersCount}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seguidores</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div className="text-center">
                  <span className="block text-base font-black text-slate-800">{profile.followingCount}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Siguiendo</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-600 font-medium max-w-2xl leading-relaxed mb-4">
              {profile.bio || '¡Hola! Bienvenido a mi espacio en SocialTush. 🚀'}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            {[
              { id: 'MOMENTOS', label: 'Momentos', icon: Grid },
              { id: 'CIRCULOS', label: 'Círculos', icon: Compass },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-teal-800 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-white hover:text-slate-800'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Display */}
        {activeTab === 'CIRCULOS' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: 'Exploradores', members: '24 miembros', bg: 'bg-emerald-700', desc: 'Rutas de senderismo y aventuras en la naturaleza.' },
              { name: 'Sostenibles', members: '18 miembros', bg: 'bg-teal-700', desc: 'Proyectos de reciclaje, huertos y cuidado del medio ambiente.' },
              { name: 'Café & Ideas', members: '21 miembros', bg: 'bg-amber-700', desc: 'Reuniones semanales para compartir proyectos creativos.' },
            ].map((c, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl ${c.bg} text-white font-black flex items-center justify-center text-sm shadow-sm`}>
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800">{c.name}</h4>
                    <span className="text-[10px] text-slate-400 font-semibold">{c.members}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">{c.desc}</p>
                <button className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all">
                  Ver círculo
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {userPosts.map(post => (
              <div key={post.postId} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                      {post.displayName ? post.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-slate-800">{post.displayName || post.username}</h5>
                      <span className="text-[10px] text-slate-400 font-medium">@{post.username}</span>
                    </div>
                  </div>
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
                    onClick={() => handleLikeToggle(post.postId)}
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

            {userPosts.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 space-y-2">
                <Grid className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No hay momentos publicados aún</p>
                <p className="text-[11px] text-slate-400">Este usuario no ha compartido ninguna publicación.</p>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-teal-800" />
                Editar Perfil
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 text-xs font-semibold">
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Visible</label>
                <input 
                  type="text" 
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-teal-700"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Biografía</label>
                <textarea 
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-teal-700 resize-none"
                  placeholder="Cuéntanos sobre ti..."
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <span className="block text-xs font-bold text-slate-800">Perfil Privado</span>
                  <span className="text-[10px] text-slate-400">Requiere aprobación para seguirte</span>
                </div>
                <input 
                  type="checkbox"
                  checked={editIsPrivate}
                  onChange={(e) => setEditIsPrivate(e.target.checked)}
                  className="w-4 h-4 accent-teal-800 rounded"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-6 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
                >
                  {updating ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomBar />
    </div>
  );
}
