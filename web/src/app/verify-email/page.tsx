'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MailCheck, CheckCircle2, AlertCircle, RefreshCw, Send } from 'lucide-react';
import { api } from '@/context/AuthContext';

type State = 'waiting' | 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [state, setState] = useState<State>('waiting');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    setEmail(params.get('email') || '');
    if (!token) return;

    setState('verifying');
    api.post('/auth/verify-email', { token })
      .then(() => {
        setState('success');
        setMessage('Tu correo ya está verificado.');
      })
      .catch((error: any) => {
        setState('error');
        setMessage(error.response?.data?.message || 'No se pudo verificar el correo.');
      });
  }, []);

  const resend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setResending(true);
    setMessage('');
    try {
      await api.post('/auth/resend-verification', { email: email.trim() });
      setMessage('Si la cuenta necesita verificación, enviamos un nuevo enlace.');
      setState('waiting');
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'No se pudo reenviar el enlace.');
      setState('error');
    } finally {
      setResending(false);
    }
  };

  return <main className="min-h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-2xl"><div className="h-11 w-11 rounded-2xl bg-teal-500/15 text-teal-300 flex items-center justify-center mb-4"><MailCheck className="h-5 w-5"/></div><h1 className="text-2xl font-black text-white">Verifica tu correo</h1>{state === 'verifying' && <div className="mt-6 flex items-center gap-3 text-sm text-slate-300"><RefreshCw className="h-5 w-5 animate-spin text-teal-300"/>Verificando enlace...</div>}{state === 'success' && <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5"><div className="flex items-center gap-2 font-bold text-emerald-100"><CheckCircle2 className="h-5 w-5"/>{message}</div><p className="mt-2 text-xs text-emerald-200/80">Ahora inicia sesión. Si acabas de registrarte, después continuaremos con tu configuración inicial.</p><Link href="/login?verified=1" className="mt-5 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white">Iniciar sesión</Link></div>}{state !== 'success' && state !== 'verifying' && <><p className="mt-2 text-sm leading-6 text-slate-400">Revisa tu bandeja de entrada y abre el enlace que enviamos. También revisa Spam.</p>{message && <div className={`mt-4 flex gap-2 text-xs ${state === 'error' ? 'text-rose-300' : 'text-teal-200'}`}>{state === 'error' && <AlertCircle className="h-4 w-4 shrink-0"/>}{message}</div>}<form onSubmit={resend} className="mt-6 space-y-3"><label className="block text-xs font-semibold text-slate-300">¿Necesitas otro enlace?</label><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-teal-500"/><button disabled={resending} className="w-full rounded-xl border border-teal-700/60 bg-teal-950/30 py-3 text-sm font-bold text-teal-200 hover:bg-teal-900/40 disabled:opacity-60">{resending ? <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin"/>Enviando...</span> : <span className="inline-flex items-center gap-2">Reenviar verificación<Send className="h-4 w-4"/></span>}</button></form><div className="mt-5 text-center"><Link href="/login" className="text-xs font-bold text-cyan-300">Volver al login</Link></div></>}</div></main>;
}
