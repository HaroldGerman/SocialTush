'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, FileText, Link2, Search, Video, X } from 'lucide-react';
import { api } from '@/context/AuthContext';

type Attachment = { id: string; fileUrl: string; fileType: string; fileName?: string };
type Message = { messageId: string; senderUsername?: string; content?: string; createdAt?: string; attachments?: Attachment[] };
type Conversation = { conversationId: string | null; otherUsername?: string; name?: string };
type LibraryItem = { key: string; kind: 'IMAGE'|'VIDEO'|'AUDIO'|'DOCUMENT'|'LINK'|'OTHER'; url: string; label: string };

const URL_RE = /https?:\/\/[^\s]+/gi;
const LIBRARY_LABEL = 'multimedia, enlaces y archivos';
const SEARCH_LABEL = 'buscar mensajes';

function visible(node: Element) {
  const r = (node as HTMLElement).getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
}
function txt(node?: Element | null) { return node?.textContent?.trim() || ''; }
function cleanUrl(v: string) { return v.replace(/[),.!?]+$/, ''); }
function hostLabel(url: string) { try { return new URL(url).hostname.replace(/^www\./,''); } catch { return 'Enlace'; } }
function kindFor(t: string): LibraryItem['kind'] {
  if (t === 'IMAGE') return 'IMAGE'; if (t === 'VIDEO') return 'VIDEO'; if (t === 'AUDIO') return 'AUDIO'; if (t === 'DOCUMENT') return 'DOCUMENT'; return 'OTHER';
}

function findVisibleLabel(prefix: string) {
  const list = Array.from(document.querySelectorAll<HTMLElement>('p,label')).filter(n => txt(n).toLocaleLowerCase('es').startsWith(prefix));
  return list.find(visible) || list[0] || null;
}

function activeIdentity() {
  const usernames = Array.from(document.querySelectorAll<HTMLElement>('span,p,div')).filter(n => /^@[A-Za-z0-9_.-]+$/.test(txt(n)));
  const u = usernames.find(n => { const r=n.getBoundingClientRect(); return visible(n) && r.top >= 0 && r.top < 340; }) || usernames[0];
  const headings = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4')).filter(n => txt(n));
  const h = headings.find(n => { const r=n.getBoundingClientRect(); return visible(n) && r.top >= 0 && r.top < 340; }) || headings[0];
  return { username: txt(u).replace(/^@/,''), name: txt(h) };
}

async function resolveConversation(): Promise<Conversation | null> {
  const { username, name } = activeIdentity();
  const res = await api.get('/chat/conversations');
  const all: Conversation[] = Array.isArray(res.data) ? res.data : [];
  if (username) {
    const hit = all.find(c => c.otherUsername?.toLocaleLowerCase('es') === username.toLocaleLowerCase('es'));
    if (hit) return hit;
  }
  if (name) {
    const hit = all.find(c => c.name?.trim().toLocaleLowerCase('es') === name.trim().toLocaleLowerCase('es'));
    if (hit) return hit;
  }
  return null;
}

async function loadAllMessages(conversationId: string) {
  const out: Message[] = [];
  const size = 100;
  for (let page=0; page<100; page++) {
    const res = await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page, size } });
    const chunk: Message[] = Array.isArray(res.data?.content) ? res.data.content : (Array.isArray(res.data) ? res.data : []);
    out.unshift(...chunk);
    const totalPages = Number(res.data?.totalPages);
    if ((Number.isFinite(totalPages) && page + 1 >= totalPages) || chunk.length < size) break;
  }
  return out;
}

function buildLibrary(messages: Message[]) {
  const map = new Map<string,LibraryItem>();
  [...messages].reverse().forEach(m => {
    (m.attachments || []).forEach(a => {
      if (!a.fileUrl || a.fileType.startsWith('VIEW_ONCE_')) return;
      map.set(`a-${a.id}`, { key:`a-${a.id}`, kind:kindFor(a.fileType), url:a.fileUrl, label:a.fileName || a.fileType });
    });
    ((m.content || '').match(URL_RE) || []).forEach((raw,i) => {
      const url=cleanUrl(raw); map.set(`l-${m.messageId}-${i}`, { key:`l-${m.messageId}-${i}`, kind:'LINK', url, label:hostLabel(url) });
    });
  });
  return [...map.values()];
}

function ensureLibraryMount() {
  const label = findVisibleLabel(LIBRARY_LABEL);
  const section = label?.parentElement as HTMLElement | null;
  if (!label || !section) return null;
  section.dataset.lifonkLibraryHost = 'true';
  let mount = section.querySelector<HTMLElement>('[data-lifonk-stable-library="true"]');
  if (!mount) {
    mount = document.createElement('div');
    mount.dataset.lifonkStableLibrary = 'true';
    label.insertAdjacentElement('afterend', mount);
  }
  Array.from(section.children).forEach(child => {
    const el = child as HTMLElement;
    if (child === label || el === mount) return;
    el.style.setProperty('display','none','important');
  });
  mount.style.removeProperty('display');
  return mount;
}

function findVisibleMessage(content?: string) {
  const q=(content || '').trim(); if (!q) return null;
  const nodes=Array.from(document.querySelectorAll<HTMLElement>('div')).filter(n => {
    const c=typeof n.className === 'string' ? n.className : '';
    return c.includes('max-w-[82%]') || c.includes('md:max-w-[75%]');
  });
  return nodes.find(n => (n.textContent || '').includes(q)) || null;
}
function highlight(message?: Message) {
  document.querySelectorAll('.lifonk-stable-search-hit').forEach(n => n.classList.remove('lifonk-stable-search-hit'));
  const n=findVisibleMessage(message?.content); if (!n) return false;
  n.classList.add('lifonk-stable-search-hit'); n.scrollIntoView({behavior:'smooth',block:'center'}); return true;
}

export default function ChatHistoryToolsStable() {
  const [mount,setMount]=useState<HTMLElement|null>(null);
  const [items,setItems]=useState<LibraryItem[]>([]);
  const [loading,setLoading]=useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [query,setQuery]=useState('');
  const [results,setResults]=useState<Message[]>([]);
  const [index,setIndex]=useState(0);
  const [notice,setNotice]=useState('');
  const cache=useRef(new Map<string,{messages:Message[];items:LibraryItem[]}>());
  const activeId=useRef('');
  const loadingId=useRef('');

  const hydrate=useCallback(async () => {
    const nextMount=ensureLibraryMount();
    setMount(cur => cur === nextMount ? cur : nextMount);
    if (!nextMount) return;
    const conv=await resolveConversation().catch(()=>null);
    if (!conv?.conversationId) return;
    const id=conv.conversationId; activeId.current=id;
    const cached=cache.current.get(id);
    if (cached) { setItems(cached.items); return; }
    if (loadingId.current===id) return;
    loadingId.current=id; setLoading(true);
    try {
      const messages=await loadAllMessages(id);
      if (activeId.current!==id) return;
      const lib=buildLibrary(messages);
      cache.current.set(id,{messages,items:lib}); setItems(lib);
    } catch { setNotice('No se pudo cargar todo el historial.'); }
    finally { if (loadingId.current===id) loadingId.current=''; setLoading(false); }
  },[]);

  useEffect(()=>{
    if (!window.location.pathname.startsWith('/chat')) return;
    let cancelled=false;
    const scan=()=>{ if (!cancelled && window.location.pathname.startsWith('/chat')) void hydrate(); };
    scan();
    const observer=new MutationObserver(scan); observer.observe(document.body,{childList:true,subtree:true});
    const timer=window.setInterval(scan,250);
    return ()=>{cancelled=true;observer.disconnect();window.clearInterval(timer);};
  },[hydrate]);

  const runSearch=useCallback(async (value:string)=>{
    const q=value.trim(); if (q.length<2) { setNotice('Escribe al menos 2 caracteres.'); return; }
    const conv=await resolveConversation().catch(()=>null); const id=conv?.conversationId || '';
    if (!id) { setNotice('No se pudo identificar la conversación.'); return; }
    let cached=cache.current.get(id);
    if (!cached) {
      try { const messages=await loadAllMessages(id); cached={messages,items:buildLibrary(messages)}; cache.current.set(id,cached); }
      catch { setNotice('No se pudo buscar en el historial.'); return; }
    }
    const needle=q.toLocaleLowerCase('es');
    const found=cached.messages.filter(m => (m.content || '').toLocaleLowerCase('es').includes(needle));
    setQuery(q);setResults(found);setIndex(0);setSearchOpen(true);
    window.setTimeout(()=>highlight(found[0]),60);
    if (!found.length) setNotice(`No se encontraron mensajes con “${q}”.`);
  },[]);

  useEffect(()=>{
    const handler=(event:MouseEvent)=>{
      if (!window.location.pathname.startsWith('/chat')) return;
      const button=(event.target as HTMLElement | null)?.closest('button'); if (!button) return;
      const label=findVisibleLabel(SEARCH_LABEL); const section=label?.parentElement;
      if (!section || !section.contains(button)) return;
      const input=section.querySelector<HTMLInputElement>('input'); if (!input) return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      void runSearch(input.value);
    };
    document.addEventListener('click',handler,true); return()=>document.removeEventListener('click',handler,true);
  },[runSearch]);

  const go=(delta:number)=>{ if (!results.length) return; const n=((index+delta)%results.length+results.length)%results.length; setIndex(n); window.setTimeout(()=>highlight(results[n]),20); };
  useEffect(()=>{ if(!notice)return;const t=window.setTimeout(()=>setNotice(''),3000);return()=>window.clearTimeout(t);},[notice]);
  useEffect(()=>{ if(!searchOpen)return;const h=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSearchOpen(false);document.querySelectorAll('.lifonk-stable-search-hit').forEach(n=>n.classList.remove('lifonk-stable-search-hit'));}else if(e.key==='Enter'){e.preventDefault();go(e.shiftKey?-1:1);}};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[searchOpen,index,results]);

  const current=results[index];
  const library=useMemo(()=>items,[items]);

  return <>
    <style jsx global>{`
      [data-lifonk-library-host="true"] > :not(p):not(label):not([data-lifonk-stable-library="true"]) { display:none !important; }
      .lifonk-stable-search-hit { outline:3px solid #C97B63 !important; outline-offset:5px; border-radius:18px; }
    `}</style>
    {mount && createPortal(<div className="mt-2">
      <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-400">{loading?'Cargando historial…':`${library.length} elementos`}</span><button type="button" onClick={()=>{cache.current.delete(activeId.current);void hydrate();}} className="text-[9px] font-bold text-[#8b5cf6]">Actualizar</button></div>
      {!loading && !library.length && <div className="rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-[10px] text-slate-400 dark:border-slate-700">Aún no hay multimedia, enlaces o archivos.</div>}
      <div className="grid max-h-[430px] grid-cols-3 gap-2 overflow-y-auto pr-1">{library.map(item => item.kind==='IMAGE' ? <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl bg-slate-100 dark:bg-[#162033]"><img src={item.url} alt={item.label} loading="lazy" className="aspect-square h-full w-full object-cover"/></a> : item.kind==='VIDEO' ? <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-[#162033]"><video src={item.url} muted playsInline preload="metadata" className="h-full w-full object-cover"/><span className="absolute flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"><Video className="h-4 w-4"/></span></a> : <a key={item.key} href={item.url} target="_blank" rel="noreferrer" className="flex aspect-square min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-100 p-2 text-center dark:bg-[#162033]">{item.kind==='LINK'?<Link2 className="h-5 w-5 text-[#8b5cf6]"/>:<FileText className="h-5 w-5 text-slate-400"/>}<span className="line-clamp-2 break-all text-[8px] font-bold text-slate-500 dark:text-slate-300">{item.label}</span></a>)}</div>
    </div>,mount)}
    {searchOpen && typeof document!=='undefined' && createPortal(<div className="fixed left-2 right-2 z-[2147482000] mx-auto max-w-3xl" style={{top:'calc(env(safe-area-inset-top) + 72px)'}}><div className="rounded-2xl border border-[#443C68]/30 bg-white/95 p-2.5 shadow-2xl backdrop-blur-xl dark:border-[#6d628f] dark:bg-[#0d0b13]/95"><div className="flex items-center gap-2"><Search className="h-4 w-4 shrink-0 text-[#443C68] dark:text-[#b8add9]"/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void runSearch(query);}}} className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none dark:text-white" placeholder="Buscar en esta conversación"/><span className="shrink-0 text-[10px] font-bold text-slate-500">{results.length?`${index+1} de ${results.length}`:'0 de 0'}</span><button disabled={!results.length} onClick={()=>go(-1)} className="rounded-lg p-1.5 disabled:opacity-30"><ChevronUp className="h-4 w-4"/></button><button disabled={!results.length} onClick={()=>go(1)} className="rounded-lg p-1.5 disabled:opacity-30"><ChevronDown className="h-4 w-4"/></button><button onClick={()=>{setSearchOpen(false);document.querySelectorAll('.lifonk-stable-search-hit').forEach(n=>n.classList.remove('lifonk-stable-search-hit'));}} className="rounded-lg p-1.5"><X className="h-4 w-4"/></button></div>{current&&<div className="mt-2 rounded-xl bg-[#EFE8E3] px-3 py-2 text-xs text-[#1A1620] dark:bg-[#1A1620] dark:text-[#EFE8E3]"><div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-bold opacity-70"><span>@{current.senderUsername||'usuario'}</span><span>{current.createdAt?new Date(current.createdAt).toLocaleString():''}</span></div><p className="line-clamp-3 whitespace-pre-wrap">{current.content}</p>{!findVisibleMessage(current.content)&&<p className="mt-1 text-[9px] font-bold text-[#C97B63]">Resultado del historial completo</p>}</div>}</div></div>,document.body)}
    {notice&&typeof document!=='undefined'&&createPortal(<div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[2147483001] -translate-x-1/2 rounded-full bg-[#1A1620]/95 px-4 py-2 text-xs font-bold text-white shadow-xl">{notice}</div>,document.body)}
  </>;
}
