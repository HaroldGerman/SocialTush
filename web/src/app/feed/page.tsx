'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Home, Activity, Bookmark, Calendar, Compass, Plus, Search, Bell, 
  User, MessageSquare, Image as ImageIcon, Mic, HelpCircle, Smile, 
  MapPin, Play, Pause, ChevronRight, Settings, Users, Sparkles, Check, Share2, Layers, Heart
} from 'lucide-react';

export default function FeedPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // Tab & Filter state
  const [feedFilter, setFeedFilter] = useState<'TODOS' | 'CIRCULOS' | 'CERCANOS' | 'GUARDADOS'>('TODOS');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [joinedCircles, setJoinedCircles] = useState<string[]>([]);
  const [newMomentText, setNewMomentText] = useState('');
  const [momentsList, setMomentsList] = useState<any[]>([]);

  const handleToggleJoin = (circleName: string) => {
    if (joinedCircles.includes(circleName)) {
      setJoinedCircles(prev => prev.filter(c => c !== circleName));
    } else {
      setJoinedCircles(prev => [...prev, circleName]);
    }
  };

  const handlePublishMoment = (type: string) => {
    if (!newMomentText.trim() && type === 'texto') return;
    const moment = {
      id: Math.random().toString(),
      type,
      author: user?.displayName || 'Ana Estrada',
      username: user?.username || 'anaestrada',
      text: newMomentText || '¡Compartiendo un nuevo momento con la comunidad!',
      createdAt: 'Ahora mismo'
    };
    setMomentsList([moment, ...momentsList]);
    setNewMomentText('');
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

          {/* Center Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            <button className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-50 text-teal-800 font-bold text-sm">
              <Home className="w-4 h-4 text-teal-800" />
              <span>Inicio</span>
            </button>
            <button className="flex items-center gap-2 px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-all">
              <Compass className="w-4 h-4" />
              <span>Círculos</span>
            </button>
            <button 
              onClick={() => handlePublishMoment('texto')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-sm shadow-md shadow-teal-800/20 transition-all mx-2"
            >
              <Plus className="w-4 h-4" />
              <span>Crear</span>
            </button>
            <Link href="/chat" className="flex items-center gap-2 px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-all">
              <MessageSquare className="w-4 h-4" />
              <span>Mensajes</span>
            </Link>
            <Link href={`/profile/${user?.username || 'usuario_A'}`} className="flex items-center gap-2 px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-sm transition-all">
              <User className="w-4 h-4" />
              <span>Perfil</span>
            </Link>
          </nav>

          {/* Right Header User Bar */}
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar en SocialTush..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-full text-xs text-slate-700 focus:outline-none focus:border-teal-700"
              />
            </div>

            <button className="p-2.5 rounded-full hover:bg-slate-100 text-slate-600 relative transition-all">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
            </button>

            <Link href={`/profile/${user?.username || 'usuario_A'}`} className="flex items-center gap-2 pl-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-teal-700 to-emerald-600 p-[2px]">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-teal-800 text-xs">
                  {(user?.displayName || 'Ana Estrada').charAt(0)}
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 hidden lg:inline">{user?.displayName || 'Ana Estrada'}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container Grid Layout */}
      <div className="max-w-[1600px] mx-auto w-full px-6 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ================= LEFT SIDEBAR ================= */}
        <aside className="hidden lg:block lg:col-span-3 space-y-6">
          {/* Main Navigation links */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-teal-50 text-teal-800 font-bold text-xs">
              <Home className="w-4 h-4 text-teal-800" />
              <span>Inicio</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-all">
              <Activity className="w-4 h-4" />
              <span>Mi actividad</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-all">
              <Bookmark className="w-4 h-4" />
              <span>Guardados</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-all">
              <Calendar className="w-4 h-4" />
              <span>Calendario</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-all">
              <Compass className="w-4 h-4" />
              <span>Explorar círculos</span>
            </button>
          </div>

          {/* MIS CÍRCULOS List */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">MIS CÍRCULOS</h4>
              <button className="text-[11px] font-bold text-teal-800 hover:underline">Ver todos</button>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Exploradores', members: '24 miembros', badge: 8, bg: 'bg-emerald-700' },
                { name: 'Sostenibles', members: '18 miembros', badge: 5, bg: 'bg-teal-700' },
                { name: 'Vecinos Centro', members: '32 miembros', badge: 2, bg: 'bg-slate-700' },
                { name: 'Café & Ideas', members: '21 miembros', badge: 1, bg: 'bg-amber-700' },
                { name: 'Lectores', members: '16 miembros', badge: 3, bg: 'bg-indigo-700' },
                { name: 'Viajeros', members: '14 miembros', badge: 4, bg: 'bg-cyan-700' },
              ].map((c, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl ${c.bg} text-white flex items-center justify-center font-bold text-xs shadow-sm`}>
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-slate-800">{c.name}</h5>
                      <span className="text-[10px] text-slate-400">{c.members}</span>
                    </div>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-teal-800 text-white font-bold text-[10px] flex items-center justify-center">
                    {c.badge}
                  </span>
                </div>
              ))}
            </div>

            <button className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all">
              <Plus className="w-4 h-4 text-teal-800" />
              <span>Crear círculo</span>
            </button>
          </div>

          {/* Pregunta del día card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-teal-800 font-bold text-xs">
              <HelpCircle className="w-4 h-4" />
              <span>Pregunta del día</span>
            </div>
            <p className="text-xs font-semibold text-slate-700 leading-snug">
              ¿Qué pequeño cambio hizo tu día mejor esta semana?
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400 font-medium">127 respuestas</span>
              <button className="px-4 py-1.5 bg-teal-800 text-white font-bold text-xs rounded-xl hover:bg-teal-900 transition-all">
                Responder
              </button>
            </div>
          </div>
        </aside>


        {/* ================= CENTER DASHBOARD ================= */}
        <main className="lg:col-span-6 space-y-6">

          {/* Greeting Header Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                ¡Buenos días, {user?.displayName || 'Ana'}! ☀️
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Tu centro de conexión diaria — Aquí está tu pulso social de hoy.
              </p>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center">
                <span className="block text-lg font-black text-teal-800">32</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Momentos</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center">
                <span className="block text-lg font-black text-teal-800">18</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Respuestas</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center">
                <span className="block text-lg font-black text-amber-600">7</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Proyectos</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center">
                <span className="block text-lg font-black text-emerald-600">54</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Aportes</span>
              </div>
            </div>
          </div>

          {/* Crear un momento Publisher Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800">Crear un momento</h3>
            <p className="text-xs text-slate-400 font-medium -mt-2">¿Qué quieres compartir hoy?</p>

            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Escribe lo que estás pensando..."
                value={newMomentText}
                onChange={(e) => setNewMomentText(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 focus:outline-none focus:border-teal-800"
              />
              <button 
                onClick={() => handlePublishMoment('texto')}
                className="px-5 py-2.5 bg-teal-800 text-white font-bold text-xs rounded-2xl hover:bg-teal-900 shadow-md shadow-teal-800/20"
              >
                Publicar
              </button>
            </div>

            <div className="grid grid-cols-5 gap-3 pt-1">
              <button onClick={() => handlePublishMoment('texto')} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-teal-50/60 hover:bg-teal-100/60 border border-teal-100 transition-all">
                <span className="font-black text-teal-800 text-base mb-1">T</span>
                <span className="text-[11px] font-bold text-teal-900">Texto</span>
              </button>
              <button onClick={() => handlePublishMoment('foto')} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-50/60 hover:bg-emerald-100/60 border border-emerald-100 transition-all">
                <ImageIcon className="w-5 h-5 text-emerald-700 mb-1" />
                <span className="text-[11px] font-bold text-emerald-900">Foto</span>
              </button>
              <button onClick={() => handlePublishMoment('audio')} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-purple-50/60 hover:bg-purple-100/60 border border-purple-100 transition-all">
                <Mic className="w-5 h-5 text-purple-700 mb-1" />
                <span className="text-[11px] font-bold text-purple-900">Audio</span>
              </button>
              <button onClick={() => handlePublishMoment('pregunta')} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-blue-50/60 hover:bg-blue-100/60 border border-blue-100 transition-all">
                <HelpCircle className="w-5 h-5 text-blue-700 mb-1" />
                <span className="text-[11px] font-bold text-blue-900">Pregunta</span>
              </button>
              <button onClick={() => handlePublishMoment('animo')} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-50/60 hover:bg-amber-100/60 border border-amber-100 transition-all">
                <Smile className="w-5 h-5 text-amber-700 mb-1" />
                <span className="text-[11px] font-bold text-amber-900">Ánimo</span>
              </button>
            </div>
          </div>

          {/* Tu Feed Filter Tabs */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-800">Tu feed</h3>

            <div className="flex items-center gap-2">
              {[
                { id: 'TODOS', label: 'Todos' },
                { id: 'CIRCULOS', label: 'Círculos' },
                { id: 'CERCANOS', label: 'Cercanos' },
                { id: 'GUARDADOS', label: 'Guardados' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFeedFilter(f.id as any)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                    feedFilter === f.id
                      ? 'bg-teal-800 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* User Moments List */}
          {momentsList.map(m => (
            <div key={m.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-xs">
                    {m.author.charAt(0)}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-800">{m.author}</h5>
                    <span className="text-[10px] text-slate-400">{m.createdAt}</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">{m.text}</p>
            </div>
          ))}

          {/* Feed Card 1: Pregunta del día */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-teal-800 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4" />
                Pregunta del día • De Vecinos Centro
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800 leading-relaxed">
              ¿Qué lugar del barrio recomendarías a quienes nos visitan por primera vez?
            </p>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-teal-700 border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">M</div>
                  <div className="w-6 h-6 rounded-full bg-amber-700 border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">L</div>
                  <div className="w-6 h-6 rounded-full bg-purple-700 border-2 border-white flex items-center justify-center text-[9px] font-bold text-white">P</div>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">32 respuestas</span>
              </div>
              <button className="px-5 py-1.5 bg-teal-800 text-white font-bold text-xs rounded-xl hover:bg-teal-900 transition-all">
                Responder
              </button>
            </div>
          </div>

          {/* Feed Card 2: Momentos cerca de ti */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-teal-800" />
                  Momentos cerca de ti
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">3 momentos compartidos a 1 km de ti</span>
              </div>
              <button className="px-3.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all">
                <span>Ver mapa</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
              ].map((img, i) => (
                <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-200 relative group cursor-pointer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="momento" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
              ))}
            </div>
          </div>

          {/* Feed Card 3: Audio corto waveform player */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <span className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-purple-700" />
              Audio corto • De Café & Ideas
            </span>
            <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
              <button 
                onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                className="w-10 h-10 rounded-full bg-teal-800 text-white flex items-center justify-center shadow-md hover:bg-teal-900 transition-all shrink-0"
              >
                {isPlayingAudio ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div className="flex-1">
                <span className="font-bold text-xs text-slate-800 block">Reflexión de Marina</span>
                <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                  <div className={`h-full bg-teal-800 transition-all duration-300 ${isPlayingAudio ? 'w-2/3' : 'w-1/4'}`} />
                </div>
              </div>
              <span className="text-[11px] font-mono text-slate-400 font-bold">0:28</span>
            </div>
          </div>

          {/* Feed Card 4: Actividad colaborativa */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-emerald-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Actividad colaborativa • De Sostenibles
              </span>
              <button className="text-xs font-bold text-teal-800 hover:underline">Ver proyecto</button>
            </div>
            <h5 className="font-bold text-xs text-slate-800">Diseñemos el mural del barrio 🎨</h5>
            <p className="text-[11px] text-slate-500 font-medium">12 personas aportaron hoy</p>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full w-[65%]" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 block text-right">65% completado</span>
          </div>

        </main>


        {/* ================= RIGHT SIDEBAR ================= */}
        <aside className="hidden lg:block lg:col-span-3 space-y-6">

          {/* User Profile Card (Dark Teal Gradient) */}
          <div className="teal-gradient-card p-6 rounded-3xl space-y-4 shadow-lg">
            <div className="flex items-start justify-between">
              <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 p-1">
                <div className="w-full h-full rounded-full bg-teal-900 flex items-center justify-center font-black text-white text-lg">
                  {(user?.displayName || 'Ana Estrada').charAt(0)}
                </div>
              </div>
              <button className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-all">
                <Settings className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="font-black text-lg text-white tracking-tight">{user?.displayName || 'Ana Estrada'}</h3>
              <p className="text-xs text-teal-100/90 font-medium">Diseñadora • Curiosa • Cafetera</p>
              <span className="text-[11px] text-teal-200 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3 text-teal-300" />
                Ciudad de México
              </span>
            </div>

            <p className="text-xs text-teal-50/90 leading-relaxed font-normal pt-1 border-t border-white/10">
              "Construyendo comunidad desde las pequeñas cosas."
            </p>
          </div>

          {/* Círculos activos horizontal avatars */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700">Círculos activos</h4>
              <span className="text-[10px] text-slate-400 font-bold">6 círculos</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {['Exploradores', 'Sostenibles', 'Vecinos', 'Café', 'Lectores', 'Viajeros'].map((name, idx) => (
                <div key={idx} className="w-10 h-10 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-xs shrink-0 border-2 border-white shadow-sm">
                  {name.charAt(0)}
                </div>
              ))}
            </div>
          </div>

          {/* Sugeridos para ti */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700">Sugeridos para ti</h4>
              <button className="text-[11px] font-bold text-teal-800 hover:underline">Ver todos</button>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Huertos Urbanos', members: '18 miembros' },
                { name: 'Arte & Diseño', members: '24 miembros' },
                { name: 'Mujeres en Impacto', members: '31 miembros' },
              ].map((s, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <h5 className="font-bold text-xs text-slate-800">{s.name}</h5>
                    <span className="text-[10px] text-slate-400">{s.members}</span>
                  </div>
                  <button 
                    onClick={() => handleToggleJoin(s.name)}
                    className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${
                      joinedCircles.includes(s.name)
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-teal-800 hover:bg-teal-900 text-white'
                    }`}
                  >
                    {joinedCircles.includes(s.name) ? 'Unido' : 'Unirse'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Próximos eventos agenda */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700">Próximos eventos</h4>
              <button className="text-[11px] font-bold text-teal-800 hover:underline">Ver calendario</button>
            </div>

            <div className="space-y-3">
              {[
                { date: '24 MAY', title: 'Taller de Compostaje', circle: 'Sostenibles', time: 'Sáb, 10:00 AM' },
                { date: '25 MAY', title: 'Caminata al Cerro Azul', circle: 'Exploradores', time: 'Dom, 8:30 AM' },
                { date: '27 MAY', title: 'Café colaborativo', circle: 'Café & Ideas', time: 'Mar, 6:00 PM' },
              ].map((e, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex flex-col items-center justify-center shrink-0">
                    <span className="font-black text-teal-900 text-xs">{e.date}</span>
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-800">{e.title}</h5>
                    <span className="text-[10px] text-slate-400 block">{e.circle} • {e.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </aside>

      </div>
    </div>
  );
}
