'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, LogOut, MailCheck, Monitor, RefreshCw, ShieldCheck, Smartphone, Tablet, Trash2 } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import MobileBottomBar from '@/components/MobileBottomBar';

interface DeviceSession {
  sessionKey?: string | null;
  label: string;
  deviceType: 'MOBILE' | 'TABLET' | 'DESKTOP' | 'UNKNOWN' | string;
  createdAt?: string;
  lastActiveAt?: string;
  expiresAt?: string;
  current: boolean;
}

interface SecurityStatus {
  email: string;
  verified: boolean;
  activeSessions: number;
  sessions: DeviceSession[];
  createdAt?: string;
}

export default function SecuritySettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changing, setChanging] = useState(false);

  const [logoutPassword, setLogoutPassword] = useState('');
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.get('/auth/security')
      .then(response => setStatus(response.data))
      .catch(requestError => setError(requestError.response?.data?.message || 'No se pudo cargar la seguridad de tu cuenta.'))
      .finally(() => setLoading(false));
  }, [user]);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (newPassword.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres.');
    if (newPassword !== confirmPassword) return setError('Las contraseñas nuevas no coinciden.');
    setChanging(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setNotice('Contraseña actualizada. Por seguridad cerramos todas tus sesiones.');
      setTimeout(() => { window.location.href = '/login'; }, 900);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setChanging(false);
    }
  };

  const logoutAll = async () => {
    setError('');
    setNotice('');
    if (!logoutPassword) return setError('Confirma tu contraseña para cerrar todas las sesiones.');
    setLoggingOutAll(true);
    try {
      await api.post('/auth/logout-all', { currentPassword: logoutPassword });
      setNotice('Todas las sesiones fueron cerradas.');
      setTimeout(() => { window.location.href = '/login'; }, 700);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'No se pudieron cerrar las sesiones.');
    } finally {
      setLoggingOutAll(false);
    }
  };

  const deleteAccount = async () => {
    setError('');
    if (deleteConfirmation.trim().toUpperCase() !== 'ELIMINAR') {
      return setError('Escribe ELIMINAR para confirmar.');
    }
    setDeleting(true);
    try {
      await api.delete('/auth/account', {
        data: { currentPassword: deletePassword, confirmation: deleteConfirmation }
      });
      window.location.href = '/';
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'No se pudo eliminar la cuenta.');
      setDeleting(false);
    }
  };

  if (isLoading || loading) {
    return <main className="min-h-[100dvh] bg-[#f4f6f9] dark:bg-[#090d16] flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-teal-700" /></main>;
  }
  if (!user) return null;

  const sessions = status?.sessions || [];

  return (
    <div className="min-h-[100dvh] bg-[#f4f6f9] pb-20 text-slate-800 dark:bg-[#090d16] dark:text-slate-100 md:pb-8">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-[#0f172a]/95">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-teal-700 dark:text-teal-400"/><div><h1 className="text-sm font-black">Seguridad de la cuenta</h1><p className="text-[10px] text-slate-400">Protege tu acceso a Lifonk</p></div></div>
          <Link href={`/profile/${user.username}`} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">Volver</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}
        {notice && <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4"/>{notice}</div>}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
          <div className="flex items-center gap-3"><MailCheck className="h-5 w-5 text-teal-700"/><div className="min-w-0"><h2 className="text-sm font-black">Correo de recuperación</h2><p className="truncate text-xs text-slate-500 dark:text-slate-400">{status?.email}</p></div><span className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-black ${status?.verified ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>{status?.verified ? 'Verificado' : 'Sin verificar'}</span></div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
          <div className="mb-5 flex items-center gap-3"><KeyRound className="h-5 w-5 text-teal-700"/><div><h2 className="text-sm font-black">Cambiar contraseña</h2><p className="text-xs text-slate-500 dark:text-slate-400">Al cambiarla se cerrarán todas las sesiones existentes.</p></div></div>
          <form onSubmit={changePassword} className="space-y-3">
            <PasswordInput label="Contraseña actual" value={currentPassword} onChange={setCurrentPassword} show={showPasswords} />
            <PasswordInput label="Nueva contraseña" value={newPassword} onChange={setNewPassword} show={showPasswords} />
            <PasswordInput label="Confirmar nueva contraseña" value={confirmPassword} onChange={setConfirmPassword} show={showPasswords} />
            <div className="flex items-center justify-between gap-3 pt-1"><button type="button" onClick={() => setShowPasswords(value => !value)} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">{showPasswords ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}{showPasswords ? 'Ocultar' : 'Mostrar'} contraseñas</button><button disabled={changing} className="rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{changing ? 'Actualizando…' : 'Cambiar contraseña'}</button></div>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
          <div className="mb-4 flex items-center gap-3"><LogOut className="h-5 w-5 text-teal-700"/><div><h2 className="text-sm font-black">Sesiones y dispositivos</h2><p className="text-xs text-slate-500 dark:text-slate-400"><strong>{status?.activeSessions ?? 0}</strong> {(status?.activeSessions ?? 0) === 1 ? 'sesión activa' : 'sesiones activas'}</p></div></div>

          <div className="mb-5 space-y-2.5">
            {sessions.map((session, index) => (
              <div key={session.sessionKey || `${session.label}-${index}`} className={`flex items-center gap-3 rounded-2xl border p-3.5 ${session.current ? 'border-teal-300 bg-teal-50/70 dark:border-teal-800 dark:bg-teal-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60'}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${session.current ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300' : 'bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                  <SessionIcon type={session.deviceType} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="truncate text-xs font-black text-slate-800 dark:text-slate-100">{session.label}</p>{session.current && <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[9px] font-black text-white">Este dispositivo</span>}</div>
                  <p className="mt-0.5 text-[10px] text-slate-400">Última actividad: {formatSessionTime(session.lastActiveAt || session.createdAt)}</p>
                </div>
              </div>
            ))}
            {!sessions.length && <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">No encontramos sesiones vigentes.</p>}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row"><input type="password" value={logoutPassword} onChange={event => setLogoutPassword(event.target.value)} placeholder="Confirma tu contraseña" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-900"/><button onClick={() => void logoutAll()} disabled={loggingOutAll} className="rounded-xl border border-teal-700 px-4 py-3 text-xs font-bold text-teal-800 disabled:opacity-60 dark:text-teal-300">{loggingOutAll ? 'Cerrando…' : 'Cerrar sesión en todos los dispositivos'}</button></div>
          <p className="mt-3 text-[10px] leading-4 text-slate-400">Solo se cuentan sesiones no revocadas y que todavía no han caducado. Lifonk identifica este navegador con un ID local aleatorio; no usa ubicación para este listado.</p>
        </section>

        <section className="rounded-3xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-900/70 dark:bg-[#0f172a]">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600"/><div className="flex-1"><h2 className="text-sm font-black text-rose-700 dark:text-rose-400">Zona de riesgo</h2><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Eliminar tu cuenta borra permanentemente tu perfil y los datos asociados. Las contribuciones, momentos, mensajes enviados y círculos que hayas creado pueden desaparecer. No se puede deshacer.</p><button onClick={() => setDeleteOpen(true)} className="mt-4 flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500"><Trash2 className="h-4 w-4"/>Eliminar cuenta</button></div></div>
        </section>
      </main>

      {deleteOpen && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4" onClick={() => !deleting && setDeleteOpen(false)}><div className="w-full max-w-md rounded-t-3xl border border-rose-900/50 bg-white p-6 shadow-2xl dark:bg-[#0f172a] sm:rounded-3xl" onClick={event => event.stopPropagation()}><div className="mb-5 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950"><Trash2 className="h-5 w-5"/></div><div><h3 className="font-black">Eliminar cuenta permanentemente</h3><p className="text-xs text-slate-500">Esta acción no se puede deshacer.</p></div></div><div className="space-y-3"><input type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} placeholder="Contraseña actual" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-900"/><input value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} placeholder="Escribe ELIMINAR" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold uppercase outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-900"/><div className="flex gap-3 pt-2"><button disabled={deleting} onClick={() => setDeleteOpen(false)} className="flex-1 rounded-xl border border-slate-300 py-3 text-xs font-bold dark:border-slate-700">Cancelar</button><button disabled={deleting || !deletePassword || deleteConfirmation.trim().toUpperCase() !== 'ELIMINAR'} onClick={() => void deleteAccount()} className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-black text-white disabled:opacity-40">{deleting ? 'Eliminando…' : 'Eliminar para siempre'}</button></div></div></div></div>}

      <MobileBottomBar />
    </div>
  );
}

function SessionIcon({ type }: { type: string }) {
  if (type === 'MOBILE') return <Smartphone className="h-5 w-5" />;
  if (type === 'TABLET') return <Tablet className="h-5 w-5" />;
  return <Monitor className="h-5 w-5" />;
}

function formatSessionTime(value?: string) {
  if (!value) return 'sin datos';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'sin datos';
  return date.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

function PasswordInput({ label, value, onChange, show }: { label: string; value: string; onChange: (value: string) => void; show: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{label}</span><div className="relative"><LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input required minLength={8} maxLength={128} type={show ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-xs outline-none focus:border-teal-600 dark:border-slate-700 dark:bg-slate-900"/></div></label>;
}
