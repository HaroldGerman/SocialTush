'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Brain, Compass, MessageCircleQuestion, Sparkles } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';

const DAILY_QUESTIONS = [
  '¿Qué pequeña cosa te hizo sonreír hoy?', '¿Qué canción describe mejor tu día?',
  'Si pudieras aprender algo instantáneamente, ¿qué elegirías?', '¿Cuál es un lugar al que siempre quieres volver?',
  '¿Qué hábito te gustaría mantener durante un año?', '¿Qué consejo te habría gustado escuchar hace cinco años?',
  '¿Qué comida podrías repetir toda una semana?', '¿Qué película o serie recomendarías sin pensarlo?',
  '¿Qué meta pequeña quieres completar esta semana?', '¿Qué persona te inspira últimamente y por qué?',
  '¿Qué te gustaría que existiera y todavía nadie haya creado?', '¿Qué harías mañana si supieras que no puedes fallar?',
  '¿Qué habilidad crees que todo el mundo debería aprender?', '¿Qué estás intentando aprender ahora mismo?',
  '¿Qué cambiarías de las redes sociales actuales?', '¿Qué sueño estás construyendo poco a poco?',
  '¿Qué descubrimiento reciente quieres compartir con otros?', '¿Cómo sería para ti un día perfecto?'
];

const INTEREST_OPTIONS = ['Programación', 'Ciencia', 'Historia', 'Astronomía', 'Idiomas', 'Economía', 'Tecnología', 'Psicología', 'Anime', 'Fútbol', 'Arte', 'Música', 'Viajes', 'Naturaleza'];

const GENERAL_FACTS = [
  'Los pulpos tienen tres corazones y su sangre usa hemocianina, una proteína con cobre, para transportar oxígeno.',
  'La luz del Sol tarda aproximadamente 8 minutos y 20 segundos en llegar a la Tierra.',
  'La Antártida es técnicamente el desierto más grande del planeta por la poca precipitación que recibe.',
  'El alfabeto coreano Hangul fue diseñado deliberadamente en el siglo XV para facilitar el aprendizaje de la lectura.',
  'Una baraja estándar de 52 cartas puede ordenarse de más maneras que la cantidad estimada de átomos en la Tierra.'
];

const FACTS_BY_INTEREST: Record<string, string[]> = {
  programacion: [
    'El primer bug informático famoso fue literalmente una polilla encontrada en un relé del Harvard Mark II en 1947.',
    'Java fue diseñado originalmente para dispositivos electrónicos interactivos antes de convertirse en uno de los lenguajes más usados del backend.'
  ],
  tecnologia: ['El código QR fue creado en 1994 para rastrear piezas en fábricas de automóviles y luego se liberó para uso general.'],
  ciencia: ['El ADN de una sola célula humana, si se estirara completamente, mediría aproximadamente dos metros.'],
  historia: ['La Universidad de Oxford ya impartía enseñanza antes de la fundación del Imperio azteca.'],
  astronomia: ['Un día en Venus dura más que un año venusiano: rota tan lentamente que tarda más en girar sobre sí mismo que en orbitar el Sol.'],
  idiomas: ['El idioma con más hablantes nativos es el chino mandarín, mientras que el inglés domina cuando se cuentan también hablantes como segunda lengua.'],
  economia: ['El dinero no siempre fue moneda: distintas sociedades usaron sal, cacao, conchas y metales como medios de intercambio.'],
  psicologia: ['Recordamos mejor información cuando intentamos recuperarla activamente que cuando solamente la releemos; es el llamado efecto de práctica de recuperación.'],
  anime: ['La animación japonesa adoptó muchas técnicas de producción limitada para reducir costos y terminó convirtiéndolas en parte de su lenguaje visual distintivo.'],
  futbol: ['Un partido de fútbol dura 90 minutos reglamentarios, pero el balón suele estar realmente en juego bastante menos tiempo por interrupciones.'],
  arte: ['El azul ultramarino fue durante siglos tan costoso que algunos pintores reservaban su uso para las partes más importantes de una obra.'],
  musica: ['Una octava duplica la frecuencia: una nota de 440 Hz tiene su equivalente una octava arriba en 880 Hz.'],
  viajes: ['Nepal es el único país cuya bandera nacional no tiene forma rectangular.'],
  naturaleza: ['Los bosques de manglar pueden almacenar más carbono por unidad de superficie que muchos bosques terrestres tropicales.']
};

const DISCOVERY_POSTS = [
  {
    image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=82',
    title: 'Hay lugares que parecen inventados',
    caption: 'Montañas, niebla y silencio. A veces descubrir también es detenerse un momento y mirar.'
  },
  {
    image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=82',
    title: 'El desierto también guarda ritmo',
    caption: 'Las dunas cambian lentamente con el viento: un paisaje puede estar vivo aunque parezca inmóvil.'
  },
  {
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=82',
    title: 'Un minuto de bosque',
    caption: 'Los ecosistemas forestales conectan raíces, hongos, agua y nutrientes en redes mucho más complejas de lo que vemos.'
  }
];

interface DailyQuestionCardProps { onPublished?: (post: any) => void; }

function localDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function hashIndex(value: string, length: number) {
  let hash = 0;
  for (const char of value) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % Math.max(1, length);
}

function normalizeInterest(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export default function DailyQuestionCard({ onPublished }: DailyQuestionCardProps) {
  const { user } = useAuth();
  const [dateKey, setDateKey] = useState(localDateKey);
  const question = useMemo(() => DAILY_QUESTIONS[hashIndex(dateKey, DAILY_QUESTIONS.length)], [dateKey]);
  const [answer, setAnswer] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [savingInterests, setSavingInterests] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    let midnightTimer: number | undefined;
    const answeredKey = `lifonk.daily-question.answered.${user?.userId || user?.username || 'guest'}`;

    const syncLocalDay = () => {
      const nextKey = localDateKey();
      setDateKey(previous => {
        if (previous !== nextKey) {
          setAnswer('');
          setError('');
          setPublished(false);
        }
        return nextKey;
      });
      setPublished(window.localStorage.getItem(answeredKey) === nextKey);
    };

    const scheduleMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      midnightTimer = window.setTimeout(() => {
        syncLocalDay();
        scheduleMidnight();
      }, Math.max(1000, nextMidnight.getTime() - now.getTime() + 100));
    };

    syncLocalDay();
    scheduleMidnight();
    document.addEventListener('visibilitychange', syncLocalDay);
    window.addEventListener('focus', syncLocalDay);
    return () => {
      if (midnightTimer) window.clearTimeout(midnightTimer);
      document.removeEventListener('visibilitychange', syncLocalDay);
      window.removeEventListener('focus', syncLocalDay);
    };
  }, [user?.userId, user?.username]);

  useEffect(() => {
    if (!user?.username) return;
    api.get(`/profiles/${encodeURIComponent(user.username)}`).then(response => {
      const values = String(response.data?.interests || '').split(',').map((value: string) => value.trim()).filter(Boolean);
      setInterests(values);
      setSelected(values);
    }).catch(() => {}).finally(() => setProfileLoaded(true));
  }, [user?.username]);

  const personalFact = useMemo(() => {
    const candidates = interests.flatMap(value => FACTS_BY_INTEREST[normalizeInterest(value)] || []);
    if (!candidates.length) return GENERAL_FACTS[hashIndex(`${dateKey}:general`, GENERAL_FACTS.length)];
    return candidates[hashIndex(`${dateKey}:${user?.username || ''}:personal`, candidates.length)];
  }, [dateKey, interests, user?.username]);

  const randomFact = useMemo(() => GENERAL_FACTS[hashIndex(`${dateKey}:random:2`, GENERAL_FACTS.length)], [dateKey]);
  const discovery = useMemo(() => DISCOVERY_POSTS[hashIndex(`${dateKey}:${user?.username || ''}:landscape`, DISCOVERY_POSTS.length)], [dateKey, user?.username]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = answer.trim();
    if (!value || publishing) return;
    setPublishing(true); setError('');
    try {
      const formData = new FormData();
      formData.append('caption', `💬 Pregunta del día\n${question}\n\n${value}`);
      const response = await api.post('/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onPublished?.(response.data); setAnswer(''); setPublished(true);
      window.localStorage.setItem(`lifonk.daily-question.answered.${user?.userId || user?.username || 'guest'}`, dateKey);
    } catch (requestError: any) { setError(requestError.response?.data?.message || 'No pudimos publicar tu respuesta.'); }
    finally { setPublishing(false); }
  };

  const toggleInterest = (value: string) => setSelected(previous => previous.includes(value) ? previous.filter(item => item !== value) : [...previous, value]);

  const saveInterests = async () => {
    const extras = customInterest.split(',').map(value => value.trim()).filter(Boolean);
    const next = Array.from(new Set([...selected, ...extras])).slice(0, 12);
    if (!next.length) return;
    setSavingInterests(true);
    try {
      await api.post('/profiles/onboarding', { interests: next, circles: [], socialGoal: 'DISCOVER' });
      setInterests(next); setSelected(next); setCustomInterest('');
    } finally { setSavingInterests(false); }
  };

  return (
    <div className="space-y-4">
      {profileLoaded && interests.length === 0 && (
        <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm dark:border-indigo-900/70 dark:from-[#151a34] dark:to-[#0f172a]">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white"><Brain className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-indigo-600 dark:text-indigo-300">Haz Ritmo más tuyo</p><h3 className="text-sm font-extrabold dark:text-white">¿Qué estudias o qué te interesa?</h3></div></div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Usaremos esto para mezclar datos relacionados contigo con descubrimientos de otros temas.</p>
          <div className="mt-3 flex flex-wrap gap-2">{INTEREST_OPTIONS.map(item => <button key={item} type="button" onClick={() => toggleInterest(item)} className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${selected.includes(item) ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-[#101827] dark:text-slate-300'}`}>{item}</button>)}</div>
          <input value={customInterest} onChange={event => setCustomInterest(event.target.value)} placeholder="Otro: medicina, Java, fotografía…" className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0a1320] dark:text-white" />
          <button type="button" onClick={saveInterests} disabled={savingInterests || (!selected.length && !customInterest.trim())} className="mt-3 w-full rounded-2xl bg-indigo-600 py-2.5 text-xs font-black text-white disabled:opacity-40">{savingInterests ? 'Guardando…' : 'Personalizar mi Ritmo'}</button>
        </section>
      )}

      <section className="relative overflow-hidden rounded-3xl border border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-4 shadow-sm dark:border-teal-900/70 dark:from-[#0b292a] dark:via-[#0f172a] dark:to-[#09202a]">
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-700 text-white"><MessageCircleQuestion className="h-4 w-4" /></div><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-700 dark:text-teal-400">Pregunta del día</p><p className="text-[10px] text-slate-500 dark:text-slate-400">Una nueva cada día</p></div></div><Sparkles className="h-4 w-4 text-teal-500" /></div>
        <h2 className="text-[17px] font-extrabold leading-snug text-slate-900 dark:text-white">{question}</h2>
        {published ? <div className="mt-4 rounded-2xl border border-teal-200 bg-white/70 px-4 py-3 text-sm font-bold text-teal-800 dark:border-teal-900 dark:bg-black/10 dark:text-teal-300">✓ Tu respuesta ya está en Ritmo.</div> : <form onSubmit={submit} className="mt-4 flex gap-2"><input value={answer} onChange={event => setAnswer(event.target.value)} maxLength={500} placeholder="Tu respuesta…" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-[#07151d] dark:text-white" /><button disabled={!answer.trim() || publishing} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-700 text-white disabled:opacity-40"><ArrowRight className="h-4 w-4" /></button></form>}
        {error && <p className="mt-2 text-xs font-semibold text-rose-500">{error}</p>}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm dark:border-amber-900/60 dark:from-[#2a2112] dark:to-[#111827]">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500"/><p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-700 dark:text-amber-400">{interests.length ? 'Dato para ti' : 'Cultura general'}</p></div>
        <p className="mt-2 text-sm font-bold leading-relaxed text-slate-800 dark:text-slate-100">{personalFact}</p>
        {interests.length > 0 && <p className="mt-2 text-[10px] text-slate-500">Basado en: {interests.slice(0, 3).join(' · ')}</p>}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f172a]">
        <Link href="/profile/lifonk-descubre" className="flex items-center gap-3 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-900/40">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 font-black text-white">L</div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-1"><p className="text-sm font-black dark:text-white">Lifonk Descubre</p><BadgeCheck className="h-4 w-4 text-teal-500"/></div><p className="text-[10px] text-slate-500">@lifonk-descubre · Cuenta oficial</p></div>
          <Compass className="h-4 w-4 text-teal-500"/>
        </Link>
        <Link href="/profile/lifonk-descubre" className="block"><img src={discovery.image} alt={discovery.title} loading="lazy" className="max-h-[66dvh] w-full bg-slate-100 object-cover dark:bg-[#09121f]" /></Link>
        <div className="p-4"><h3 className="text-base font-black text-slate-900 dark:text-white">{discovery.title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{discovery.caption}</p><Link href="/profile/lifonk-descubre" className="mt-3 inline-block text-[10px] font-bold uppercase tracking-[.14em] text-teal-600 dark:text-teal-400">Ver perfil · Descubre algo nuevo cada día</Link></div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f172a]"><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-600 dark:text-cyan-400">Dato random</p><p className="mt-2 text-sm font-bold leading-relaxed text-slate-800 dark:text-slate-100">{randomFact}</p></section>
    </div>
  );
}
