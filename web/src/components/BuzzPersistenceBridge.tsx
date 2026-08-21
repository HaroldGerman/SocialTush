'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Client } from '@stomp/stompjs';
import { api, useAuth } from '@/context/AuthContext';
import { WS_BASE_URL } from '@/config/api';

type BuzzNotification = { notificationId:string; senderUsername:string; notificationType:string; isRead:boolean; createdAt:string };

function playTone(){try{const Ctx=(window.AudioContext||(window as any).webkitAudioContext);if(!Ctx)return;const ctx=new Ctx();[0,.12,.24].forEach(offset=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.frequency.value=190;gain.gain.setValueAtTime(.0001,ctx.currentTime+offset);gain.gain.exponentialRampToValueAtTime(.13,ctx.currentTime+offset+.01);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+offset+.08);osc.connect(gain);gain.connect(ctx.destination);osc.start(ctx.currentTime+offset);osc.stop(ctx.currentTime+offset+.09);});window.setTimeout(()=>void ctx.close(),700);}catch{}}
function replayBuzz(sender:string,count:number){if('vibrate'in navigator)navigator.vibrate?.([180,80,180,80,260]);playTone();document.documentElement.classList.add('lifonk-pending-buzz');window.setTimeout(()=>document.documentElement.classList.remove('lifonk-pending-buzz'),900);return count>1?`⚡ Tienes ${count} zumbidos pendientes. Último: @${sender}`:`⚡ @${sender} te dejó un zumbido`;}

export default function BuzzPersistenceBridge(){
  const {user,accessToken}=useAuth();
  const [notice,setNotice]=useState('');
  const consuming=useRef(false);

  useEffect(()=>{
    if(!user?.username||!accessToken)return;
    const client=new Client({brokerURL:WS_BASE_URL,connectHeaders:{Authorization:`Bearer ${accessToken}`},reconnectDelay:4000});
    client.onConnect=()=>client.subscribe(`/topic/user.${user.username}.buzz`,frame=>{try{const body=JSON.parse(frame.body||'{}');if(body.notificationId)void api.post(`/notifications/${encodeURIComponent(body.notificationId)}/read`);}catch{}});
    client.activate();return()=>{void client.deactivate();};
  },[user?.username,accessToken]);

  useEffect(()=>{
    if(!user||!accessToken)return;
    const consume=async()=>{
      if(!window.location.pathname.startsWith('/chat')||consuming.current)return;
      consuming.current=true;
      try{
        const response=await api.get('/notifications');
        const pending=(Array.isArray(response.data)?response.data:[]).filter((item:BuzzNotification)=>item.notificationType==='BUZZ'&&!item.isRead) as BuzzNotification[];
        if(!pending.length)return;
        pending.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
        setNotice(replayBuzz(pending[0].senderUsername,pending.length));
        await Promise.allSettled(pending.map(item=>api.post(`/notifications/${encodeURIComponent(item.notificationId)}/read`)));
      }catch(error){console.error('Pending buzz replay:',error);}finally{consuming.current=false;}
    };
    void consume();
    const timer=window.setInterval(()=>void consume(),4000);
    return()=>window.clearInterval(timer);
  },[user,accessToken]);

  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),3800);return()=>window.clearTimeout(timer);},[notice]);
  return <><style jsx global>{`@keyframes lifonkPendingBuzz{0%,100%{transform:translateX(0)}12%{transform:translateX(-10px)}24%{transform:translateX(10px)}38%{transform:translateX(-8px)}52%{transform:translateX(8px)}70%{transform:translateX(-4px)}84%{transform:translateX(4px)}}html.lifonk-pending-buzz body{animation:lifonkPendingBuzz .85s ease-in-out}`}</style>{notice&&typeof document!=='undefined'&&createPortal(<div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[2147483002] -translate-x-1/2 rounded-full bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-2xl">{notice}</div>,document.body)}</>;
}
