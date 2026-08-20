'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '@/context/AuthContext';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!token) return setError('El enlace no contiene un token válido.');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
      sessionStorage.removeItem('lifonk_onboarding_from_registration');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return <main className="min-h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-2xl"><div className="h-11 w-11 rounded-2xl bg-teal-500/15 text-teal-300 flex items-center justify-center mb-4"><Lock className="h-5 w-5"/></div><h1 className="text-2xl font-black text-white">Nueva contraseña</h1><p className="mt-2 mb-7 text-sm text-slate-400">Crea una contraseña nueva para tu cuenta de Lifonk.</p>{success ? <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5"><div className="flex items-center gap-2 font-bold text-emerald-100"><CheckCircle2 className="h-5 w-5"/>Contraseña actualizada</div><p className="mt-2 text-xs text-emerald-200/80">Las sesiones anteriores quedaron revocadas. Inicia sesión con tu nueva contraseña.</p><Link href="/login" className="mt-5 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white">Ir a iniciar sesión</Link></div> : <form onSubmit={submit} className="space-y-4"><PasswordField label="Nueva contraseña" value={password} setValue={setPassword} show={show} setShow={setShow}/><PasswordField label="Confirmar contraseña" value={confirm} setValue={setConfirm} show={show} setShow={setShow}/>{error && <div className="flex gap-2 text-xs text-rose-300"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</div>}<button disabled={loading} className="w-full rounded-xl bg-teal-700 py-3 text-sm font-bold text-white hover:bg-teal-600 disabled:opacity-60">{loading ? <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin"/>Actualizando...</span> : 'Cambiar contraseña'}</button></form>}</div></main>;
}

function PasswordField({ label, value, setValue, show, setShow }: { label: string; value: string; setValue: (value: string) => void; show: boolean; setShow: (value: boolean) => void }) {
  return <div><label className="mb-1.5 block text-xs font-semibold text-slate-300">{label}</label><div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"/><input required minLength={8} maxLength={128} type={show ? 'text' : 'password'} value={value} onChange={e => setValue(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-950 py-3 pl-11 pr-11 text-sm outline-none focus:border-teal-500"/><button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">{show ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></div></div>;
}
