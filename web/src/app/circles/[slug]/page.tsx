'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { 
  Users, MapPin, Globe, Compass, MessageCircle, ArrowLeft, 
  CheckCircle2, UserPlus, Send, Sparkles, Image, Shield, Flame
} from 'lucide-react';

interface CircleDetail {
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

export default function CircleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { user } = useAuth();

  const [circle, setCircle] = useState<CircleDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [postText, setPostText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchCircleDetail();
    }
  }, [slug]);

  const fetchCircleDetail = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/circles/${slug}`);
      setCircle(res.data);
    } catch (e) {
      console.error('Error fetching circle', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinToggle = async () => {
    if (!circle) return;
    try {
      if (circle.isMember) {
        await api.post(`/circles/${circle.id}/leave`);
      } else {
        await api.post(`/circles/${circle.id}/join`);
      }
      fetchCircleDetail();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al cambiar membresía');
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim()) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('caption', `[${circle?.name}] ${postText.trim()}`);
      await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPostText('');
      alert('Momento publicado en el círculo');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al publicar momento');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="h-10 w-10 bg-teal-600 rounded-xl" />
          <span className="text-slate-500 text-xs font-semibold">Cargando Círculo...</span>
        </div>
      </div>
    );
  }

  if (!circle) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-sm border border-slate-200">
          <Users className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">Círculo no encontrado</h2>
          <p className="text-xs text-slate-500">
            El círculo que intentas visitar no existe o ha sido movido.
          </p>
          <Link href="/circles" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Círculos</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-800 font-sans">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-teal-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/circles" className="inline-flex items-center gap-2 text-xs font-bold text-teal-800 hover:text-teal-900 bg-teal-50 px-3 py-1.5 rounded-xl">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Círculos</span>
          </Link>

          <span className="font-bold text-sm text-slate-900 line-clamp-1">
            {circle.name}
          </span>

          <button
            onClick={handleJoinToggle}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              circle.isMember
                ? 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-600'
                : 'bg-teal-700 text-white hover:bg-teal-800 shadow-md'
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
      </header>

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-teal-800 to-emerald-700 text-white py-12 px-4 shadow-md">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-black text-3xl shadow-xl shrink-0">
              {circle.name.charAt(0)}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-teal-100 font-bold text-[10px] uppercase">
                  {circle.type}
                </span>
                {circle.city && (
                  <span className="flex items-center gap-1 text-xs text-teal-200">
                    <MapPin className="w-3.5 h-3.5" />
                    {circle.city}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {circle.name}
              </h1>
              <p className="text-teal-100 text-xs sm:text-sm max-w-xl">
                {circle.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/15 text-center">
            <div>
              <span className="block text-xl font-black text-white">{circle.membersCount}</span>
              <span className="text-[11px] text-teal-200 font-medium">Miembros</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <span className="block text-xl font-black text-teal-300">
                {circle.activeNowCount > 0 ? circle.activeNowCount : 1}
              </span>
              <span className="text-[11px] text-teal-200 font-medium">Hablando ahora</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Moment Creation & Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Moment Creation Card */}
          <div className="bg-white rounded-3xl p-5 border border-teal-100/80 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Publicar Momento en {circle.name}</span>
            </h3>

            <form onSubmit={handlePostSubmit} className="space-y-3">
              <textarea
                rows={3}
                placeholder="¿Qué quieres compartir o preguntar en este círculo?"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                className="w-full p-3 rounded-2xl text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
              />
              <div className="flex items-center justify-between">
                <button type="button" className="text-slate-400 hover:text-teal-600 text-xs font-semibold flex items-center gap-1">
                  <Image className="w-4 h-4" />
                  <span>Foto/Video</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !postText.trim()}
                  className="px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Publicar</span>
                </button>
              </div>
            </form>
          </div>

          {/* Circle Feed Placeholder */}
          <div className="bg-white rounded-3xl p-8 border border-teal-100/80 shadow-xs text-center space-y-3">
            <MessageCircle className="w-10 h-10 text-teal-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">Conversaciones del Círculo</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Este círculo está activo. Sé el primero en iniciar una conversación compartiendo un momento o duda arriba.
            </p>
          </div>
        </div>

        {/* Right Sidebar: Rules & Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-teal-100/80 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-600" />
              <span>Reglas del Círculo</span>
            </h3>
            <ul className="text-xs text-slate-600 space-y-2.5 font-normal">
              <li className="flex items-start gap-2">
                <span className="text-teal-600 font-bold">1.</span>
                <span>Mantener conversaciones respetuosas y enfocadas en la temática.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-600 font-bold">2.</span>
                <span>Fomentar los encuentros y proyectos en la comunidad local.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-600 font-bold">3.</span>
                <span>No spam ni promociones no autorizadas.</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
