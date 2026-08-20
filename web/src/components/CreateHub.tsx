'use client';

import React from 'react';
import { X, Sparkles, Film, Compass } from 'lucide-react';

interface CreateHubProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMomento: () => void;
  onSelectHistoria: () => void;
  onSelectCirculo: () => void;
}

export default function CreateHub({
  isOpen,
  onClose,
  onSelectMomento,
  onSelectHistoria,
  onSelectCirculo
}: CreateHubProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 text-slate-800 dark:text-slate-100">
      {/* Click overlay to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full md:max-w-sm bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-t-3xl md:rounded-3xl p-6 shadow-2xl z-10 flex flex-col pb-safe animate-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">¿Qué quieres crear?</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <button
            onClick={() => { onSelectMomento(); onClose(); }}
            className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl text-left transition-colors"
          >
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">✨ Momento</h4>
              <p className="text-[11px] text-slate-500">Publica texto, foto o video en el Feed</p>
            </div>
          </button>

          <button
            onClick={() => { onSelectHistoria(); onClose(); }}
            className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl text-left transition-colors"
          >
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">◉ Historia</h4>
              <p className="text-[11px] text-slate-500">Foto, cámara, stickers, texto o música</p>
            </div>
          </button>

          <button
            onClick={() => { onSelectCirculo(); onClose(); }}
            className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl text-left transition-colors"
          >
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">◎ Círculo</h4>
              <p className="text-[11px] text-slate-500">Crea una nueva comunidad de interés</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
