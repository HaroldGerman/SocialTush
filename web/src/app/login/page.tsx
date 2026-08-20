'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, User, AlertCircle, ArrowLeft, ArrowRight, RefreshCw, MailCheck } from 'lucide-react';

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedNotice, setVerifiedNotice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setVerifiedNotice(params.get('verified') === '1');
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      const onboarding = sessionStorage.getItem('lifonk_onboarding_from_registration') === '1';
      router.replace(onboarding ? '/onboarding' : '/feed');
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const onboarding = sessionStorage.getItem('lifonk_onboarding_from_registration') === '1';
      await login(usernameOrEmail.trim(), password);
      router.replace(onboarding ? '/onboarding' : '/feed');
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !isSubmitting) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-cyan-400" /></div>;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-grid-pattern">
      <div className="absolute top-1/4 left-1/4 w-[450px] h-[450px] bg-cyan-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-teal-500/10 rounded-full blur-[130px] pointer-events-none" />
      <Link href="/" className="absolute top-6 left-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-300 bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800 z-20"><ArrowLeft className="h-4 w-4"/>Volver al Ritmo</Link>

      <div className="w-full max-w-md glass-card-glow rounded-3xl p-6 sm:p-8 relative z-10 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-8"><div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 via-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/25 mb-4"><span className="font-black text-slate-950 text-2xl">L</span></div><h1 className="text-2xl sm:text-3xl font-black text-white">Bienvenido de nuevo</h1><p className="text-slate-400 text-xs mt-1.5">Ingresa a tu cuenta de Lifonk</p></div>

        {verifiedNotice && <div className="mb-5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex gap-3"><MailCheck className="h-4 w-4 shrink-0"/><span>Correo verificado. Ya puedes iniciar sesión.</span></div>}
        {error && <div className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex gap-3"><AlertCircle className="h-4 w-4 shrink-0"/><div><span>{error}</span>{error.toLowerCase().includes('verifica tu correo') && <div className="mt-2"><Link href="/verify-email" className="font-bold text-cyan-300">Reenviar verificación</Link></div>}</div></div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5"><label className="text-xs font-semibold text-slate-300">Nombre de usuario o Email</label><div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"/><input required value={usernameOrEmail} onChange={e => setUsernameOrEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-cyan-500/80"/></div></div>
          <div className="space-y-1.5"><div className="flex justify-between"><label className="text-xs font-semibold text-slate-300">Contraseña</label><Link href="/forgot-password" className="text-[11px] text-cyan-400 hover:text-cyan-300">¿Olvidaste tu contraseña?</Link></div><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"/><input required type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-11 pr-11 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-cyan-500/80"/><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></div></div>
          <button type="submit" disabled={isSubmitting} className="w-full py-3.5 rounded-xl gradient-btn-cyan text-xs flex items-center justify-center gap-2 disabled:opacity-60">{isSubmitting ? <><RefreshCw className="h-4 w-4 animate-spin"/>Iniciando...</> : <>Entrar a Lifonk<ArrowRight className="h-4 w-4"/></>}</button>
        </form>
        <div className="mt-7 text-center text-xs text-slate-400 border-t border-slate-800/60 pt-4">¿Aún no tienes una cuenta? <Link href="/register" className="text-cyan-400 font-bold">Regístrate</Link></div>
      </div>
    </main>
  );
}
