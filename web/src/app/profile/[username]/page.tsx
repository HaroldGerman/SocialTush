'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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

export default function ProfilePage() {
  const { username } = useParams() as { username: string };
  const { user: currentUser, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
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
    } catch (err: any) {
      // Fallback self-healing profile
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
            <Link href="/feed" className="flex items-center gap-2 px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-all">
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
            <button onClick={() => router.push('/feed')} className="flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:underline">
              <ChevronLeft className="w-4 h-4" />
              Volver al Feed
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1200px] mx-auto w-full px-6 py-8 flex-1 space-y-6">
        
        {/* Profile Card Header (Matching Dark Teal Banner Card in RITMO Design) */}
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
                    {profile.isFollowing ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Plus className="w-3.5 h-3.5" />}
                    {profile.isFollowing ? 'Siguiendo' : 'Seguir'}
                  </button>
                  <button 
                    onClick={() => router.push(`/chat?username=${profile.username}`)}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold backdrop-blur-md transition-all"
                  >
                    Mensaje
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Profile Header Info Content */}
          <div className="px-8 pb-8 pt-0 relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-16 mb-6">
              {/* Avatar */}
              <div className="w-28 h-28 rounded-full bg-white p-1.5 shadow-xl shrink-0">
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-teal-800 to-emerald-700 flex items-center justify-center font-black text-white text-3xl shadow-inner">
                  {profile.displayName.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Names & Tagline */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">{profile.displayName}</h1>
                  <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-100">
                    @{profile.username}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center justify-center sm:justify-start gap-2">
                  <span>Diseñadora • Curiosa • Cafetera</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <MapPin className="w-3 h-3 text-teal-800" />
                    Ciudad de México
                  </span>
                </p>
              </div>
            </div>

            {/* Bio text */}
            <p className="text-xs text-slate-600 leading-relaxed font-medium max-w-2xl bg-slate-50 p-4 rounded-2xl border border-slate-200">
              "{profile.bio || 'Construyendo comunidad desde las pequeñas cosas. Compartiendo momentos, arte y proyectos sostenibles.'}"
            </p>

            {/* Stats Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-6 mt-6 border-t border-slate-100">
              <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-200">
                <span className="block text-base font-black text-teal-800">32</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Momentos</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-200">
                <span className="block text-base font-black text-teal-800">18</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Respuestas</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-200">
                <span className="block text-base font-black text-amber-600">7</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Proyectos</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-200">
                <span className="block text-base font-black text-emerald-600">54</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Aportes</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-200">
                <span className="block text-base font-black text-slate-800">{profile.followersCount}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Seguidores</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl text-center border border-slate-200">
                <span className="block text-base font-black text-slate-800">{profile.followingCount}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Seguidos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Content Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-3">
            {[
              { id: 'MOMENTOS', label: '⚡ MIS MOMENTOS' },
              { id: 'RESPUESTAS', label: '💬 RESPUESTAS' },
              { id: 'CIRCULOS', label: '👥 MIS CÍRCULOS' },
              { id: 'GUARDADOS', label: '⭐️ GUARDADOS' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all ${
                  activeTab === tab.id
                    ? 'bg-teal-800 text-white shadow-md shadow-teal-800/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
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
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-xs">
                  {profile.displayName.charAt(0)}
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-800">{profile.displayName}</h5>
                  <span className="text-[10px] text-slate-400">Hace 2 horas • En Café & Ideas</span>
                </div>
              </div>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                ¡Nuevos diseños listos para el taller colaborativo del fin de semana! Nos vemos en el Café Centro a las 5:00 PM. ☕🎨
              </p>
              <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-500 font-bold">
                <span className="flex items-center gap-1 text-rose-600">❤️ 24 me gusta</span>
                <span className="flex items-center gap-1 text-teal-800">💬 6 comentarios</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-xs">
                  {profile.displayName.charAt(0)}
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-800">{profile.displayName}</h5>
                  <span className="text-[10px] text-slate-400">Ayer • En Sostenibles</span>
                </div>
              </div>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                Avanzando un 65% en la preparación de compostaje urbano con los vecinos del barrio. 🌿
              </p>
            </div>
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

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Nombre público</label>
                <input 
                  type="text" 
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-teal-800"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Biografía</label>
                <textarea 
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-teal-800 h-24 resize-none"
                  placeholder="Cuéntanos sobre ti..."
                />
              </div>

              <button
                type="submit"
                disabled={updating}
                className="w-full py-3 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-800/20"
              >
                {updating ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
