'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Client } from '@stomp/stompjs';
import { Download, Zap, X } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import { WS_BASE_URL } from '@/config/api';

type ActiveStory = {
  storyId: string;
  mediaType?: string;
  mediaUrl?: string;
  textContent?: string;
};

type ActiveStoryGroup = { stories?: ActiveStory[] };
type AudioTarget = { key: string; audio: HTMLAudioElement; mount: HTMLElement; own: boolean };
const STORY_LABELS = new Set(['tu interacción con un momento','tu interaccion con un momento','interacción con tu momento','interaccion con tu momento']);
const WAVE_HEIGHTS = [8,15,11,21,13,26,18,11,23,15,28,19,12,25,17,10,22,14,27,16,9,20,13,24];

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

function findStoryCard(target: HTMLElement | null) {
  let current = target;
  for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
    if (current.tagName !== 'DIV') continue;
    const directLabel = Array.from(current.children).find((child) => child.tagName === 'P');
    const label = directLabel?.textContent?.trim().toLowerCase() || '';
    if (STORY_LABELS.has(label) && current.querySelector('img[alt="Momento"], video, div[style]')) return current;
  }
  return null;
}

function normalizeMedia(value?: string | null) {
  if (!value) return '';
  try {
    const parsed = new URL(value, window.location.origin);
    return decodeURIComponent(parsed.pathname).replace(/\/+$/, '').toLowerCase();
  } catch {
    return value.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  }
}

function mediaMatches(first?: string | null, second?: string | null) {
  const a = normalizeMedia(first);
  const b = normalizeMedia(second);
  if (!a || !b) return false;
  if (a === b) return true;
  const aName = a.split('/').filter(Boolean).pop();
  const bName = b.split('/').filter(Boolean).pop();
  return Boolean(aName && bName && aName === bName);
}

function findNormalChatImage(target: HTMLElement | null) {
  if (!target) return null;
  const direct = target instanceof HTMLImageElement ? target : null;
  if (direct?.classList.contains('max-h-72') && direct.alt !== 'Momento') return direct;
  const nested = target.closest('button')?.querySelector<HTMLImageElement>('img.max-h-72');
  return nested?.alt === 'Momento' ? null : nested || null;
}

function isOwnAudio(audio: HTMLAudioElement) {
  let current: HTMLElement | null = audio.parentElement;
  for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
    if ((typeof current.className === 'string' ? current.className : '').includes('linear-gradient(135deg,#1a8a80,#126f68)')) return true;
  }
  return false;
}

function findActiveUsername() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('span, p, div'));
  const match = candidates.find((node) => {
    const text = node.textContent?.trim() || '';
    if (!/^@[A-Za-z0-9_.-]+$/.test(text)) return false;
    const rect = node.getBoundingClientRect();
    return rect.top >= 0 && rect.top < 240 && rect.width > 0 && rect.height > 0;
  });
  return match?.textContent?.trim().replace(/^@/, '') || '';
}

function AudioBubblePlayer({ audio, own }: { audio: HTMLAudioElement; own: boolean }) {
  const [playing, setPlaying] = useState(!audio.paused);
  const [current, setCurrent] = useState(audio.currentTime || 0);
  const [duration, setDuration] = useState(Number.isFinite(audio.duration) ? audio.duration : 0);
  const [rate, setRate] = useState(audio.playbackRate || 1);

  useEffect(() => {
    const update = () => setCurrent(audio.currentTime || 0);
    const metadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    const ended = () => { setPlaying(false); setCurrent(audio.duration || 0); };
    audio.addEventListener('timeupdate', update); audio.addEventListener('loadedmetadata', metadata); audio.addEventListener('durationchange', metadata); audio.addEventListener('play', play); audio.addEventListener('pause', pause); audio.addEventListener('ended', ended); metadata();
    return () => { audio.removeEventListener('timeupdate', update); audio.removeEventListener('loadedmetadata', metadata); audio.removeEventListener('durationchange', metadata); audio.removeEventListener('play', play); audio.removeEventListener('pause', pause); audio.removeEventListener('ended', ended); };
  }, [audio]);

  const durationSafe = duration || 1;
  const progress = Math.min(1, current / durationSafe);
  const activeBars = Math.round(progress * WAVE_HEIGHTS.length);
  const cycleRate = () => { const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1; audio.playbackRate = next; setRate(next); };

  return <div className={`min-w-[230px] max-w-[310px] rounded-2xl border px-3 py-3 shadow-sm ${own ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100'}`}>
    <div className="flex items-center gap-3"><button type="button" onClick={() => audio.paused ? void audio.play() : audio.pause()} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-md active:scale-95 ${own ? 'bg-white text-[#177f76]' : 'bg-[#177f76] text-white'}`}>{playing ? 'Ⅱ' : '▶'}</button><div className="min-w-0 flex-1"><div className="relative flex h-9 items-center gap-[3px] overflow-hidden rounded-lg px-1">{WAVE_HEIGHTS.map((height,index)=><span key={index} className={`w-[3px] shrink-0 rounded-full ${index < activeBars ? (own ? 'bg-white' : 'bg-[#177f76]') : (own ? 'bg-white/30' : 'bg-slate-300 dark:bg-slate-600')}`} style={{height}}/>)}<input type="range" min={0} max={durationSafe} step={0.05} value={Math.min(current,durationSafe)} onChange={(event)=>{audio.currentTime=Number(event.target.value);setCurrent(audio.currentTime);}} className="absolute inset-0 h-full w-full opacity-0"/></div><div className={`mt-1 flex items-center justify-between text-[10px] font-semibold ${own ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'}`}><span>{formatAudioTime(current)} / {formatAudioTime(duration)}</span><button type="button" onClick={cycleRate} className={`rounded-full px-2 py-0.5 font-black ${own ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>{rate}×</button></div></div></div>
  </div>;
}

export default function ChatScopedEnhancements() {
  const { user, accessToken } = useAuth();
  const [notice, setNotice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageName, setImageName] = useState('imagen-lifonk.jpg');
  const [audioTargets, setAudioTargets] = useState<AudioTarget[]>([]);
  const [buzzTarget, setBuzzTarget] = useState('');
  const [buzzSending, setBuzzSending] = useState(false);
  const audioCounter = useRef(0);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!window.location.pathname.startsWith('/chat')) return;
      const target = event.target as HTMLElement | null;
      if (!target || target.closest('input, textarea, [contenteditable="true"]')) return;

      const card = findStoryCard(target);
      if (card) {
        event.preventDefault();
        event.stopPropagation();
        const preview = card.querySelector('img[alt="Momento"], video') as HTMLImageElement | HTMLVideoElement | null;
        const previewUrl = preview?.src || '';
        const textNode = Array.from(card.querySelectorAll('div')).find((node) => node !== card && node.getAttribute('style'));
        const textPreview = textNode?.textContent?.trim() || '';

        void api.get('/stories/active').then((response) => {
          const groups: ActiveStoryGroup[] = Array.isArray(response.data) ? response.data : [];
          const stories = groups.flatMap((group) => group.stories || []);
          const match = stories.find((story) => {
            if (previewUrl && story.mediaUrl && mediaMatches(previewUrl, story.mediaUrl)) return true;
            if (textPreview && story.textContent) return story.textContent.trim() === textPreview || textPreview.includes(story.textContent.trim());
            return false;
          });
          if (!match?.storyId) throw new Error('story-not-found');
          window.location.assign(`/feed?moment=${encodeURIComponent(match.storyId)}`);
        }).catch(() => setNotice('No encontramos ese Momento entre tus Momentos activos.'));
        return;
      }

      const image = findNormalChatImage(target);
      if (!image) return;
      event.preventDefault();
      event.stopPropagation();
      setImageUrl(image.currentSrc || image.src);
      setImageName(image.alt && image.alt !== 'Imagen adjunta' ? image.alt : 'imagen-lifonk.jpg');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    const scan = () => {
      if (!window.location.pathname.startsWith('/chat')) { setAudioTargets([]); setBuzzTarget(''); return; }
      setBuzzTarget(findActiveUsername());
      const next: AudioTarget[] = [];
      Array.from(document.querySelectorAll<HTMLAudioElement>('audio')).forEach((audio) => {
        if (!audio.src) return;
        let key = audio.dataset.lifonkAudioKey;
        if (!key) { key = `lifonk-audio-${++audioCounter.current}`; audio.dataset.lifonkAudioKey = key; }
        let mount = document.querySelector<HTMLElement>(`[data-lifonk-audio-mount="${key}"]`);
        if (!mount) { mount = document.createElement('div'); mount.dataset.lifonkAudioMount = key; audio.insertAdjacentElement('afterend', mount); }
        audio.style.display = 'none'; next.push({ key, audio, mount, own: isOwnAudio(audio) });
      });
      setAudioTargets(next);
    };
    scan(); const observer = new MutationObserver(scan); observer.observe(document.body,{childList:true,subtree:true});
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!user?.username) return;
    const client = new Client({ brokerURL: WS_BASE_URL, connectHeaders: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, reconnectDelay: 5000 });
    client.onConnect = () => client.subscribe(`/topic/user.${user.username}.buzz`, (frame) => {
      const body = JSON.parse(frame.body);
      setNotice(`⚡ @${body.senderUsername} te envió un zumbido`);
      if ('vibrate' in navigator) navigator.vibrate?.([120,70,120,70,180]);
      document.documentElement.classList.add('lifonk-buzzing');
      window.setTimeout(()=>document.documentElement.classList.remove('lifonk-buzzing'),650);
    });
    client.activate();
    return () => { void client.deactivate(); };
  }, [user?.username, accessToken]);

  useEffect(() => { if (!notice) return; const timer = window.setTimeout(()=>setNotice(''),3000); return () => window.clearTimeout(timer); }, [notice]);

  const sendBuzz = async () => {
    if (!buzzTarget || buzzSending) return;
    setBuzzSending(true);
    try { await api.post(`/chat/buzz/${encodeURIComponent(buzzTarget)}`); setNotice(`⚡ Zumbido enviado a @${buzzTarget}`); }
    catch (error: any) { setNotice(error?.response?.data?.message || 'No se pudo enviar el zumbido.'); }
    finally { setBuzzSending(false); }
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const downloadUrl = `/api/download-image?url=${encodeURIComponent(imageUrl)}&filename=${encodeURIComponent(imageName || 'imagen-lifonk.jpg')}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = imageName || 'imagen-lifonk.jpg';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return <>
    <style jsx global>{`
      @keyframes lifonkBuzz {0%,100%{transform:translate3d(0,0,0)}10%{transform:translate3d(-7px,0,0)}20%{transform:translate3d(7px,0,0)}30%{transform:translate3d(-6px,0,0)}40%{transform:translate3d(6px,0,0)}50%{transform:translate3d(-4px,0,0)}60%{transform:translate3d(4px,0,0)}}
      html.lifonk-buzzing body { animation: lifonkBuzz .62s ease-in-out; }
    `}</style>
    {audioTargets.map(({key,audio,mount,own})=>createPortal(<AudioBubblePlayer key={key} audio={audio} own={own}/>,mount,key))}
    {buzzTarget && typeof document !== 'undefined' && createPortal(<button type="button" onClick={()=>void sendBuzz()} disabled={buzzSending} className="fixed right-4 z-[65] flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50/95 px-3 py-2 text-[11px] font-black text-amber-700 shadow-lg backdrop-blur disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/90 dark:text-amber-300" style={{bottom:'calc(78px + env(safe-area-inset-bottom))'}}><Zap className="h-4 w-4 fill-current"/>{buzzSending?'Enviando…':'Zumbido'}</button>,document.body)}
    {imageUrl && typeof document !== 'undefined' && createPortal(<div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black p-3" onClick={()=>setImageUrl('')}><div className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-10 flex gap-2"><button type="button" onClick={(event)=>{event.stopPropagation();downloadImage();}} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur" aria-label="Descargar imagen"><Download className="h-5 w-5"/></button><button type="button" onClick={(event)=>{event.stopPropagation();setImageUrl('');}} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur" aria-label="Cerrar"><X className="h-5 w-5"/></button></div><img src={imageUrl} alt="Imagen ampliada" onClick={(event)=>event.stopPropagation()} className="max-h-[92dvh] max-w-[96vw] object-contain"/></div>,document.body)}
    {notice && typeof document !== 'undefined' && createPortal(<div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[2147483001] -translate-x-1/2 rounded-full bg-slate-950/92 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur">{notice}</div>,document.body)}
  </>;
}
