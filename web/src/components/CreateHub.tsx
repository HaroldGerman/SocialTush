'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart3, X, Sparkles, Film, Compass, Zap } from 'lucide-react';

interface CreateHubProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMomento: () => void;
  onSelectHistoria: () => void;
  onSelectPulso: () => void;
  onSelectCirculo: () => void;
}

export default function CreateHub({
  isOpen,
  onClose,
  onSelectMomento,
  onSelectHistoria,
  onSelectPulso,
  onSelectCirculo
}: CreateHubProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 text-slate-800 dark:text-slate-100">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full md:max-w-sm bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-t-3xl md:rounded-3xl p-6 shadow-2xl z-10 flex flex-col pb-safe animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">¿Qué quieres crear?</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <button onClick={() => { onSelectPulso(); onClose(); }} className="w-full flex items-center gap-4 p-4 bg-[linear-gradient(135deg,rgba(20,184,166,.12),rgba(14,116,144,.08))] hover:bg-teal-50 dark:hover:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-2xl text-left transition-colors">
            <div className="p-3 rounded-xl bg-teal-600 text-white shadow-md shadow-teal-900/20"><Zap className="w-5 h-5" /></div>
            <div><div className="flex items-center gap-2"><h4 className="font-black text-sm text-slate-900 dark:text-white">Pulso</h4><span className="rounded-full bg-teal-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">Video corto</span></div><p className="text-[11px] text-slate-500">Recorta hasta 60 s, elige portada y llega a gente nueva</p></div>
          </button>

          <button onClick={() => { onSelectMomento(); onClose(); }} className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl text-left transition-colors">
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400"><Sparkles className="w-5 h-5" /></div>
            <div><h4 className="font-bold text-sm text-slate-900 dark:text-white">✨ Contribución</h4><p className="text-[11px] text-slate-500">Publica texto, foto o video en Ritmo</p></div>
          </button>

          <button onClick={() => { onSelectHistoria(); onClose(); }} className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl text-left transition-colors">
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400"><Film className="w-5 h-5" /></div>
            <div><h4 className="font-bold text-sm text-slate-900 dark:text-white">◉ Momento</h4><p className="text-[11px] text-slate-500">Contenido espontáneo que dura 24 horas</p></div>
          </button>

          <button onClick={() => { onSelectCirculo(); onClose(); }} className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl text-left transition-colors">
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400"><Compass className="w-5 h-5" /></div>
            <div><h4 className="font-bold text-sm text-slate-900 dark:text-white">◎ Círculo</h4><p className="text-[11px] text-slate-500">Crea un nuevo círculo de interés</p></div>
          </button>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Link href="/pulse/studio" onClick={onClose} className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"><span className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-teal-500"/>Estudio Pulso</span><span className="text-[9px] font-bold text-slate-400">Tus métricas privadas</span></Link>
        </div>
      </div>
    </div>
  );
}
