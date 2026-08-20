'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Users, Sparkles, Plus, Search, MapPin, Globe, Compass, 
  MessageCircle, Flame, Shield, ArrowRight, CheckCircle2, UserPlus, Layers, Heart
} from 'lucide-react';
import MobileBottomBar from '@/components/MobileBottomBar';
import UserAvatar from '@/components/UserAvatar';

interface CircleItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatarUrl?: string;
  coverUrl?: string;
  visibility: string;
  type: string;
  city?: string;
  country?: string;
  membersCount: number;
  activeNowCount: number;
  isMember: boolean;
}

export default function CirclesPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [circles, setCircles] = useState<CircleItem[]>([]);
  const [myCircles, setMyCircles] = useState<CircleItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'EXPLORE' | 'MINE'>('EXPLORE');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [createError, setCreateError] = useState('');

  // New circle form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState('GENERAL');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCircles = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [allRes, mineRes] = await Promise.all([
        api.get('/circles'),
        user ? api.get('/circles/mine') : Promise.resolve({ data: [] })
      ]);
      setCircles(allRes.data || []);
      setMyCircles(mineRes.data || []);
    } catch (e) {
      console.error('Error fetching circles', e);
      setLoadError('No se pudieron cargar los círculos.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCircles();
    if (new URLSearchParams(window.location.search).get('create') === '1') {
      setIsModalOpen(true);
      router.replace('/circles', { scroll: false });
    }
  }, [fetchCircles, router]);

  const handleJoinToggle = async (circle: CircleItem) => {
    setActionError('');
    try {
      if (circle.isMember) {
        await api.post(`/circles/${circle.id}/leave`);
      } else {
        await api.post(`/circles/${circle.id}/join`);
      }
      fetchCircles();
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'No se pudo cambiar la membresía del círculo.');
    }
  };

  const handleCreateCircle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setCreateError('');
    try {
      const response = await api.post('/circles', {
        name: name.trim(),
        description: description.trim(),
        city: city.trim(),
        type,
        visibility
      });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setCity('');
      router.push(`/circles/${response.data.slug}`);
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'No se pudo crear el círculo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCircles = (activeTab === 'EXPLORE' ? circles : myCircles).filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-800 dark:bg-[#090d16] dark:text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0f172a]/90 backdrop-blur-md border-b border-teal-100 dark:border-slate-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/feed" className="flex items-center gap-2 group">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white font-black text-xl shadow-md group-hover:scale-105 transition-transform">
                S
              </div>
              <span className="font-bold text-xl tracking-tight text-teal-950 dark:text-white">
                Social<span className="text-teal-600">Tush</span>
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-teal-50/70 dark:bg-slate-900 p-1 rounded-2xl border border-teal-100 dark:border-slate-800">
            <Link href="/feed" className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-teal-700 rounded-xl transition-colors">
              Inicio
            </Link>
            <Link href="/circles" className="px-4 py-2 text-xs font-bold text-teal-800 dark:text-teal-300 bg-white dark:bg-slate-800 shadow-xs rounded-xl transition-colors flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              <span>Círculos</span>
            </Link>
            <Link href="/chat" className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-teal-700 rounded-xl transition-colors">
              Chat
            </Link>
          </nav>

          {/* Right Action */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-md shadow-teal-700/20 flex items-center gap-2 transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Círculo</span>
            </button>
            {user && (
              <Link href={`/profile/${user.username}`}><UserAvatar avatarUrl={user.avatarUrl} name={user.displayName || user.username} className="h-9 w-9 rounded-xl text-xs border border-teal-200" /></Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-700 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl">
          <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-teal-100 border border-white/15">
              <Compass className="w-3.5 h-3.5" />
              <span>Círculos & Nodos Sociales</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Encuentra tus espacios de pertenencia
            </h1>
            <p className="text-teal-100 text-xs sm:text-sm leading-relaxed">
              Los Círculos son espacios temáticos y locales para conversar, colaborar y encontrarse en eventos reales. Un mundo más allá del scroll infinito.
            </p>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-[#0f172a] p-4 rounded-2xl border border-teal-100 dark:border-slate-800 shadow-sm">
          {/* Tabs */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('EXPLORE')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'EXPLORE'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Explorar Todos ({circles.length})
            </button>
            <button
              onClick={() => setActiveTab('MINE')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'MINE'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Mis Círculos ({myCircles.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar círculo o ciudad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-teal-500 text-slate-900 dark:text-white transition-all"
            />
          </div>
        </div>

        {/* Circles Grid */}
        {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{actionError}</p>}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="h-56 bg-white dark:bg-[#0f172a] rounded-3xl animate-pulse p-6 border border-slate-100 dark:border-slate-800" />
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-3xl border border-rose-200 bg-white p-10 text-center dark:border-rose-900 dark:bg-[#0f172a]"><p className="text-sm text-rose-600">{loadError}</p><button onClick={fetchCircles} className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white">Reintentar</button></div>
        ) : filteredCircles.length === 0 ? (
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl p-12 text-center border border-teal-100 dark:border-slate-800 space-y-3">
            <Users className="w-12 h-12 text-teal-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">No se encontraron Círculos</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No hay círculos que coincidan con tu búsqueda. Puedes ser el primero en crear uno para tu comunidad o interés.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold shadow-md hover:bg-teal-800"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Círculo Ahora</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCircles.map(circle => (
              <div
                key={circle.id}
                className="bg-white dark:bg-[#0f172a] rounded-3xl p-6 border border-teal-100/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-teal-200 transition-all flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar avatarUrl={circle.avatarUrl} name={circle.name} className="h-12 w-12 rounded-2xl text-sm border border-teal-200" />
                      <div>
                        <Link href={`/circles/${circle.slug}`} className="font-bold text-sm text-slate-900 dark:text-white hover:text-teal-700 transition-colors line-clamp-1">
                          {circle.name}
                        </Link>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          {circle.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-teal-600" />
                              {circle.city}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-[10px]">
                            {circle.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {circle.description || 'Sin descripción por el momento.'}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-teal-600" />
                      <strong>{circle.membersCount}</strong> miembros
                    </span>
                  </div>

                  <button
                    onClick={() => handleJoinToggle(circle)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      circle.isMember
                        ? 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-200'
                        : 'bg-teal-50 text-teal-700 hover:bg-teal-700 hover:text-white border border-teal-200'
                    }`}
                  >
                    {circle.isMember ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                        <span>Unido</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Unirse</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal: Create Circle */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f172a] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Crear Nuevo Círculo</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCircle} className="space-y-4">
              {createError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{createError}</p>}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Círculo</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Lectores de Ciencia Ficción"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  placeholder="¿De qué trata este espacio?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ciudad (Opcional)</label>
                  <input
                    type="text"
                    placeholder="ej: Lima"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="GENERAL">General</option>
                    <option value="LOCAL">Local</option>
                    <option value="TECH">Tecnología</option>
                    <option value="ARTE">Arte & Cultura</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Privacidad</label>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-teal-500">
                  <option value="PUBLIC">Público</option>
                  <option value="PRIVATE">Privado</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 shadow-md"
                >
                  {isSubmitting ? 'Creando...' : 'Crear Círculo'}
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
