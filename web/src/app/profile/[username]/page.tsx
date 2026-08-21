'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity, Award, Camera, Check, ChevronLeft, Compass, Edit2, Grid, Heart, Lock,
  LogOut, MessageSquare, Moon, MoreVertical, Pin, Plus, ShieldAlert, Sparkles, Sun,
  Trash2, User, Users, Video
} from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import NotificationBell from '@/components/NotificationBell';
import MobileBottomBar from '@/components/MobileBottomBar';
import UserAvatar from '@/components/UserAvatar';
import { formatLocalTimestamp } from '@/lib/dateUtils';

interface ProfileData {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  isPrivate: boolean;
  isSelf: boolean;
  isFollowing: boolean;
  canViewContent: boolean;
  relationshipStatus: 'NONE' | 'PENDING' | 'FOLLOWING';
  postCount: number;
  followersCount: number;
  followingCount: number;
  whoCanMessage: string;
  whoCanComment: string;
  readReceiptsEnabled: boolean;
  interests?: string;
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
  mediaTypes?: string[];
  mediaThumbnailUrls?: string[];
  isShortVideo?: boolean;
  featuredPosition?: number | null;
  likesCount: number;
  commentsCount: number;
  hasLiked: boolean;
  isSaved?: boolean;
  createdAt: string;
}

interface ProfileCircle {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  membersCount: number;
  visibility: string;
}

function PostMedia({ post, showcase = false }: { post: PostData; showcase?: boolean }) {
  if (!post.mediaUrls?.length) return null;
  const type = post.mediaTypes?.[0] || '';
  const video = type === 'VIDEO' || post.isShortVideo;
  const thumbnail = post.mediaThumbnailUrls?.[0];

  if (showcase) {
    if (video && thumbnail) return <img src={thumbnail} alt="Portada" loading="lazy" className="h-full w-full object-cover" />;
    if (video) return <video src={post.mediaUrls[0]} muted playsInline preload="metadata" className="h-full w-full object-cover" />;
    return <img src={post.mediaUrls[0]} alt="Publicación destacada" loading="lazy" className="h-full w-full object-cover" />;
  }

  if (video) {
    return <video src={post.mediaUrls[0]} poster={thumbnail} controls playsInline preload="metadata" className="max-h-[70dvh] w-full bg-black object-contain" />;
  }
  return <img src={post.mediaUrls[0]} alt="Media" loading="lazy" className="max-h-[70dvh] w-full object-contain" />;
}

export default function ProfilePage() {
  const { username } = useParams() as { username: string };
  const { user: currentUser, logout, updateUserProfile, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userPosts, setUserPosts] = useState<PostData[]>([]);
  const [profileCircles, setProfileCircles] = useState<ProfileCircle[]>([]);
  const [activeTab, setActiveTab] = useState<'POSTS' | 'CIRCLES'>('POSTS');
  const [loading, setLoading] = useState(true);
  const [postsLoadError, setPostsLoadError] = useState(false);
  const [circlesError, setCirclesError] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [postMenuOpenId, setPostMenuOpenId] = useState<string | null>(null);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [updatingFeaturedId, setUpdatingFeaturedId] = useState<string | null>(null);

  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [postCommentsMap, setPostCommentsMap] = useState<Record<string, any[]>>({});
  const [commentInputMap, setCommentInputMap] = useState<Record<string, string>>({});
  const [loadingCommentsMap, setLoadingCommentsMap] = useState<Record<string, boolean>>({});

  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSelf = Boolean(profile && (profile.isSelf || currentUser?.username?.toLowerCase() === profile.username.toLowerCase()));
  const interests = useMemo(() => profile?.interests?.split(',').map(value => value.trim()).filter(Boolean) || [], [profile?.interests]);
  const totalResonances = useMemo(() => userPosts.reduce((total, post) => total + (post.likesCount || 0), 0), [userPosts]);
  const totalEchoes = useMemo(() => userPosts.reduce((total, post) => total + (post.commentsCount || 0), 0), [userPosts]);
  const pulseCount = useMemo(() => userPosts.filter(post => post.isShortVideo).length, [userPosts]);
  const featuredPosts = useMemo(() => userPosts.filter(post => post.featuredPosition != null)
    .sort((a, b) => (a.featuredPosition || 99) - (b.featuredPosition || 99)).slice(0, 3), [userPosts]);

  const fetchPosts = useCallback(async (knownProfile: ProfileData) => {
    setPostsLoadError(false);
    if (!knownProfile.canViewContent) { setUserPosts([]); return; }
    try {
      const response = await api.get(`/posts/user/${encodeURIComponent(username)}`);
      setUserPosts(response.data?.content || response.data || []);
    } catch (requestError: any) {
      setUserPosts([]);
      if (requestError.response?.status === 403) return;
      setPostsLoadError(true);
    }
  }, [username]);

  const fetchProfile = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await api.get(`/profiles/${encodeURIComponent(username)}`);
      const loadedProfile: ProfileData = response.data;
      setProfile(loadedProfile);
      setEditDisplayName(loadedProfile.displayName || '');
      setEditBio(loadedProfile.bio || '');
      setEditIsPrivate(Boolean(loadedProfile.isPrivate));
      await fetchPosts(loadedProfile);
      try {
        const circles = await api.get(`/circles/user/${encodeURIComponent(username)}`);
        setProfileCircles(circles.data || []); setCirclesError('');
      } catch (circleError: any) {
        setProfileCircles([]); setCirclesError(circleError.response?.data?.message || 'No se pudieron cargar los círculos.');
      }
    } catch (requestError: any) {
      setProfile(null); setUserPosts([]); setProfileCircles([]);
      setError(requestError.response?.status === 404 ? 'Usuario no encontrado' : 'No se pudo cargar este espacio.');
    } finally { setLoading(false); }
  }, [username, fetchPosts]);

  useEffect(() => { if (!authLoading) void fetchProfile(); }, [authLoading, fetchProfile]);

  const handleFollowToggle = async () => {
    if (!profile || profile.relationshipStatus === 'PENDING') return;
    try {
      if (profile.isFollowing) {
        await api.post(`/social/unfollow/${profile.username}`);
        setProfile(previous => previous ? { ...previous, isFollowing: false, canViewContent: !previous.isPrivate, relationshipStatus: 'NONE', followersCount: Math.max(0, previous.followersCount - 1) } : previous);
        if (profile.isPrivate) setUserPosts([]);
      } else {
        const response = await api.post(`/social/follow/${profile.username}`);
        const pending = response.data.status === 'PENDING';
        setProfile(previous => previous ? { ...previous, isFollowing: !pending, canViewContent: !pending || !previous.isPrivate, relationshipStatus: pending ? 'PENDING' : 'FOLLOWING', followersCount: pending ? previous.followersCount : previous.followersCount + 1 } : previous);
        if (!pending) await fetchProfile();
      }
    } catch (requestError: any) { alert(requestError.response?.data?.message || 'No se pudo cambiar la conexión.'); }
  };

  const handleLikeToggle = async (postId: string) => {
    try {
      const response = await api.post(`/likes/${postId}`);
      setUserPosts(previous => previous.map(post => post.postId === postId ? { ...post, hasLiked: response.data.liked, likesCount: response.data.count } : post));
    } catch (requestError: any) { alert(requestError.response?.data?.message || 'No se pudo actualizar la resonancia.'); }
  };

  const toggleComments = async (postId: string) => {
    const next = !expandedComments[postId];
    setExpandedComments(previous => ({ ...previous, [postId]: next }));
    if (!next || postCommentsMap[postId]) return;
    setLoadingCommentsMap(previous => ({ ...previous, [postId]: true }));
    try {
      const response = await api.get(`/comments/${postId}`);
      setPostCommentsMap(previous => ({ ...previous, [postId]: response.data || [] }));
    } catch { setPostCommentsMap(previous => ({ ...previous, [postId]: [] })); }
    finally { setLoadingCommentsMap(previous => ({ ...previous, [postId]: false })); }
  };

  const handleAddComment = async (postId: string, event: React.FormEvent) => {
    event.preventDefault();
    const content = commentInputMap[postId]?.trim();
    if (!content) return;
    try {
      const response = await api.post(`/comments/${postId}`, { content });
      setPostCommentsMap(previous => ({ ...previous, [postId]: [...(previous[postId] || []), response.data] }));
      setUserPosts(previous => previous.map(post => post.postId === postId ? { ...post, commentsCount: (post.commentsCount || 0) + 1 } : post));
      setCommentInputMap(previous => ({ ...previous, [postId]: '' }));
    } catch (requestError: any) { alert(requestError.response?.data?.message || 'No se pudo publicar el eco.'); }
  };

  const featurePost = async (postId: string, position: number) => {
    setUpdatingFeaturedId(postId);
    try {
      await api.put(`/posts/${postId}/feature`, null, { params: { position } });
      setUserPosts(previous => previous.map(post => {
        if (post.postId === postId) return { ...post, featuredPosition: position };
        if (post.featuredPosition === position) return { ...post, featuredPosition: null };
        return post;
      }));
      setPostMenuOpenId(null);
    } catch (requestError: any) { alert(requestError.response?.data?.message || 'No se pudo destacar la publicación.'); }
    finally { setUpdatingFeaturedId(null); }
  };

  const unfeaturePost = async (postId: string) => {
    setUpdatingFeaturedId(postId);
    try {
      await api.delete(`/posts/${postId}/feature`);
      setUserPosts(previous => previous.map(post => post.postId === postId ? { ...post, featuredPosition: null } : post));
      setPostMenuOpenId(null);
    } catch (requestError: any) { alert(requestError.response?.data?.message || 'No se pudo quitar de la Vitrina.'); }
    finally { setUpdatingFeaturedId(null); }
  };

  const handleDeletePost = async (postId: string) => {
    setIsDeletingPost(true);
    try {
      await api.delete(`/posts/${postId}`);
      setUserPosts(previous => previous.filter(post => post.postId !== postId));
      setDeleteConfirmPostId(null);
    } catch (requestError: any) { alert(requestError.response?.data?.message || 'No se pudo eliminar la contribución.'); }
    finally { setIsDeletingPost(false); }
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return alert('Formato no soportado. Usa JPEG, PNG o WEBP.');
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setUpdating(true);
    try {
      let response;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('displayName', editDisplayName);
        formData.append('bio', editBio);
        formData.append('isPrivate', String(editIsPrivate));
        formData.append('avatar', avatarFile);
        response = await api.patch('/profiles/me', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        response = await api.put('/profiles/me', { displayName: editDisplayName, bio: editBio, isPrivate: editIsPrivate });
      }
      updateUserProfile({ displayName: response.data.displayName, avatarUrl: response.data.avatarUrl || currentUser?.avatarUrl });
      setProfile(previous => previous ? { ...previous, displayName: response.data.displayName, bio: response.data.bio, avatarUrl: response.data.avatarUrl, isPrivate: response.data.isPrivate } : previous);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null); setAvatarFile(null); setIsEditing(false);
    } catch (requestError: any) { alert(requestError.response?.data?.message || 'No se pudo actualizar el espacio.'); }
    finally { setUpdating(false); }
  };

  const cancelEdit = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null); setAvatarFile(null); setIsEditing(false);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] dark:bg-[#090d16]"><div className="text-center"><div className="mx-auto h-11 w-11 animate-pulse rounded-2xl bg-teal-700"/><p className="mt-3 text-xs font-bold text-slate-500">Preparando el espacio…</p></div></div>;

  if (!profile) return <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-4 dark:bg-[#090d16]"><div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#0f172a]"><ShieldAlert className="mx-auto h-8 w-8 text-slate-400"/><h1 className="mt-4 font-black dark:text-white">{error}</h1>{error !== 'Usuario no encontrado' && <button onClick={() => void fetchProfile()} className="mt-4 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold text-white">Reintentar</button>}</div></div>;

  return <div className="min-h-screen bg-[#f4f6f9] pb-20 text-slate-800 dark:bg-[#090d16] dark:text-slate-100 md:pb-6">
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-[#0f172a]/95">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:px-6">
        <button onClick={() => router.push('/feed')} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 font-black text-white">L</span><span className="text-xl font-black">Lifonk</span></button>
        <nav className="hidden items-center gap-2 md:flex"><Link href="/feed" className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500">Ritmo</Link><Link href="/pulse" className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500">Pulso</Link><Link href="/circles" className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500">Círculos</Link><Link href="/chat" className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500">Conversaciones</Link><span className="rounded-xl bg-teal-50 px-4 py-2 text-xs font-black text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">Espacio</span></nav>
        <div className="flex items-center gap-2"><button onClick={toggleTheme} className="rounded-xl bg-slate-100 p-2.5 dark:bg-slate-800">{theme === 'light' ? <Moon className="h-4 w-4"/> : <Sun className="h-4 w-4"/>}</button><NotificationBell/></div>
      </div>
    </header>

    <main className="mx-auto w-full max-w-[900px] space-y-5 px-3 py-4 sm:px-4 md:px-6 md:py-7">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f171f]">
        <div className="relative h-40 overflow-hidden bg-[radial-gradient(circle_at_18%_15%,rgba(94,234,212,.55),transparent_24%),radial-gradient(circle_at_84%_80%,rgba(34,197,94,.27),transparent_28%),linear-gradient(135deg,#134e4a,#0f766e_55%,#164e63)] md:h-52">
          <div className="absolute -right-10 -top-14 h-52 w-52 rounded-full border-[34px] border-white/10"/><div className="absolute -left-14 bottom-0 h-28 w-56 rotate-6 rounded-[60%] border border-white/15 bg-white/5"/>
          <div className="absolute right-3 top-3 flex gap-2">{isSelf ? <><button onClick={() => setIsEditing(true)} className="rounded-xl bg-white/15 px-3 py-2 text-xs font-black text-white backdrop-blur"><Edit2 className="mr-1 inline h-3.5 w-3.5"/>Editar</button><button onClick={logout} className="rounded-xl bg-rose-500/20 p-2 text-white backdrop-blur"><LogOut className="h-4 w-4"/></button></> : <><button disabled={profile.relationshipStatus === 'PENDING'} onClick={() => void handleFollowToggle()} className={`rounded-xl px-4 py-2 text-xs font-black ${profile.relationshipStatus === 'FOLLOWING' ? 'bg-white text-slate-800' : profile.relationshipStatus === 'PENDING' ? 'bg-white/30 text-white' : 'bg-teal-950 text-white'}`}>{profile.relationshipStatus === 'FOLLOWING' ? <><Check className="mr-1 inline h-3.5 w-3.5"/>Conectado</> : profile.relationshipStatus === 'PENDING' ? 'Solicitud enviada' : 'Conectar'}</button><Link href={`/chat?username=${encodeURIComponent(profile.username)}`} className="rounded-xl bg-white/15 p-2.5 text-white backdrop-blur"><MessageSquare className="h-4 w-4"/></Link></>}</div>
          <div className="absolute bottom-4 left-32 right-4 md:left-44"><h1 className="truncate text-xl font-black text-white md:text-3xl">{profile.displayName}</h1><p className="mt-1 text-xs font-bold text-white/75">@{profile.username}</p></div>
        </div>
        <div className="relative px-4 pb-6 pt-4 md:px-7">
          <div className="absolute -top-14 left-4 h-28 w-28 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-300 p-[3px] shadow-xl md:-top-16 md:left-7 md:h-32 md:w-32"><UserAvatar avatarUrl={profile.avatarUrl} name={profile.displayName} className="h-full w-full rounded-full border-[3px] border-white text-3xl dark:border-[#0f171f]"/></div>
          <div className="ml-28 min-h-12 md:ml-36"/>
          <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">{profile.bio || (isSelf ? 'Haz que tu Espacio diga algo de ti. Añade una presentación.' : '')}</p>
          {interests.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{interests.slice(0, 8).map(interest => <span key={interest} className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-[10px] font-black text-teal-700 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300">{interest}</span>)}</div>}
          <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl bg-[#f4f7f6] p-2 dark:bg-[#0b1516]">{[[profile.postCount,'Contribuciones'],[profile.followersCount,'Conexiones'],[pulseCount,'Pulsos'],[profileCircles.length,'Círculos']].map(([value,label]) => <div key={String(label)} className="rounded-xl py-2 text-center"><strong className="block text-base">{value}</strong><span className="block truncate text-[8px] font-black uppercase text-slate-400 sm:text-[9px]">{label}</span></div>)}</div>
        </div>
      </section>

      {profile.canViewContent && (featuredPosts.length > 0 || isSelf) && <section className="rounded-[28px] border border-amber-200/70 bg-gradient-to-br from-white via-white to-amber-50 p-4 shadow-sm dark:border-amber-900/40 dark:from-[#0f171f] dark:via-[#0f171f] dark:to-[#241d10] md:p-5">
        <div className="flex items-center justify-between"><div><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.18em] text-amber-600"><Award className="h-4 w-4"/>Vitrina</p><h2 className="mt-1 text-base font-black">{isSelf ? 'Lo que quieres que vean primero' : `Destacado por ${profile.displayName}`}</h2></div>{isSelf && <span className="rounded-full bg-amber-100 px-3 py-1 text-[9px] font-black text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Hasta 3</span>}</div>
        {featuredPosts.length ? <div className="mt-4 grid grid-cols-3 gap-2 md:gap-3">{featuredPosts.map(post => <button key={post.postId} onClick={() => document.getElementById(`post-${post.postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-900 text-left shadow-md"><PostMedia post={post} showcase/><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10"/><span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-slate-900">{post.featuredPosition}</span>{post.isShortVideo && <span className="absolute right-2 top-2 rounded-full bg-black/45 p-1.5 text-white"><Video className="h-3.5 w-3.5"/></span>}<div className="absolute bottom-2 left-2 right-2"><p className="line-clamp-2 text-[10px] font-bold leading-snug text-white md:text-xs">{post.caption || 'Una parte de mi espacio'}</p></div></button>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-white/60 p-5 text-center dark:bg-black/10"><Sparkles className="mx-auto h-5 w-5 text-amber-500"/><p className="mt-2 text-xs font-bold">Destaca tus mejores fotos, logros o Pulsos desde el menú ··· de una publicación.</p></div>}
      </section>}

      {profile.canViewContent && !postsLoadError && <section className="grid grid-cols-3 gap-3 rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0f171f]">{[['Resonancias',totalResonances],['Ecos',totalEchoes],['Pulsos',pulseCount]].map(([label,value]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-[#0b1516]"><strong className="block text-lg">{value}</strong><span className="text-[9px] font-black uppercase text-slate-400">{label}</span></div>)}</section>}

      <div className="flex rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-[#0f171f]"><button onClick={() => setActiveTab('POSTS')} className={`flex-1 rounded-xl py-2.5 text-xs font-black ${activeTab === 'POSTS' ? 'bg-teal-700 text-white' : 'text-slate-500'}`}><Grid className="mr-1 inline h-4 w-4"/>Contribuciones</button><button onClick={() => setActiveTab('CIRCLES')} className={`flex-1 rounded-xl py-2.5 text-xs font-black ${activeTab === 'CIRCLES' ? 'bg-teal-700 text-white' : 'text-slate-500'}`}><Compass className="mr-1 inline h-4 w-4"/>Círculos</button></div>

      {activeTab === 'CIRCLES' ? <section>{circlesError ? <div className="rounded-3xl border border-rose-200 bg-white p-8 text-center text-sm text-rose-600 dark:border-rose-900 dark:bg-[#0f171f]">{circlesError}</div> : profileCircles.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-[#0f171f]">No hay círculos visibles.</div> : <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{profileCircles.map(circle => <Link key={circle.id} href={`/circles/${circle.slug}`} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f171f]"><div className="flex items-center gap-3"><UserAvatar avatarUrl={circle.avatarUrl} name={circle.name} className="h-11 w-11 rounded-2xl text-xs"/><div className="min-w-0"><h3 className="truncate text-sm font-black">{circle.name}</h3><p className="text-[10px] text-slate-400">{circle.membersCount} integrantes</p></div></div><p className="mt-3 line-clamp-3 text-xs text-slate-500">{circle.description || 'Sin descripción.'}</p></Link>)}</div>}</section> : profile.isPrivate && !profile.canViewContent ? <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#0f171f]"><Lock className="mx-auto h-7 w-7 text-slate-400"/><h2 className="mt-3 font-black">Este espacio es privado</h2><p className="mt-1 text-xs text-slate-500">Conecta con @{profile.username} para ver sus contribuciones.</p></section> : postsLoadError ? <section className="rounded-3xl border border-rose-200 bg-white p-8 text-center dark:border-rose-900 dark:bg-[#0f171f]"><ShieldAlert className="mx-auto h-7 w-7 text-rose-400"/><p className="mt-2 text-xs font-bold">No se pudieron cargar las contribuciones.</p><button onClick={() => void fetchPosts(profile)} className="mt-3 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white">Reintentar</button></section> : <div className="space-y-4">{userPosts.map(post => <article id={`post-${post.postId}`} key={post.postId} className={`scroll-mt-24 rounded-3xl border bg-white p-4 shadow-sm dark:bg-[#0f171f] md:p-5 ${post.featuredPosition ? 'border-amber-300 dark:border-amber-800/70' : 'border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><UserAvatar avatarUrl={post.avatarUrl} name={post.displayName || post.username} className="h-10 w-10 rounded-full border border-teal-600/40 text-xs"/><div><div className="flex items-center gap-2"><h3 className="text-sm font-black">{post.displayName || post.username}</h3>{post.featuredPosition && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[8px] font-black uppercase text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><Pin className="mr-0.5 inline h-2.5 w-2.5"/>Vitrina {post.featuredPosition}</span>}</div><p className="text-[10px] text-slate-400">@{post.username} · {formatLocalTimestamp(post.createdAt)}</p></div></div>{isSelf && <div className="relative"><button onClick={() => setPostMenuOpenId(postMenuOpenId === post.postId ? null : post.postId)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><MoreVertical className="h-4 w-4"/></button>{postMenuOpenId === post.postId && <><button aria-label="Cerrar menú" className="fixed inset-0 z-40" onClick={() => setPostMenuOpenId(null)}/><div className="absolute right-0 top-10 z-50 min-w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 text-xs font-bold shadow-xl dark:border-slate-700 dark:bg-[#172130]">{post.featuredPosition ? <button disabled={updatingFeaturedId === post.postId} onClick={() => void unfeaturePost(post.postId)} className="block w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><Pin className="mr-2 inline h-3.5 w-3.5"/>Quitar de Vitrina</button> : <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700"><p className="mb-2 text-[9px] uppercase tracking-wider text-slate-400">Destacar en Vitrina</p><div className="grid grid-cols-3 gap-1">{[1,2,3].map(position => <button key={position} disabled={updatingFeaturedId === post.postId} onClick={() => void featurePost(post.postId, position)} className="rounded-lg bg-amber-50 py-2 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300">#{position}</button>)}</div></div>}<button onClick={() => { setDeleteConfirmPostId(post.postId); setPostMenuOpenId(null); }} className="block w-full px-4 py-2.5 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"><Trash2 className="mr-2 inline h-3.5 w-3.5"/>Eliminar contribución</button></div></>}</div>}</div>
        {post.caption && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{post.caption}</p>}
        {post.musicTitle && <p className="mt-2 text-[10px] font-bold text-teal-600">♫ {post.musicTitle}</p>}
        {post.mediaUrls?.length > 0 && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-black"><PostMedia post={post}/></div>}
        <div className="mt-4 flex items-center gap-6 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500 dark:border-slate-800"><button onClick={() => void handleLikeToggle(post.postId)} className={`flex items-center gap-1.5 ${post.hasLiked ? 'text-rose-500' : ''}`}><Heart className={`h-4 w-4 ${post.hasLiked ? 'fill-current' : ''}`}/>{post.likesCount} {post.likesCount === 1 ? 'resonancia' : 'resonancias'}</button><button onClick={() => void toggleComments(post.postId)} className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400"><MessageSquare className="h-4 w-4"/>{post.commentsCount} {post.commentsCount === 1 ? 'eco' : 'ecos'}</button></div>
        {expandedComments[post.postId] && <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800"><form onSubmit={event => void handleAddComment(post.postId, event)} className="flex gap-2"><input value={commentInputMap[post.postId] || ''} onChange={event => setCommentInputMap(previous => ({ ...previous, [post.postId]: event.target.value }))} placeholder="Escribe un eco…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-[#0b1516]"/><button className="rounded-xl bg-teal-700 px-4 text-xs font-bold text-white">Responder</button></form>{loadingCommentsMap[post.postId] ? <p className="text-[10px] text-slate-400">Cargando ecos…</p> : <div className="max-h-52 space-y-2 overflow-y-auto">{(postCommentsMap[post.postId] || []).map((comment:any,index:number) => <div key={comment.commentId || index} className="rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-[#0b1516]"><strong className="block text-[10px]">@{comment.authorUsername || comment.username || 'usuario'}</strong><span className="text-slate-600 dark:text-slate-300">{comment.content || comment.text}</span></div>)}</div>}</div>}
      </article>)}{userPosts.length === 0 && <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-[#0f171f]"><Grid className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-2 text-xs font-bold text-slate-500">Aún no hay contribuciones.</p></div>}</div>}
    </main>

    {isEditing && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-4"><button aria-label="Cerrar" className="absolute inset-0" onClick={cancelEdit}/><section className="relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0f172a] md:max-w-md md:rounded-3xl"><div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800"><h2 className="font-black"><Edit2 className="mr-2 inline h-4 w-4 text-teal-600"/>Editar espacio</h2><button onClick={cancelEdit} className="text-xs font-bold text-slate-400">Cancelar</button></div><form onSubmit={event => void handleSaveProfile(event)}><div className="space-y-4 p-5"><div className="text-center"><div className="relative mx-auto h-24 w-24"><UserAvatar avatarUrl={avatarPreview || profile.avatarUrl} name={profile.displayName} className="h-24 w-24 rounded-full text-2xl"/><button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 rounded-full bg-teal-700 p-2 text-white"><Camera className="h-4 w-4"/></button></div><button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-xs font-bold text-teal-700">Cambiar imagen</button><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden"/></div><label className="block"><span className="mb-1 block text-xs font-bold">Nombre</span><input value={editDisplayName} onChange={event => setEditDisplayName(event.target.value)} required className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-[#0b1516]"/></label><label className="block"><span className="mb-1 block text-xs font-bold">Presentación</span><textarea value={editBio} onChange={event => setEditBio(event.target.value)} rows={4} className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-[#0b1516]"/></label><label className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><span><strong className="block text-xs">Espacio privado</strong><span className="text-[10px] text-slate-400">Aprueba quién puede ver tu contenido.</span></span><input type="checkbox" checked={editIsPrivate} onChange={event => setEditIsPrivate(event.target.checked)} className="h-5 w-5 accent-teal-700"/></label></div><div className="border-t border-slate-100 p-5 dark:border-slate-800" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}><button disabled={updating} className="w-full rounded-2xl bg-teal-700 py-3 text-sm font-black text-white disabled:opacity-50">{updating ? 'Guardando…' : 'Guardar cambios'}</button></div></form></section></div>}

    {deleteConfirmPostId && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => !isDeletingPost && setDeleteConfirmPostId(null)}><section className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-[#0f172a]" onClick={event => event.stopPropagation()}><h2 className="font-black">Eliminar contribución</h2><p className="mt-2 text-sm text-slate-500">Esta acción no se puede deshacer.</p><div className="mt-5 flex gap-3"><button disabled={isDeletingPost} onClick={() => setDeleteConfirmPostId(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold dark:border-slate-700">Cancelar</button><button disabled={isDeletingPost} onClick={() => void handleDeletePost(deleteConfirmPostId)} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-black text-white">{isDeletingPost ? 'Eliminando…' : 'Eliminar'}</button></div></section></div>}

    {!isEditing && <MobileBottomBar/>}
  </div>;
}
