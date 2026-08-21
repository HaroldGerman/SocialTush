'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage, type LifonkLanguage } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, Tag, AlertCircle, ArrowLeft, ArrowRight, RefreshCw, Languages } from 'lucide-react';

export default function RegisterPage() {
  const { register, user, isLoading } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const registrationInProgressRef = useRef(false);

  useEffect(() => {
    if (!isLoading && user && !registrationInProgressRef.current) router.replace('/feed');
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t('passwordMin'));
      return;
    }
    setIsSubmitting(true);
    registrationInProgressRef.current = true;

    try {
      const normalizedEmail = email.trim();
      await register(normalizedEmail, username.trim(), displayName.trim(), password, language);
      sessionStorage.setItem('lifonk_onboarding_from_registration', '1');
      router.replace(`/verify-email?sent=1&email=${encodeURIComponent(normalizedEmail)}`);
    } catch (err: any) {
      registrationInProgressRef.current = false;
      setError(err.message || t('registerError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectLanguage = (value: LifonkLanguage) => {
    setLanguage(value);
    setError(null);
  };

  if (isLoading && !registrationInProgressRef.current) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-cyan-400" /></div>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden bg-grid-pattern">
      <div className="absolute top-1/4 left-1/4 w-[450px] h-[450px] bg-cyan-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none" />
      <Link href="/" className="absolute top-6 left-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-cyan-300 bg-slate-900/80 px-3.5 py-2 rounded-xl border border-slate-800 z-20"><ArrowLeft className="h-4 w-4" />{t('back')}</Link>

      <div className="w-full max-w-md glass-card-glow rounded-3xl p-6 sm:p-8 relative z-10 shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 via-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/25 mb-4"><span className="font-black text-slate-950 text-2xl">L</span></div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">{t('registerTitle')}</h1>
          <p className="text-slate-400 text-xs mt-1.5">{t('registerSubtitle')}</p>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-300"><Languages className="h-4 w-4 text-cyan-400" />{t('language')}</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => selectLanguage('es')} className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${language === 'es' ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>🇪🇸 {t('spanish')}</button>
            <button type="button" onClick={() => selectLanguage('en')} className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${language === 'en' ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>🇺🇸 {t('english')}</button>
          </div>
        </div>

        {error && <div className="mb-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex gap-3"><AlertCircle className="h-4 w-4 shrink-0"/><span>{error}</span></div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label={t('publicName')} icon={<Tag className="h-4 w-4"/>}><input required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={language === 'en' ? 'e.g. Carlos Perez' : 'ej: Carlos Pérez'} className="field-input" /></Field>
          <Field label={t('username')} icon={<User className="h-4 w-4"/>}><input required value={username} onChange={e => setUsername(e.target.value)} placeholder={language === 'en' ? 'e.g. user_A' : 'ej: usuario_A'} className="field-input" /></Field>
          <Field label={t('email')} icon={<Mail className="h-4 w-4"/>}><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ej: usuario@mail.com" className="field-input" /></Field>
          <Field label={t('password')} icon={<Lock className="h-4 w-4"/>}><input required minLength={8} maxLength={128} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('passwordHint')} className="field-input" /></Field>
          <button type="submit" disabled={isSubmitting} className="w-full py-3.5 mt-4 rounded-xl gradient-btn-cyan text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-60">
            {isSubmitting ? <><RefreshCw className="h-4 w-4 animate-spin"/>{t('creatingAccount')}</> : <>{t('createAccount')}<ArrowRight className="h-4 w-4"/></>}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400 pt-4 border-t border-slate-800/60">{t('alreadyAccount')} <Link href="/login" className="text-cyan-400 font-bold">{t('signIn')}</Link></div>
      </div>
      <style jsx>{`.field-input{width:100%;padding:.625rem 1rem .625rem 2.75rem;border-radius:.75rem;background:rgba(2,6,23,.8);border:1px solid #1e293b;color:#f1f5f9;font-size:.75rem;outline:none}.field-input:focus{border-color:rgba(6,182,212,.8);box-shadow:0 0 0 2px rgba(6,182,212,.15)}`}</style>
    </main>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-xs font-semibold text-slate-300">{label}</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">{icon}</span>{children}</div></div>;
}
