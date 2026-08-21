'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, Send, MoreHorizontal, Eye } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';

interface Story {
  storyId: string;
  mediaType: string;
  mediaUrl: string;
  textContent: string;
  backgroundColor: string;
  musicTitle: string;
  overlayData?: string;
  viewedByMe?: boolean;
  createdAt: string;
}
interface GroupedStory { userId:string; username:string; displayName:string; avatarUrl:string; hasUnseenStories?:boolean; stories:Story[]; }
interface StoryViewerProps { groupedStories:GroupedStory[]; initialUserIndex:number; onClose:()=>void; onStoriesChange?:(stories:GroupedStory[])=>void; }
interface StoryViewerItem { userId:string; username:string; displayName:string; avatarUrl?:string; viewedAt:string; resonance?:string|null; }

const parseOverlayData = (story?: Story) => {
  if (!story?.overlayData) return [] as any[];
  try { const parsed = JSON.parse(story.overlayData); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
const trimForStory = (story?: Story) => {
  const trim = parseOverlayData(story).find((item:any) => item?.type === 'VIDEO_TRIM' || item?.id === '__video_trim__');
  return { start: Math.max(0, Number(trim?.start) || 0), end: Number(trim?.end) || 0 };
};

export default function StoryViewer({ groupedStories, initialUserIndex, onClose, onStoriesChange }: StoryViewerProps) {
  const { user } = useAuth();
  const [userIndex,setUserIndex]=useState(initialUserIndex);
  const [storyIndex,setStoryIndex]=useState(0);
  const [progress,setProgress]=useState(0);
  const [isPaused,setIsPaused]=useState(false);
  const [replyText,setReplyText]=useState('');
  const [stories,setStories]=useState(groupedStories);
  const [isMenuOpen,setIsMenuOpen]=useState(false);
  const [isDeleteOpen,setIsDeleteOpen]=useState(false);
  const [isDeleting,setIsDeleting]=useState(false);
  const [deleteError,setDeleteError]=useState('');
  const [isViewersOpen,setIsViewersOpen]=useState(false);
  const [viewers,setViewers]=useState<StoryViewerItem[]>([]);
  const [viewersLoading,setViewersLoading]=useState(false);
  const [viewersError,setViewersError]=useState('');
  const [selectedResonance,setSelectedResonance]=useState<string|null>(null);
  const [imageReady,setImageReady]=useState(true);
  const [videoReady,setVideoReady]=useState(false);
  const progressInterval=useRef<NodeJS.Timeout|null>(null);
  const storyVideoRef=useRef<HTMLVideoElement>(null);
  const videoAdvanceLock=useRef<string|null>(null);
  const activeStoryIdRef=useRef<string|null>(null);

  const currentUserStories=stories[userIndex];
  const currentStory=currentUserStories?.stories[storyIndex];
  const trim=trimForStory(currentStory);
  const isOwnStory=Boolean(user&&currentUserStories&&((user.userId&&String(user.userId)===String(currentUserStories.userId))||(user.username&&user.username.toLowerCase()===currentUserStories.username?.toLowerCase())));

  activeStoryIdRef.current=currentStory?.storyId||null;

  useEffect(()=>setStories(groupedStories),[groupedStories]);
  useEffect(()=>{setStoryIndex(0);setProgress(0)},[userIndex]);
  useEffect(()=>{
    setSelectedResonance(null);
    setProgress(0);
    setVideoReady(false);
    videoAdvanceLock.current=null;
    activeStoryIdRef.current=currentStory?.storyId||null;
  },[currentStory?.storyId]);

  useEffect(()=>{
    if(!currentStory||currentStory.mediaType!=='IMAGE'||!currentStory.mediaUrl){setImageReady(true);return;}
    let active=true; setImageReady(false);
    const image=new window.Image(); image.src=currentStory.mediaUrl; image.onload=()=>active&&setImageReady(true); image.onerror=()=>active&&setImageReady(true);
    const next=currentUserStories?.stories[storyIndex+1]||stories[userIndex+1]?.stories?.[0];
    if(next?.mediaType==='IMAGE'&&next.mediaUrl){const n=new window.Image();n.src=next.mediaUrl;}
    return()=>{active=false;image.onload=null;image.onerror=null};
  },[currentStory?.storyId,currentStory?.mediaType,currentStory?.mediaUrl,currentUserStories,storyIndex,stories,userIndex]);

  useEffect(()=>{
    if(!currentStory||isOwnStory||currentStory.viewedByMe)return;
    let active=true;
    api.post(`/stories/${currentStory.storyId}/view`).then(()=>{if(!active)return;setStories(prev=>{const next=prev.map((group,gi)=>{if(gi!==userIndex)return group;const ns=group.stories.map((s,i)=>i===storyIndex?{...s,viewedByMe:true}:s);return{...group,stories:ns,hasUnseenStories:ns.some(s=>!s.viewedByMe)}});onStoriesChange?.(next);return next})}).catch(()=>{});
    return()=>{active=false};
  },[currentStory?.storyId,currentStory?.viewedByMe,isOwnStory,onStoriesChange,storyIndex,userIndex]);

  const handleNextStory=()=>{if(storyIndex<currentUserStories.stories.length-1){setStoryIndex(storyIndex+1);setProgress(0)}else if(userIndex<stories.length-1)setUserIndex(userIndex+1);else onClose()};
  const handlePrevStory=()=>{if(storyIndex>0){setStoryIndex(storyIndex-1);setProgress(0)}else if(userIndex>0){setUserIndex(userIndex-1);setTimeout(()=>setStoryIndex(stories[userIndex-1].stories.length-1),50)}};
  const advanceVideoOnce=(expectedStoryId:string)=>{
    if(!expectedStoryId||activeStoryIdRef.current!==expectedStoryId||videoAdvanceLock.current===expectedStoryId)return;
    videoAdvanceLock.current=expectedStoryId;
    handleNextStory();
  };

  useEffect(()=>{
    if(currentStory?.mediaType==='VIDEO')return;
    const waiting=currentStory?.mediaType==='IMAGE'&&!imageReady;
    if(isPaused||isMenuOpen||isDeleteOpen||isViewersOpen||!currentStory||waiting)return;
    progressInterval.current=setInterval(()=>setProgress(prev=>{if(prev>=100){if(progressInterval.current)clearInterval(progressInterval.current);handleNextStory();return 0}return prev+2}),100);
    return()=>{if(progressInterval.current)clearInterval(progressInterval.current)};
  },[userIndex,storyIndex,isPaused,isMenuOpen,isDeleteOpen,isViewersOpen,currentStory?.storyId,currentStory?.mediaType,imageReady]);

  useEffect(()=>{
    const video=storyVideoRef.current;if(!video||currentStory?.mediaType!=='VIDEO')return;
    if(isPaused||isMenuOpen||isDeleteOpen||isViewersOpen||!videoReady)video.pause();
    else video.play().catch(()=>{});
  },[isPaused,isMenuOpen,isDeleteOpen,isViewersOpen,videoReady,currentStory?.storyId,currentStory?.mediaType]);

  const onVideoMetadata=(video:HTMLVideoElement)=>{
    const duration=Number.isFinite(video.duration)?video.duration:0;
    const start=Math.min(trim.start,Math.max(0,duration-.1));
    video.currentTime=start;
    setProgress(0);
  };
  const onVideoTime=(video:HTMLVideoElement,storyId:string)=>{
    if(activeStoryIdRef.current!==storyId)return;
    const duration=Number.isFinite(video.duration)?video.duration:0;
    const start=Math.min(trim.start,Math.max(0,duration-.1));
    const hasLegacyTrim=trim.end>start&&trim.end<duration-.12;
    const end=hasLegacyTrim?Math.min(duration,trim.end):duration;
    const segment=Math.max(.1,end-start);
    setProgress(Math.max(0,Math.min(100,((video.currentTime-start)/segment)*100)));
    if(hasLegacyTrim&&video.currentTime>=end-.06){video.pause();advanceVideoOnce(storyId);}
  };

  const openViewers=async()=>{if(!currentStory||!isOwnStory)return;setIsViewersOpen(true);setViewersLoading(true);setViewersError('');try{const r=await api.get(`/stories/${currentStory.storyId}/viewers`);setViewers(r.data||[])}catch(e:any){setViewersError(e.response?.data?.message||'No se pudieron cargar las vistas.')}finally{setViewersLoading(false)}};
  const handleDeleteStory=async()=>{if(!currentStory)return;setIsDeleting(true);setDeleteError('');try{await api.delete(`/stories/${currentStory.storyId}`);const remaining=currentUserStories.stories.filter(s=>s.storyId!==currentStory.storyId);const remove=remaining.length===0;const next=remove?stories.filter((_,i)=>i!==userIndex):stories.map((g,i)=>i===userIndex?{...g,stories:remaining}:g);setStories(next);onStoriesChange?.(next);setIsDeleteOpen(false);setIsMenuOpen(false);if(remove||!next.length)return onClose();setStoryIndex(i=>Math.min(i,remaining.length-1));setProgress(0)}catch(e:any){setDeleteError(e.response?.data?.message||'No se pudo eliminar el momento.')}finally{setIsDeleting(false)}};
  const formatRelativeTime=(dateStr:string)=>{if(!dateStr)return'';const diff=Math.floor((Date.now()-new Date(dateStr).getTime())/1000);if(diff<60)return` · hace ${Math.max(1,diff)} s`;if(diff<3600)return` · hace ${Math.floor(diff/60)} min`;return` · hace ${Math.floor(diff/3600)} h`};
  const handleSendReply=async(e:React.FormEvent)=>{e.preventDefault();if(!replyText.trim()||!currentStory||isOwnStory)return;try{await api.post(`/chat/direct/${encodeURIComponent(currentUserStories.username)}/messages`,{content:replyText.trim(),messageType:'STORY_REPLY',storyPreviewId:currentStory.storyId});setReplyText('');alert(`Respuesta enviada a @${currentUserStories.username}`)}catch{alert('No se pudo enviar la respuesta.')}};
  const handleResonate=async(emoji:string)=>{if(!currentStory||isOwnStory)return;try{await api.post(`/stories/${currentStory.storyId}/reaction`,{reactionType:emoji});setSelectedResonance(emoji)}catch{}};

  if(!currentUserStories||!currentStory)return null;
  const visualOverlays=parseOverlayData(currentStory).filter((o:any)=>o?.type!=='VIDEO_TRIM'&&o?.id!=='__video_trim__');

  return <div className="fixed inset-0 z-50 bg-[#061217] flex flex-col justify-between items-center h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
    <div className="w-full max-w-lg h-full max-h-[85vh] md:max-h-[90vh] md:mt-4 bg-[#07151d] md:rounded-2xl overflow-hidden relative border border-teal-950/60 z-10 flex flex-col items-center justify-center" onMouseDown={()=>setIsPaused(true)} onMouseUp={()=>setIsPaused(false)} onTouchStart={()=>setIsPaused(true)} onTouchEnd={()=>setIsPaused(false)}>
      <div className="absolute top-3 left-3 right-3 z-30 flex gap-1">{currentUserStories.stories.map((s,idx)=><div key={s.storyId} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{width:idx<storyIndex?'100%':idx===storyIndex?`${progress}%`:'0%'}}/></div>)}</div>
      <div className="absolute top-6 left-4 right-4 z-30 flex items-center justify-between"><div className="flex items-center gap-2"><UserAvatar avatarUrl={currentUserStories.avatarUrl} name={currentUserStories.displayName} className="h-9 w-9 rounded-full border border-white/20"/><div><span className="text-white text-xs font-bold block">{currentUserStories.displayName}</span><span className="text-[10px] text-zinc-400">@{currentUserStories.username}{formatRelativeTime(currentStory.createdAt)}</span></div></div><div className="flex items-center gap-2">{isOwnStory&&<button onClick={()=>setIsMenuOpen(v=>!v)} className="h-11 w-11 rounded-full bg-black/40 text-white flex items-center justify-center"><MoreHorizontal className="h-5 w-5"/></button>}<button onClick={()=>setIsPaused(v=>!v)} className="h-11 w-11 rounded-full bg-black/40 text-white flex items-center justify-center">{isPaused?<Play className="h-4 w-4"/>:<Pause className="h-4 w-4"/>}</button><button onClick={onClose} className="h-11 w-11 rounded-full bg-black/40 text-white flex items-center justify-center"><X className="h-4 w-4"/></button></div></div>
      <div className="w-full h-full flex items-center justify-center relative"><div className="absolute inset-y-0 left-0 w-1/4 z-20" onClick={e=>{e.stopPropagation();handlePrevStory()}}/><div className="absolute inset-y-0 right-0 w-1/4 z-20" onClick={e=>{e.stopPropagation();handleNextStory()}}/>
        {currentStory.mediaType==='IMAGE'&&<>{!imageReady&&<div className="absolute inset-0 flex items-center justify-center bg-[#07151d] text-teal-200 text-xs font-bold">Cargando momento…</div>}<img src={currentStory.mediaUrl} onLoad={()=>setImageReady(true)} alt="Momento" className={`w-full h-full object-contain pointer-events-none ${imageReady?'opacity-100':'opacity-0'}`}/></>}
        {currentStory.mediaType==='VIDEO'&&<><video key={currentStory.storyId} ref={storyVideoRef} src={currentStory.mediaUrl} autoPlay playsInline preload="auto" onLoadedMetadata={e=>onVideoMetadata(e.currentTarget)} onCanPlay={()=>setVideoReady(true)} onPlaying={()=>setVideoReady(true)} onWaiting={()=>setVideoReady(false)} onStalled={()=>setVideoReady(false)} onTimeUpdate={e=>onVideoTime(e.currentTarget,currentStory.storyId)} onEnded={()=>advanceVideoOnce(currentStory.storyId)} className="w-full h-full object-contain"/>{!videoReady&&<div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/20"><div className="rounded-full bg-black/60 px-3 py-2 text-xs font-bold text-white">Cargando video…</div></div>}</>}
        {currentStory.mediaType==='TEXT'&&<div style={{background:currentStory.backgroundColor||'#0f766e'}} className="w-full h-full flex items-center justify-center p-8"><h2 className="text-3xl font-extrabold text-white text-center">{currentStory.textContent}</h2></div>}
        {visualOverlays.map((o:any)=><div key={o.id} className="absolute pointer-events-none z-20" style={{left:`${o.x*100}%`,top:`${o.y*100}%`,transform:`translate(-50%,-50%) scale(${o.scale})`,color:o.color||'#fff'}}><div className={`px-3 py-1.5 rounded-xl font-bold ${o.bg?'bg-black/75':''}`}>{o.value}</div></div>)}
      </div>
      {isMenuOpen&&isOwnStory&&<div className="absolute right-4 top-20 z-50 w-48 rounded-xl border border-zinc-700 bg-zinc-950 p-1"><button onClick={()=>{setIsMenuOpen(false);void openViewers()}} className="w-full px-3 py-3 text-left text-sm font-bold text-white">Ver quién lo vio</button><button onClick={()=>{setIsMenuOpen(false);setIsDeleteOpen(true)}} className="w-full px-3 py-3 text-left text-sm font-bold text-rose-400">Eliminar momento</button></div>}
    </div>
    {!isOwnStory&&<div className="w-full max-w-lg p-4 bg-zinc-950 border-t border-zinc-900 z-20"><div className="flex justify-around mb-2">{['❤️','😂','😮','😢','🔥'].map(x=><button key={x} onClick={()=>void handleResonate(x)} className={selectedResonance===x?'scale-125':''}>{x}</button>)}</div><form onSubmit={handleSendReply} className="flex gap-2"><input value={replyText} onChange={e=>setReplyText(e.target.value)} onFocus={()=>setIsPaused(true)} placeholder={`Responder a ${currentUserStories.displayName}...`} className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white"/><button className="p-2.5 bg-teal-800 text-white rounded-xl"><Send className="h-4 w-4"/></button></form></div>}
    {isOwnStory&&<button onClick={()=>void openViewers()} className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-30 flex gap-2 rounded-full bg-black/55 px-4 py-2 text-xs font-bold text-white"><Eye className="h-4 w-4"/> Vistas</button>}
    {isDeleteOpen&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-sm rounded-2xl bg-zinc-950 border border-zinc-700 p-5"><h3 className="font-bold text-white">¿Eliminar este momento?</h3>{deleteError&&<p className="text-xs text-rose-400 mt-2">{deleteError}</p>}<div className="flex gap-3 mt-4"><button onClick={()=>setIsDeleteOpen(false)} className="flex-1 rounded-xl border border-zinc-700 py-2 text-white">Cancelar</button><button disabled={isDeleting} onClick={handleDeleteStory} className="flex-1 rounded-xl bg-rose-600 py-2 font-bold text-white">{isDeleting?'Eliminando…':'Eliminar'}</button></div></div></div>}
    {isViewersOpen&&<div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center bg-black/65" onClick={()=>setIsViewersOpen(false)}><div className="max-h-[70vh] w-full max-w-md rounded-t-3xl md:rounded-3xl bg-zinc-950 border border-zinc-700 overflow-hidden" onClick={e=>e.stopPropagation()}><div className="p-4 border-b border-zinc-800 flex justify-between"><h3 className="font-bold text-white">Vistas del momento</h3><button onClick={()=>setIsViewersOpen(false)} className="text-white"><X className="h-4 w-4"/></button></div><div className="max-h-[55vh] overflow-y-auto p-3">{viewersLoading?<p className="p-6 text-center text-zinc-400">Cargando…</p>:viewersError?<p className="p-6 text-rose-400">{viewersError}</p>:viewers.length?viewers.map(v=><div key={v.userId} className="flex items-center gap-3 p-3"><UserAvatar avatarUrl={v.avatarUrl} name={v.displayName||v.username} className="h-11 w-11 rounded-full"/><div className="flex-1"><p className="text-sm font-bold text-white">{v.displayName||v.username}</p><p className="text-xs text-zinc-400">@{v.username}{formatRelativeTime(v.viewedAt)}</p></div>{v.resonance&&<span className="text-2xl">{v.resonance}</span>}</div>):<p className="p-8 text-center text-zinc-400">Aún nadie ha visto este momento.</p>}</div></div></div>}
  </div>;
}
