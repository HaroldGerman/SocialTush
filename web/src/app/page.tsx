'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Image as ImageIcon, Film, User, Shield, Sparkles, RefreshCw, LogOut, 
  ArrowRight, Zap, Video, CheckCircle2, Lock, Heart, MessageCircle, Play, 
  Send, Activity, Database, Server, Globe, Search, Plus, MapPin, Music, Bookmark
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  
  const [backendStatus, setBackendStatus] = useState<'LOADING' | 'UP' | 'DOWN'>('LOADING');
  const [dbStatus, setDbStatus] = useState<string>('UNKNOWN');
  const [redisStatus, setRedisStatus] = useState<string>('UNKNOWN');
  const [lastCheck, setLastCheck] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'CHAT' | 'FEED' | 'REELS' | 'SECURITY'>('CHAT');

  const checkHealth = async () => {
    setBackendStatus('LOADING');
    try {
      const res = await fetch('http://localhost:8080/api/v1/health');
      if (res.ok) {
        const data = await res.json();
        setBackendStatus('UP');
        setDbStatus(data.database);
        setRedisStatus(data.redis);
        setLastCheck(new Date(data.timestamp).toLocaleTimeString());
      } else {
        const data = await res.json().catch(() => ({}));
        setBackendStatus('DOWN');
        setDbStatus(data.database || 'DOWN');
        setRedisStatus(data.redis || 'DOWN');
        setLastCheck(new Date().toLocaleTimeString());
      }
    } catch (error) {
      setBackendStatus('DOWN');
      setDbStatus('DOWN');
      setRedisStatus('DOWN');
      setLastCheck(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/feed');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden bg-grid-pattern">
      {/* Radiant Background Blur Glows */}
      <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse-glow" />
      <div className="absolute top-[35%] right-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse-glow" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-[10%] left-[-10%] w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse-glow" style={{ animationDelay: '4s' }} />

      {/* Glass Navigation Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-800/60 backdrop-blur-xl sticky top-0 z-50 bg-slate-950/70">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-400 via-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer">
            <span className="font-black text-slate-950 text-xl tracking-tighter">S</span>
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight gradient-text-cyan block">
              SocialTush
            </span>
            <span className="text-[10px] text-cyan-400/80 font-medium tracking-widest uppercase block -mt-1">
              Social Platform
            </span>
          </div>
        </div>

        {/* Header Links & Status Pill */}
        <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
          <Link href="/feed" className="hover:text-cyan-400 transition-colors">Feed</Link>
          <Link href="/chat" className="hover:text-cyan-400 transition-colors">Chats</Link>
          <Link href="/reels" className="hover:text-cyan-400 transition-colors">Reels</Link>
          <Link href="/admin" className="hover:text-cyan-400 transition-colors">Moderación</Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Health Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs shadow-inner">
            <span className={`h-2.5 w-2.5 rounded-full ${
              backendStatus === 'UP' ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50 animate-pulse' :
              backendStatus === 'DOWN' ? 'bg-rose-500 shadow-lg shadow-rose-500/50' : 'bg-amber-400'
            }`} />
            <span className="text-slate-400 text-[11px]">
              API: <strong className={backendStatus === 'UP' ? 'text-emerald-400 font-bold' : 'text-slate-200'}>{backendStatus}</strong>
            </span>
            <button 
              onClick={checkHealth}
              className="ml-1 p-0.5 text-slate-400 hover:text-cyan-400 transition-colors"
              title="Actualizar estado"
            >
              <RefreshCw className={`h-3 w-3 ${backendStatus === 'LOADING' ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <Link 
                href={`/profile/${user.username}`}
                className="text-xs text-slate-200 hover:text-cyan-300 font-bold transition-colors bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 hover:border-cyan-500/40"
              >
                @{user.username}
              </Link>
              <button 
                onClick={logout}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/40 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-all active:scale-95"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link 
                href="/login" 
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-200 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95"
              >
                Iniciar Sesión
              </Link>
              <Link 
                href="/register" 
                className="px-4 py-2 rounded-xl gradient-btn-cyan text-xs flex items-center gap-1.5"
              >
                <span>Crear Cuenta</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-20 lg:pb-24 w-full flex flex-col items-center text-center relative z-10">
        {/* Badge Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-8 backdrop-blur-md shadow-lg shadow-cyan-500/5 hover:border-cyan-400/50 transition-all cursor-default">
          <Sparkles className="h-4 w-4 text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span>SocialTush 2.0 • Red Social de Nueva Generación</span>
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span className="text-emerald-400">WebSockets & WebRTC</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.1] max-w-4xl mb-6">
          Conecta sin límites.<br />
          <span className="gradient-text-cyan">La experiencia social del futuro.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 text-base sm:text-xl max-w-2xl mb-10 leading-relaxed font-normal">
          Chats ultrarrápidos en vivo, historias efímeras de 24h, feed multimedia en alta fidelidad y videollamadas fluidas en una plataforma con diseño hipermoderno.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 w-full mb-16">
          {user ? (
            <Link 
              href="/feed" 
              className="px-8 py-4 rounded-2xl gradient-btn-cyan text-sm flex items-center gap-2 shadow-xl shadow-cyan-500/20"
            >
              <span>Ir a mi Feed Principal</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link 
                href="/register" 
                className="px-8 py-4 rounded-2xl gradient-btn-cyan text-sm flex items-center gap-2.5 shadow-xl shadow-cyan-500/25 hover:scale-105"
              >
                <span>Empieza Gratis Ahora</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link 
                href="/login" 
                className="px-8 py-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900 text-slate-200 text-sm font-semibold transition-all hover:scale-105 backdrop-blur-md"
              >
                Explorar como Invitado
              </Link>
            </>
          )}
        </div>

        {/* Key Feature Stats Ticker */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 w-full max-w-4xl py-6 px-8 rounded-2xl glass-effect border border-slate-800/80 mb-16">
          <div className="flex flex-col items-center text-center">
            <span className="text-2xl sm:text-3xl font-black text-cyan-400">&lt; 15ms</span>
            <span className="text-xs text-slate-400 font-medium mt-0.5">Latencia WebSockets</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="text-2xl sm:text-3xl font-black text-teal-300">24 Horas</span>
            <span className="text-xs text-slate-400 font-medium mt-0.5">Historias Efímeras</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">4K HD</span>
            <span className="text-xs text-slate-400 font-medium mt-0.5">Multimedia en MinIO</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="text-2xl sm:text-3xl font-black text-cyan-300">100%</span>
            <span className="text-xs text-slate-400 font-medium mt-0.5">Cifrado & Seguridad</span>
          </div>
        </div>

        {/* Interactive App Mockup Showcase */}
        <div className="w-full max-w-5xl rounded-3xl p-3 sm:p-4 bg-gradient-to-b from-cyan-500/20 via-slate-800/40 to-slate-900/80 border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 backdrop-blur-2xl relative overflow-hidden group">
          {/* Top Mockup Titlebar */}
          <div className="w-full bg-slate-950/80 border-b border-slate-800/80 rounded-t-2xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="text-xs text-slate-400 font-mono ml-2">app.socialtush.com/feed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                ● En vivo
              </span>
            </div>
          </div>

          {/* Inner App Mockup Body */}
          <div className="bg-slate-950 p-4 sm:p-6 rounded-b-2xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-left">
            {/* Left Mockup Feed Column */}
            <div className="lg:col-span-7 space-y-4">
              {/* Stories Row Mock */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="h-12 w-12 rounded-full bg-slate-900 border border-dashed border-cyan-500/50 flex items-center justify-center text-cyan-400">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="text-[9px] text-slate-400">Tu historia</span>
                </div>
                {[
                  { name: 'Sophia', color: 'from-cyan-400 to-teal-400', initial: 'S' },
                  { name: 'Alex', color: 'from-teal-400 to-emerald-400', initial: 'A' },
                  { name: 'Marcos', color: 'from-purple-400 to-pink-400', initial: 'M' },
                  { name: 'Elena', color: 'from-amber-400 to-rose-400', initial: 'E' },
                ].map((st, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={`h-12 w-12 rounded-full p-[2px] bg-gradient-to-tr ${st.color}`}>
                      <div className="h-full w-full rounded-full bg-slate-950 flex items-center justify-center text-xs font-bold text-white">
                        {st.initial}
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-400">{st.name}</span>
                  </div>
                ))}
              </div>

              {/* Feed Card Mock */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center font-bold text-slate-950 text-xs">
                      SF
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">Alex Futurist</h4>
                      <span className="text-[10px] text-slate-500">Silicon Valley, CA • Hace 5 min</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 font-mono">
                    🎵 Daft Punk - Horizon
                  </span>
                </div>

                <div className="h-48 w-full rounded-xl bg-gradient-to-tr from-slate-900 via-teal-950 to-cyan-950 border border-slate-800 flex items-center justify-center relative overflow-hidden group/img">
                  <div className="absolute inset-0 bg-grid-pattern opacity-30" />
                  <div className="text-center p-4 relative z-10">
                    <Sparkles className="h-8 w-8 text-cyan-400 mx-auto mb-2 animate-bounce" />
                    <p className="text-xs font-semibold text-cyan-200">Rediseño Futurista SocialTush</p>
                    <p className="text-[10px] text-slate-400 mt-1">Experiencia visual optimizada en tiempo real</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-rose-400 font-semibold">
                      <Heart className="h-4 w-4 fill-rose-500 text-rose-500" /> 248
                    </span>
                    <span className="flex items-center gap-1 hover:text-slate-200 transition-colors cursor-pointer">
                      <MessageCircle className="h-4 w-4 text-cyan-400" /> 18 comentarios
                    </span>
                  </div>
                  <Bookmark className="h-4 w-4 text-slate-500 hover:text-cyan-400 transition-colors" />
                </div>
              </div>
            </div>

            {/* Right Floating Widgets Column */}
            <div className="lg:col-span-5 space-y-4">
              {/* WebSocket Chat Widget Mock */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 relative">
                <div className="flex items-center justify-between border-b border-slate-800/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-slate-200">Chat WebSocket en vivo</h4>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="flex justify-between text-[10px] text-cyan-400 font-bold mb-1">
                      <span>@sophia_loren</span>
                      <span className="text-slate-500">10:42 AM</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">¡Los nuevos componentes de historias y videollamadas quedaron increíbles! 🚀</p>
                  </div>

                  <div className="bg-cyan-500/10 border border-cyan-500/30 p-2.5 rounded-xl text-slate-200 text-[11px] ml-4">
                    <div className="flex justify-between text-[10px] text-cyan-300 font-bold mb-1">
                      <span>Tú</span>
                      <span className="text-cyan-400/60">10:43 AM ✓✓</span>
                    </div>
                    <p>Totalmente. La respuesta del servidor por WebSockets es instantánea.</p>
                  </div>
                </div>
              </div>

              {/* WebRTC Video Call Banner Mock */}
              <div className="bg-gradient-to-r from-teal-950/80 to-cyan-950/80 border border-cyan-500/40 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
                    <Video className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Videollamada HD WebRTC</h4>
                    <p className="text-[10px] text-cyan-300/80">Señalización en vivo disponible</p>
                  </div>
                </div>
                <button className="px-3 py-1.5 rounded-xl gradient-btn-cyan text-[11px]">
                  Unirse
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid Section */}
      <section className="w-full max-w-7xl mx-auto px-6 py-16 border-t border-slate-800/60 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold tracking-widest text-cyan-400 uppercase mb-3">
            Funcionalidades Principales
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Todo lo que necesitas en una sola plataforma social
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="glass-card-glow p-6 rounded-2xl group">
            <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5 group-hover:scale-110 transition-transform">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Mensajería en Tiempo Real</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Chats uno a uno y grupales con soporte de WebSockets, presencia online en vivo, indicadores de lectura y envío de multimedia.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-card-glow p-6 rounded-2xl group">
            <div className="h-12 w-12 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-5 group-hover:scale-110 transition-transform">
              <ImageIcon className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Historias Efímeras 24h</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Publica momentos con fotos, videos o textos con colores degradados, música de fondo y selector de mejores amigos.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-card-glow p-6 rounded-2xl group">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
              <Film className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Feed & Videos Cortos (Reels)</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Feed dinámico con carruseles multimedia y reproductor vertical estilo Reels con scroll suave y precarga optimizada.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass-card-glow p-6 rounded-2xl group">
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-5 group-hover:scale-110 transition-transform">
              <Video className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Videollamadas HD WebRTC</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Establece comunicación cara a cara al instante con señalización en vivo mediante sockets y controles de muteo y cámara.
            </p>
          </div>

          {/* Card 5 */}
          <div className="glass-card-glow p-6 rounded-2xl group">
            <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5 group-hover:scale-110 transition-transform">
              <User className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Perfiles & Solicitudes</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Gestión de cuentas públicas o privadas, aprobación de nuevos seguidores, edición de biografía y avatares personalizados.
            </p>
          </div>

          {/* Card 6 */}
          <div className="glass-card-glow p-6 rounded-2xl group">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
              <Shield className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Panel Administrativo</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Dashboard exclusivo para moderadores con gestión de usuarios suspendidos, métricas globales de uso y resolución de reportes.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Tabbed Section */}
      <section className="w-full max-w-5xl mx-auto px-6 py-12 relative z-10">
        <div className="glass-card-glow p-8 rounded-3xl space-y-8">
          <div className="flex flex-wrap items-center justify-center gap-3 border-b border-slate-800 pb-6">
            {[
              { id: 'CHAT', label: '💬 Mensajería WebSockets', icon: MessageSquare },
              { id: 'FEED', label: '📸 Historias & Feed', icon: ImageIcon },
              { id: 'REELS', label: '📹 Reels HD', icon: Film },
              { id: 'SECURITY', label: '🔒 Infraestructura', icon: Shield },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'gradient-btn-cyan shadow-lg shadow-cyan-500/20' 
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Display */}
          <div className="text-left max-w-3xl mx-auto space-y-4">
            {activeTab === 'CHAT' && (
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-white">Comunicación Instantánea sin Interrupciones</h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Utiliza STOMP sobre WebSockets respaldado por Redis para mantener estados de presencia online, notificaciones emergentes de mensajes no leídos y envío de notas de audio o multimedia.
                </p>
                <div className="flex gap-4 text-xs font-semibold text-cyan-400 pt-2">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Chats grupales e individuales</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Cifrado JWT seguro</span>
                </div>
              </div>
            )}

            {activeTab === 'FEED' && (
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-white">Publicaciones Visuales e Historias Efímeras</h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Sube carruseles de fotos en alta resolución almacenados en buckets públicos de MinIO Object Storage. Las historias expiran automáticamente tras 24 horas mediante tareas programadas.
                </p>
                <div className="flex gap-4 text-xs font-semibold text-teal-400 pt-2">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Likes e interacciones en vivo</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Almacenamiento S3 MinIO</span>
                </div>
              </div>
            )}

            {activeTab === 'REELS' && (
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-white">Videos Cortos Verticals Estilo Reels</h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Experiencia inmersiva en pantalla completa con controles táctiles, reproducción perezosa y precarga del siguiente elemento de la cola para una navegación rápida.
                </p>
                <div className="flex gap-4 text-xs font-semibold text-emerald-400 pt-2">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Swipe vertical fluido</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Comentarios integrados</span>
                </div>
              </div>
            )}

            {activeTab === 'SECURITY' && (
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-white">Arquitectura Escalable de Grado Empresarial</h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Construido sobre Spring Boot 3 con Java 21, base de datos relacional PostgreSQL 16 y caché de alto rendimiento en Redis, todo empaquetado en contenedores Docker.
                </p>
                <div className="flex gap-4 text-xs font-semibold text-cyan-400 pt-2">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> PostgreSQL 16</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Redis Cache</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* System Health Status Board */}
      <section className="w-full max-w-4xl mx-auto px-6 py-12 relative z-10">
        <div className="glass-card-glow p-6 sm:p-8 rounded-3xl">
          <div className="flex items-center justify-between mb-6 border-b border-slate-800/80 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-cyan-400" />
                Monitoreo de Infraestructura & Salud
              </h3>
              <p className="text-xs text-slate-400">Estado en tiempo real de los servicios locales</p>
            </div>
            <button 
              onClick={checkHealth}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-semibold text-slate-300 hover:text-cyan-300 rounded-xl transition-all flex items-center gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${backendStatus === 'LOADING' ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Verificar</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* DB Status */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">PostgreSQL 16</h4>
                  <p className="text-[10px] text-slate-500">Base de datos</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                dbStatus === 'UP' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {dbStatus}
              </span>
            </div>

            {/* Redis Status */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Redis Cache</h4>
                  <p className="text-[10px] text-slate-500">Sesiones y sockets</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                redisStatus === 'UP' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {redisStatus}
              </span>
            </div>

            {/* MinIO Storage */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">MinIO Storage</h4>
                  <p className="text-[10px] text-slate-500">Archivos multimedia</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                READY
              </span>
            </div>
          </div>

          {lastCheck && (
            <p className="text-[10px] text-slate-500 text-right mt-4 italic">
              Última comprobación de estado: {lastCheck}
            </p>
          )}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="w-full max-w-5xl mx-auto px-6 py-16 text-center relative z-10">
        <div className="bg-gradient-to-r from-cyan-950/90 via-teal-950/90 to-slate-950 border border-cyan-500/40 rounded-3xl p-10 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
          <h3 className="text-3xl font-black text-white mb-4">
            ¿Listo para explorar SocialTush?
          </h3>
          <p className="text-slate-300 text-sm max-w-xl mx-auto mb-8 leading-relaxed">
            Regístrate en segundos y experimenta el futuro de las redes sociales.
          </p>
          <div className="flex justify-center gap-4">
            <Link 
              href="/register" 
              className="px-8 py-3.5 rounded-xl gradient-btn-cyan text-xs flex items-center gap-2"
            >
              <span>Crear mi Cuenta Gratis</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 py-8 text-center text-xs text-slate-500 bg-slate-950/80 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center font-bold text-slate-950 text-xs">
              S
            </div>
            <span className="font-bold text-slate-300">SocialTush Platform</span>
          </div>
          <p>&copy; {new Date().getFullYear()} SocialTush. Diseñado con arquitectura futurista premium.</p>
          <div className="flex gap-4 text-slate-400 text-xs">
            <Link href="/feed" className="hover:text-cyan-400 transition-colors">Feed</Link>
            <Link href="/chat" className="hover:text-cyan-400 transition-colors">Chats</Link>
            <Link href="/reels" className="hover:text-cyan-400 transition-colors">Reels</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
