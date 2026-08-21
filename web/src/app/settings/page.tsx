'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronRight, Languages, Moon, Settings, ShieldCheck, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import MobileBottomBar from '@/components/MobileBottomBar';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-[100dvh] bg-[#f4f7f7] pb-24 text-slate-900 dark:bg-[#07151d] dark:text-white">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 pb-3 pt-[calc(.7rem+env(safe-area-inset-top))] backdrop-blur-xl dark:border-slate-800 dark:bg-[#0f172a]/95">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          <button onClick={() => router.back()} aria-label="Volver" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300"><ArrowLeft className="h-5 w-5"/></button>
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-600 dark:text-teal-400">Lifonk</p><h1 className="text-lg font-black leading-none">Ajustes</h1></div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl space-y-4 px-3 py-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
          <div className="mb-3 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"><Settings className="h-5 w-5"/></div><div><h2 className="font-black">Tu experiencia</h2><p className="text-xs text-slate-500 dark:text-slate-400">Personaliza Lifonk sin mezclarlo con seguridad de la cuenta.</p></div></div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <Link href="/settings/language" className="flex items-center gap-3 border-b border-slate-200 px-4 py-4 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
              <Languages className="h-5 w-5 text-teal-600"/>
              <div className="min-w-0 flex-1"><p className="text-sm font-black">Idioma</p><p className="text-xs text-slate-500 dark:text-slate-400">Español o English</p></div>
              <ChevronRight className="h-4 w-4 text-slate-400"/>
            </Link>

            <button type="button" onClick={toggleTheme} className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
              {theme === 'light' ? <Moon className="h-5 w-5 text-teal-600"/> : <Sun className="h-5 w-5 text-teal-400"/>}
              <div className="min-w-0 flex-1"><p className="text-sm font-black">Apariencia</p><p className="text-xs text-slate-500 dark:text-slate-400">Ahora: {theme === 'light' ? 'Claro' : 'Oscuro'}</p></div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">Cambiar</span>
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Cuenta</p>
          <Link href="/settings/security" className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
            <ShieldCheck className="h-5 w-5 text-teal-600"/>
            <div className="min-w-0 flex-1"><p className="text-sm font-black">Seguridad</p><p className="text-xs text-slate-500 dark:text-slate-400">Contraseña, sesiones y eliminación de cuenta</p></div>
            <ChevronRight className="h-4 w-4 text-slate-400"/>
          </Link>
        </section>
      </main>

      <MobileBottomBar />
    </div>
  );
}
