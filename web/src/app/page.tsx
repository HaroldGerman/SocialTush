'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, Compass, ShieldCheck } from 'lucide-react';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Automatic redirect for authenticated users
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/feed');
    }
  }, [user, isLoading, router]);

  // Loading state overlay during session restoration
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse" />
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-500 via-emerald-600 to-teal-800 flex items-center justify-center shadow-xl shadow-teal-950/50 animate-bounce">
          <span className="font-black text-white text-2xl tracking-tighter">S</span>
        </div>
        <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm font-medium">
          <span className="h-2 w-2 rounded-full bg-teal-500 animate-ping" />
          <span>Cargando SocialTush...</span>
        </div>
      </div>
    );
  }

  // Prevent rendering unauthenticated page if user is already logged in
  if (user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between relative overflow-hidden selection:bg-teal-500 selection:text-slate-950">
      {/* Signature SocialTush Ambient Emerald/Teal Blur Glows */}
      <div className="absolute top-[-15%] left-[50%] -translate-x-1/2 w-[700px] h-[700px] bg-teal-600/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[450px] h-[450px] bg-teal-700/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Subtle Grid Lines Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Top Header Placeholder / Spacing */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-500 via-emerald-600 to-teal-800 flex items-center justify-center shadow-lg shadow-teal-900/40">
            <span className="font-black text-white text-lg tracking-tighter">S</span>
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white">
            SocialTush
          </span>
        </div>
      </header>

      {/* Central Welcome Card Section */}
      <section className="w-full max-w-md mx-auto px-5 py-8 my-auto relative z-10 flex flex-col items-center">
        <div className="w-full bg-slate-900/70 border border-slate-800/80 rounded-3xl p-8 sm:p-10 backdrop-blur-2xl shadow-2xl shadow-slate-950/80 text-center flex flex-col items-center relative overflow-hidden">
          {/* Subtle Top Glow inside Card */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal-500/50 to-transparent" />

          {/* Large Brand Icon */}
          <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-teal-500 via-emerald-600 to-teal-800 flex items-center justify-center shadow-2xl shadow-teal-900/60 mb-6 border border-teal-400/30">
            <span className="font-black text-white text-4xl tracking-tighter">S</span>
          </div>

          {/* SocialTush Name */}
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
            SocialTush
          </h1>

          {/* Short Tagline */}
          <p className="text-teal-400 font-semibold text-sm sm:text-base mb-8 tracking-wide">
            Conecta. Comparte. Descubre.
          </p>

          {/* Action Buttons */}
          <div className="w-full space-y-3.5 mb-6">
            {/* Primary CTA: Login */}
            <Link
              href="/login"
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 hover:from-teal-500 hover:via-teal-600 hover:to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-900/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Iniciar sesión</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            {/* Secondary CTA: Register */}
            <Link
              href="/register"
              className="w-full py-3.5 px-6 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-teal-500/40 hover:bg-slate-900 text-slate-200 font-semibold text-sm flex items-center justify-center transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Crear una cuenta
            </Link>
          </div>

          {/* Discrete Guest Link */}
          <Link
            href="/feed"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-300 font-medium transition-colors py-1 group"
          >
            <Compass className="h-3.5 w-3.5 text-slate-500 group-hover:text-teal-400 transition-colors" />
            <span>Explorar como invitado</span>
          </Link>
        </div>
      </section>

      {/* Minimalist Footer */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-6 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 border-t border-slate-900/80">
        <p>&copy; {new Date().getFullYear()} SocialTush. Todos los derechos reservados.</p>
        
        <div className="flex items-center gap-6 font-medium">
          <Link href="/privacy" className="hover:text-teal-400 transition-colors">
            Privacidad
          </Link>
          <Link href="/terms" className="hover:text-teal-400 transition-colors">
            Términos
          </Link>
          <Link href="/help" className="hover:text-teal-400 transition-colors">
            Ayuda
          </Link>
        </div>
      </footer>
    </main>
  );
}
