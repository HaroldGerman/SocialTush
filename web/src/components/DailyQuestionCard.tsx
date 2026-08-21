'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight, MessageCircleQuestion, Sparkles } from 'lucide-react';
import { api } from '@/context/AuthContext';

const DAILY_QUESTIONS = [
  '¿Qué pequeña cosa te hizo sonreír hoy?',
  '¿Qué canción describe mejor tu día?',
  'Si pudieras aprender algo instantáneamente, ¿qué elegirías?',
  '¿Cuál es un lugar al que siempre quieres volver?',
  '¿Qué hábito te gustaría mantener durante un año?',
  '¿Qué consejo te habría gustado escuchar hace cinco años?',
  '¿Qué comida podrías repetir toda una semana?',
  '¿Qué película o serie recomendarías sin pensarlo?',
  '¿Qué meta pequeña quieres completar esta semana?',
  '¿Qué persona te inspira últimamente y por qué?',
  '¿Cuál fue la mejor decisión que tomaste este mes?',
  '¿Qué te gustaría que existiera y todavía nadie haya creado?',
  '¿Qué harías mañana si supieras que no puedes fallar?',
  '¿Qué detalle hace que confíes en una persona?',
  '¿Qué habilidad crees que todo el mundo debería aprender?',
  '¿Qué momento reciente guardarías para siempre?',
  '¿Qué aplicación usas más de lo que te gustaría admitir?',
  '¿Qué te motiva cuando no tienes ganas de empezar?',
  '¿Qué lugar de tu ciudad merece más reconocimiento?',
  '¿Qué cosa simple mejora inmediatamente tu día?',
  '¿Qué estás intentando aprender ahora mismo?',
  '¿Qué cambiarías de las redes sociales actuales?',
  '¿Cuál es tu forma favorita de desconectarte?',
  '¿Qué sueño estás construyendo poco a poco?',
  '¿Qué te gustaría preguntarle a tu yo del futuro?',
  '¿Qué recuerdo siempre consigue hacerte reír?',
  '¿Qué valor aprecias más en una amistad?',
  '¿Qué descubrimiento reciente quieres compartir con otros?',
  '¿Cómo sería para ti un día perfecto?',
  '¿Qué quieres agradecer hoy?'
];

interface DailyQuestionCardProps {
  onPublished?: (post: any) => void;
}

function localDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function questionIndex(dateKey: string) {
  let hash = 0;
  for (const char of dateKey) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % DAILY_QUESTIONS.length;
}

export default function DailyQuestionCard({ onPublished }: DailyQuestionCardProps) {
  const dateKey = useMemo(localDateKey, []);
  const question = useMemo(() => DAILY_QUESTIONS[questionIndex(dateKey)], [dateKey]);
  const [answer, setAnswer] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = answer.trim();
    if (!value || publishing) return;
    setPublishing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('caption', `💬 Pregunta del día\n${question}\n\n${value}`);
      const response = await api.post('/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onPublished?.(response.data);
      setAnswer('');
      setPublished(true);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'No pudimos publicar tu respuesta.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-4 shadow-sm dark:border-teal-900/70 dark:from-[#0b292a] dark:via-[#0f172a] dark:to-[#09202a] md:p-5">
      <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-teal-300/25 blur-2xl dark:bg-teal-500/10" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-sm"><MessageCircleQuestion className="h-4 w-4" /></div>
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-700 dark:text-teal-400">Pregunta del día</p><p className="text-[10px] text-slate-500 dark:text-slate-400">Una pregunta nueva cada día</p></div>
          </div>
          <Sparkles className="h-4 w-4 text-teal-500" />
        </div>

        <h2 className="text-[17px] font-extrabold leading-snug text-slate-900 dark:text-white md:text-lg">{question}</h2>

        {published ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-teal-200 bg-white/70 px-4 py-3 text-sm font-bold text-teal-800 dark:border-teal-900 dark:bg-black/10 dark:text-teal-300">
            <span>✓</span><span>Tu respuesta ya está en Ritmo.</span>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 flex items-center gap-2">
            <input value={answer} onChange={event => setAnswer(event.target.value)} maxLength={500} placeholder="Tu respuesta…" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 dark:border-slate-700 dark:bg-[#07151d] dark:text-white" />
            <button type="submit" disabled={!answer.trim() || publishing} aria-label="Publicar respuesta" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-sm transition active:scale-95 disabled:opacity-40">
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
        {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-500">{error}</p>}
      </div>
    </section>
  );
}
