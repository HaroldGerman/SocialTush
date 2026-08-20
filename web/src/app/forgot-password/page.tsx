'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '@/context/AuthContext';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'No pudimos procesar la solicitud.');
    } finally {
      setLoading(false);
    }
  };

  return <main className="min-h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center p-4">
    <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-2xl">
      <Link href="/login" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-300"><ArrowLeft className="h-4 w-4"/>Volver al login</Link>
      <div className="mt-6 mb-7"><div className="h-11 w-11 rounded-2xl bg-teal-500/15 text-teal-300 flex items-center justify-center mb-4"><Mail className="h-5 w-5"/></div><h1 className="text-2xl font-black text-white">Recupera tu acceso</h1><p className="mt-2 text-sm leading-6 text-slate-400">Ingresa el correo asociado a tu cuenta. Si existe, te enviaremos un enlace seguro.</p></div>
      {sent ? <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-sm text-emerald-100"><div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5"/>Revisa tu correo</div><p className="mt-2 text-xs leading-5 text-emerald-200/80">Si existe una cuenta asociada, el enlace llegará en breve y caducará en 20 minutos.</p><button onClick={() => setSent(false)} className="mt-4 text-xs font-bold text-cyan-300">Enviar nuevamente</button></div> : <form onSubmit={submit} className="space-y-4"><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"/><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" className="w-full rounded-xl border border-slate-800 bg-slate-950 py-3 pl-11 pr-4 text-sm outline-none focus:border-teal-500"/></div>{error && <div className="flex gap-2 text-xs text-rose-300"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</div>}<button disabled={loading} className="w-full rounded-xl bg-teal-700 py-3 text-sm font-bold text-white hover:bg-teal-600 disabled:opacity-60">{loading ? <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin"/>Enviando...</span> : <span className="inline-flex items-center gap-2">Enviar enlace<Send className="h-4 w-4"/></span>}</button></form>}
    </div>
  </main>;
}
