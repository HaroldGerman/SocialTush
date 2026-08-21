'use client';

import { useEffect, useMemo, useState } from 'react';
import StoryViewer from '@/components/StoryViewer';
import { api } from '@/context/AuthContext';

type Story = { storyId:string; mediaType:string; mediaUrl:string; textContent:string; backgroundColor:string; musicTitle:string; createdAt:string; overlayData?:string; viewedByMe?:boolean; };
type GroupedStory = { userId:string; username:string; displayName:string; avatarUrl:string; hasUnseenStories?:boolean; stories:Story[]; };

export default function DeepLinkedMomentOverlay() {
  const [groups,setGroups]=useState<GroupedStory[]>([]);
  const [targetId,setTargetId]=useState<string|null>(null);
  const [unavailable,setUnavailable]=useState(false);

  useEffect(()=>{
    if (window.location.pathname !== '/feed') return;
    const id = new URLSearchParams(window.location.search).get('moment');
    if (!id) return;
    setTargetId(id);
    setUnavailable(false);
    void api.get(`/stories/${encodeURIComponent(id)}/open`).then(response=>{
      const group=response.data as GroupedStory;
      const target=group?.stories?.find(story=>String(story.storyId)===String(id));
      if(!group?.stories?.length || !target){setUnavailable(true);return;}
      setGroups([{...group,stories:[target,...group.stories.filter(story=>String(story.storyId)!==String(id))]}]);
    }).catch(()=>setUnavailable(true));
  },[]);

  const targetUserIndex=useMemo(()=>!targetId?-1:groups.findIndex(group=>String(group.stories?.[0]?.storyId)===String(targetId)),[groups,targetId]);
  const close=()=>{setTargetId(null);setUnavailable(false);const url=new URL(window.location.href);url.searchParams.delete('moment');window.history.replaceState({},'',`${url.pathname}${url.search}${url.hash}`);};

  if(unavailable&&targetId)return <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 p-4" onClick={close}><div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl dark:bg-[#0f172a]" onClick={event=>event.stopPropagation()}><p className="text-sm font-extrabold text-slate-900 dark:text-white">Este Momento ya no está disponible</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Puede haber expirado o haber sido eliminado.</p><button type="button" onClick={close} className="mt-4 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold text-white">Volver a Ritmo</button></div></div>;
  if(!targetId||targetUserIndex<0)return null;
  return <StoryViewer groupedStories={groups} initialUserIndex={targetUserIndex} onClose={close} onStoriesChange={setGroups}/>;
}
