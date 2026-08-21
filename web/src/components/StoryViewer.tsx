'use client';

import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/context/AuthContext';
import { X, ChevronLeft, ChevronRight, Send, Eye, Heart } from 'lucide-react';

interface StoryViewerProps {
  groups: any[];
  initialGroupIndex: number;
  currentUserId?: string;
  onClose: () => void;
  onStoryViewed?: (storyId: string) => void;
}

const STORY_DURATION_MS = 6000;

export default function StoryViewer({ groups, initialGroupIndex, currentUserId, onClose, onStoryViewed }: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const viewedRef = useRef<Set<string>>(new Set());
  const startedAtRef = useRef(Date.now());
  const videoAdvanceLock = useRef<string | null>(null);

  const group = groups[groupIndex];
  const stories = group?.stories || [];
  const story = stories[storyIndex];
  const isOwn = Boolean(currentUserId && group?.userId && String(currentUserId) === String(group.userId));

  const closeOrNextGroup = () => {
    if (groupIndex < groups.length - 1) {
      setGroupIndex(value => value + 1);
      setStoryIndex(0);
      setProgress(0);
    } else onClose();
  };

  const nextStory = () => {
    if (!story) return;
    if (storyIndex < stories.length - 1) {
      setStoryIndex(value => value + 1);
      setProgress(0);
    } else closeOrNextGroup();
  };

  const previousStory = () => {
    if (storyIndex > 0) {
      setStoryIndex(value => value - 1);
      setProgress(0);
      return;
    }
    if (groupIndex > 0) {
      const previousGroup = groups[groupIndex - 1];
      setGroupIndex(value => value - 1);
      setStoryIndex(Math.max(0, (previousGroup?.stories?.length || 1) - 1));
      setProgress(0);
    }
  };

  useEffect(() => {
    setStoryIndex(0);
    setProgress(0);
  }, [groupIndex]);

  useEffect(() => {
    if (!story) return;
    videoAdvanceLock.current = null;
    startedAtRef.current = Date.now();
    setProgress(0);

    if (!viewedRef.current.has(story.storyId) && !isOwn) {
      viewedRef.current.add(story.storyId);
      api.post(`/stories/${story.storyId}/view`).catch(() => {});
      onStoryViewed?.(story.storyId);
    }

    if (story.mediaType === 'VIDEO') return;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const next = Math.min(100, elapsed / STORY_DURATION_MS * 100);
      setProgress(next);
      if (next >= 100) {
        window.clearInterval(timer);
        nextStory();
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [story?.storyId, isOwn]);

  useEffect(() => {
    if (!story || !isOwn) return;
    api.get(`/stories/${story.storyId}/viewers`).then(response => setViewers(response.data || [])).catch(() => setViewers([]));
  }, [story?.storyId, isOwn]);

  if (!group || !story) return null;

  let overlays: any[] = [];
  try { overlays = story.overlayData ? JSON.parse(story.overlayData) : []; } catch { overlays = []; }
  const visualOverlays = overlays.filter((item: any) => item?.type !== 'VIDEO_TRIM');
  const trim = overlays.find((item: any) => item?.type === 'VIDEO_TRIM');

  const sendReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/stories/${story.storyId}/reply`, { content: reply.trim() });
      setReply('');
    } catch {}
    finally { setSending(false); }
  };

  const react = async (emoji: string) => {
    try {
      await api.post(`/stories/${story.storyId}/reactions`, { emoji });
      setReactionCounts(previous => ({ ...previous, [emoji]: (previous[emoji] || 0) + 1 }));
    } catch {}
  };

  const advanceVideoOnce = () => {
    if (videoAdvanceLock.current === story.storyId) return;
    videoAdvanceLock.current = story.storyId;
    nextStory();
  };

  return (
    <div className="fixed inset-0 z-[120] flex h-[100dvh] items-center justify-center bg-black text-white">
      <div className="relative h-full w-full overflow-hidden bg-black md:h-[94dvh] md:max-w-md md:rounded-3xl">
        <div className="absolute left-3 right-3 top-[calc(.75rem+env(safe-area-inset-top))] z-40 flex gap-1">
          {stories.map((_: any, index: number) => <div key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"><div className="h-full bg-white transition-[width] duration-75" style={{ width: `${index < storyIndex ? 100 : index === storyIndex ? progress : 0}%` }}/></div>)}
        </div>

        <div className="absolute left-4 right-4 top-[calc(1.75rem+env(safe-area-inset-top))] z-40 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-xs font-black">{(group.displayName || group.username || 'L').slice(0, 1).toUpperCase()}</div><div><p className="text-xs font-extrabold">{group.displayName || group.username}</p><p className="text-[10px] text-white/60">{story.createdAt ? new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p></div></div>
          <button onClick={onClose} className="rounded-full bg-black/35 p-2 backdrop-blur"><X className="h-5 w-5"/></button>
        </div>

        <div className="absolute inset-0 flex items-center justify-center" style={{ background: story.mediaType === 'TEXT' ? story.backgroundColor || '#111827' : '#000' }}>
          {story.mediaType === 'IMAGE' && story.mediaUrl && <img src={story.mediaUrl} alt="Momento" className="h-full w-full object-contain"/>}
          {story.mediaType === 'VIDEO' && story.mediaUrl && <video key={story.storyId} src={story.mediaUrl} autoPlay playsInline controls={false} className="h-full w-full object-contain" onLoadedMetadata={event => { const video = event.currentTarget; if (trim?.start != null && Number(trim.start) > 0) video.currentTime = Number(trim.start); }} onTimeUpdate={event => { const video = event.currentTarget; const logicalStart = Number(trim?.start || 0); const logicalEnd = Number(trim?.end || video.duration || 0); const physicalDuration = Number.isFinite(video.duration) ? video.duration : 0; const hasLegacyLogicalTrim = Boolean(trim && logicalEnd > logicalStart && physicalDuration > logicalEnd + .25); const effectiveStart = hasLegacyLogicalTrim ? logicalStart : 0; const effectiveEnd = hasLegacyLogicalTrim ? logicalEnd : physicalDuration; if (effectiveEnd > effectiveStart) setProgress(Math.min(100, Math.max(0, (video.currentTime - effectiveStart) / (effectiveEnd - effectiveStart) * 100))); if (hasLegacyLogicalTrim && video.currentTime >= effectiveEnd - .04) advanceVideoOnce(); }} onEnded={advanceVideoOnce}/>} 
          {story.mediaType === 'TEXT' && <p className="px-8 text-center text-2xl font-black whitespace-pre-wrap">{story.textContent}</p>}
          {visualOverlays.map((o:any)=><div key={o.id} className="absolute pointer-events-none z-20" style={{left:`${o.x*100}%`,top:`${o.y*100}%`,transform:`translate(-50%,-50%) scale(${o.scale})`,color:o.color||'#fff',fontFamily:o.fontFamily||undefined,fontWeight:o.fontWeight||700}}><div className={`px-3 py-1.5 rounded-xl ${o.bg?'bg-black/75':''}`}>{o.value}</div></div>)}
        </div>

        <button aria-label="Anterior" onClick={previousStory} className="absolute left-0 top-24 bottom-24 z-30 w-1/4"><span className="sr-only">Anterior</span></button>
        <button aria-label="Siguiente" onClick={nextStory} className="absolute right-0 top-24 bottom-24 z-30 w-1/4"><span className="sr-only">Siguiente</span></button>
        <ChevronLeft className="pointer-events-none absolute left-2 top-1/2 z-20 h-6 w-6 -translate-y-1/2 text-white/30"/>
        <ChevronRight className="pointer-events-none absolute right-2 top-1/2 z-20 h-6 w-6 -translate-y-1/2 text-white/30"/>

        <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 right-3 z-50">
          {isOwn ? <div className="rounded-2xl bg-black/45 p-3 backdrop-blur-md"><button onClick={() => setShowViewers(value => !value)} className="flex w-full items-center justify-center gap-2 text-xs font-bold"><Eye className="h-4 w-4"/>{viewers.length} visualizaciones</button>{showViewers && <div className="mt-3 max-h-32 space-y-2 overflow-y-auto border-t border-white/10 pt-3">{viewers.map((viewer:any) => <div key={viewer.userId || viewer.username} className="text-xs text-white/80">{viewer.displayName || viewer.username}</div>)}{!viewers.length && <p className="text-center text-[11px] text-white/45">Todavía nadie lo ha visto.</p>}</div>}</div> : <div className="space-y-2"><div className="flex justify-center gap-2">{['❤️','🔥','😂','😍','👏'].map(emoji => <button key={emoji} onClick={() => react(emoji)} className="rounded-full bg-black/45 px-3 py-2 text-lg backdrop-blur">{emoji}{reactionCounts[emoji] ? <span className="ml-1 text-[9px]">{reactionCounts[emoji]}</span> : null}</button>)}</div><div className="flex items-center gap-2 rounded-2xl bg-black/45 p-2 backdrop-blur-md"><input value={reply} onChange={event => setReply(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void sendReply(); }} placeholder="Responder a este momento…" className="min-w-0 flex-1 bg-transparent px-2 text-xs outline-none placeholder:text-white/45"/><button onClick={sendReply} disabled={!reply.trim() || sending} className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 disabled:opacity-40"><Send className="h-4 w-4"/></button></div></div>}
        </div>
      </div>
    </div>
  );
}
