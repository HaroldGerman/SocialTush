'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Languages, Loader2 } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import { useLanguage, type LifonkLanguage } from '@/context/LanguageContext';

export default function LanguageSettingsPage() {
  const { user, isLoading } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [selected, setSelected] = useState<LifonkLanguage>(language);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setSelected(language), [language]);

  useEffect(() => {
    if (!user) return;
    api.get('/profiles/me/language')
      .then(response => {
        const value: LifonkLanguage = response.data?.preferredLanguage === 'en' ? 'en' : 'es';
        setSelected(value);
        setLanguage(value);
      })
      .catch(() => {});
  }, [user]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await api.put('/profiles/me/language', { preferredLanguage: selected });
      setLanguage(selected);
      setSaved(true);
    } catch (err: any) {
      setError(err.response?.data?.message || (language === 'en' ? 'Could not save the language.' : 'No se pudo guardar el idioma.'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="min-h-[100dvh] flex items-center justify-center bg-[#f4f7f7] dark:bg-[#07151d]"><Loader2 className="h-6 w-6 animate-spin text-teal-500"/></div>;

  return (
    <main className="min-h-[100dvh] bg-[#f4f7f7] px-4 py-6 text-slate-900 dark:bg-[#07151d] dark:text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/feed" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0f172a]"><ArrowLeft className="h-5 w-5"/></Link>
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-600 dark:text-teal-400">Lifonk</p><h1 className="text-xl font-black">{t('languageSettings')}</h1></div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
          <div className="mb-5 flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"><Languages className="h-5 w-5"/></div><div><h2 className="font-black">{t('language')}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('languageSettingsHint')}</p></div></div>

          <div className="space-y-3">
            {([
              ['es', `🇪🇸 ${t('spanish')}`],
              ['en', `🇺🇸 ${t('english')}`],
            ] as Array<[LifonkLanguage, string]>).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setSelected(value)} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left text-sm font-bold transition ${selected === value ? 'border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-950/30 dark:text-teal-200' : 'border-slate-200 dark:border-slate-700'}`}>
                <span>{label}</span>{selected === value && <Check className="h-5 w-5"/>}
              </button>
            ))}
          </div>

          {error && <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>}
          {saved && <p className="mt-3 text-xs font-semibold text-emerald-600">{t('saved')}</p>}

          <button onClick={() => void save()} disabled={saving || !user} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 py-3 text-sm font-black text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin"/>}{t('save')}</button>
        </section>
      </div>
    </main>
  );
}
