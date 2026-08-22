'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Compass, Sparkles, Users } from 'lucide-react';
import { api } from '@/context/AuthContext';
import { DISCOVER_TOPICS } from '@/lib/discoverTopics';

type CategorySummary = { slug:string; label:string; members:number; personalized:boolean; people:Array<{username:string;displayName:string;avatarUrl:string}> };

export default function DiscoverPage(){
  const [categories,setCategories]=useState<CategorySummary[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{api.get('/discover/summary').then(r=>setCategories(r.data?.categories||[])).catch(()=>setCategories([])).finally(()=>setLoading(false));},[]);
  const merged=useMemo(()=>DISCOVER_TOPICS.map(topic=>({topic,summary:categories.find(item=>item.slug===topic.slug)})).sort((a,b)=>Number(!!b.summary?.personalized)-Number(!!a.summary?.personalized)||(b.summary?.members||0)-(a.summary?.members||0)),[categories]);
  const mine=merged.filter(item=>item.summary?.personalized);
  const others=merged.filter(item=>!item.summary?.personalized);
  const render=(items:typeof merged)=> <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{items.map(({topic,summary})=><Link key={topic.slug} href={`/discover/${topic.slug}`} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition active:scale-[.99] dark:border-slate-800 dark:bg-[#0f172a]"><div className={`bg-gradient-to-br ${topic.accent} p-4 text-white`}><div className="text-3xl">{topic.emoji}</div><h2 className="mt-3 text-sm font-black">{topic.label}</h2><p className="mt-1 line-clamp-2 text-[10px] text-white/80">{topic.description}</p></div><div className="flex items-center justify-between p-3 text-[10px]"><span className="flex items-center gap-1 font-bold text-slate-500"><Users className="h-3 w-3"/>{summary?.members||0} interesados</span><span className="font-black text-teal-600">Explorar →</span></div></Link>)}</div>;
  return <main className="min-h-screen bg-[var(--bg-main)] pb-28 text-[var(--text-main)]"><header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-[#08111f]/95"><div className="mx-auto flex max-w-4xl items-center gap-3"><Link href="/feed" className="rounded-full p-2 text-slate-500"><ArrowLeft className="h-5 w-5"/></Link><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-700 text-white"><Compass className="h-5 w-5"/></div><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-600">Lifonk</p><h1 className="text-xl font-black">Descubrir</h1></div></div></header><div className="mx-auto max-w-4xl space-y-7 p-4"><section className="rounded-3xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-5 dark:border-teal-900 dark:from-[#0b292a] dark:to-[#0d1726]"><div className="flex items-center gap-2 text-teal-700 dark:text-teal-300"><Sparkles className="h-4 w-4"/><span className="text-[10px] font-black uppercase tracking-[.18em]">Hecho con tus intereses</span></div><h2 className="mt-2 text-xl font-black">Tu universo empieza por lo que elegiste al registrarte</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Ordenamos primero tus temas y luego te mostramos otros para que siempre haya algo nuevo.</p></section>{loading?<div className="py-12 text-center text-sm text-slate-400">Preparando Descubrir…</div>:<>{mine.length>0&&<section><h2 className="mb-3 text-base font-black">Para ti</h2>{render(mine)}</section>}<section><h2 className="mb-3 text-base font-black">Explora algo distinto</h2>{render(others.length?others:merged)}</section></>}</div></main>;
}
