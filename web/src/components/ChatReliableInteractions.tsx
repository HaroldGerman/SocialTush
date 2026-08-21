'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Client } from '@stomp/stompjs';
import { Zap } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import { WS_BASE_URL } from '@/config/api';

const STORY_LABELS=new Set(['tu interacción con un momento','tu interaccion con un momento','interacción con tu momento','interaccion con tu momento']);

function findStoryCard(target:HTMLElement|null){let current=target;for(let depth=0;current&&depth<8;depth+=1,current=current.parentElement){if(current.tagName!=='DIV')continue;const directLabel=Array.from(current.children).find(child=>child.tagName==='P');const label=directLabel?.textContent?.trim().toLowerCase()||'';if(STORY_LABELS.has(label)&&current.querySelector('img[alt="Momento"], video, div[style]'))return current;}return null;}
function findActiveUsername(){const nodes=Array.from(document.querySelectorAll<HTMLElement>('span'));const match=nodes.find(node=>{const text=node.textContent?.trim()||'';if(!/^@[A-Za-z0-9_.-]+$/.test(text))return false;const rect=node.getBoundingClientRect();return rect.top>=0&&rect.top<260&&rect.width>0&&rect.height>0;});return match?.textContent?.trim().replace(/^@/,'')||'';}
function playBuzzTone(){try{const Ctx=(window.AudioContext||(window as any).webkitAudioContext);if(!Ctx)return;const ctx=new Ctx();[0,0.12,0.24].forEach(offset=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.frequency.value=190;gain.gain.setValueAtTime(0.0001,ctx.currentTime+offset);gain.gain.exponentialRampToValueAtTime(0.15,ctx.currentTime+offset+0.01);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+offset+0.08);osc.connect(gain);gain.connect(ctx.destination);osc.start(ctx.currentTime+offset);osc.stop(ctx.currentTime+offset+0.09);});window.setTimeout(()=>void ctx.close(),700);}catch{}}

export default function ChatReliableInteractions(){
  const {user,accessToken}=useAuth();
  const [target,setTarget]=useState('');
  const [sending,setSending]=useState(false);
  const [notice,setNotice]=useState('');
  const [mount,setMount]=useState<HTMLElement|null>(null);
  const [flash,setFlash]=useState(false);

  useEffect(()=>{
    const scan=()=>{
      if(!window.location.pathname.startsWith('/chat')){setTarget('');setMount(null);return;}
      setTarget(findActiveUsername());
      const phone=document.querySelector<HTMLButtonElement>('button[title="Llamada de voz"]');
      if(phone?.parentElement){let host=phone.parentElement.querySelector<HTMLElement>('[data-lifonk-reliable-buzz]');if(!host){host=document.createElement('span');host.dataset.lifonkReliableBuzz='true';phone.insertAdjacentElement('afterend',host);}setMount(host);}
      Array.from(document.querySelectorAll<HTMLButtonElement>('button')).forEach(button=>{if(button.textContent?.trim()==='Zumbido'&&button.closest('[data-lifonk-reliable-buzz]')==null)button.style.display='none';});
    };
    scan();const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    const onClick=(event:MouseEvent)=>{
      if(!window.location.pathname.startsWith('/chat'))return;
      const targetNode=event.target as HTMLElement|null;
      if(!targetNode)return;
      const card=findStoryCard(targetNode);
      if(!card)return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      const preview=card.querySelector('img[alt="Momento"], video') as HTMLImageElement|HTMLVideoElement|null;
      const textNode=Array.from(card.querySelectorAll('div')).find(node=>node!==card&&node.getAttribute('style'));
      const params=new URLSearchParams();if(preview?.src)params.set('mediaUrl',preview.src);else if(textNode?.textContent?.trim())params.set('textContent',textNode.textContent.trim());
      void api.get(`/stories/resolve?${params.toString()}`).then(response=>{const id=response.data?.storyId;if(!id)throw new Error('missing');window.location.assign(`/feed?moment=${encodeURIComponent(id)}`);}).catch(()=>setNotice('Ese Momento ya no está disponible.'));
    };
    document.addEventListener('click',onClick,true);return()=>document.removeEventListener('click',onClick,true);
  },[]);

  useEffect(()=>{
    if(!user?.username||!accessToken)return;
    const client=new Client({brokerURL:WS_BASE_URL,connectHeaders:{Authorization:`Bearer ${accessToken}`},reconnectDelay:3000,heartbeatIncoming:4000,heartbeatOutgoing:4000});
    client.onConnect=()=>client.subscribe(`/topic/user.${user.username}.buzz`,frame=>{const body=JSON.parse(frame.body||'{}');setNotice(`⚡ @${body.senderUsername||'alguien'} te envió un zumbido`);setFlash(true);if('vibrate'in navigator)navigator.vibrate?.([180,80,180,80,260]);playBuzzTone();document.documentElement.classList.add('lifonk-buzzing-strong');window.setTimeout(()=>{setFlash(false);document.documentElement.classList.remove('lifonk-buzzing-strong');},900);});
    client.onStompError=()=>setNotice('El canal de zumbidos se desconectó.');
    client.activate();return()=>{void client.deactivate();};
  },[user?.username,accessToken]);

  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),3500);return()=>window.clearTimeout(timer);},[notice]);

  const send=async()=>{if(!target||sending)return;setSending(true);try{await api.post(`/chat/buzz/${encodeURIComponent(target)}`);setNotice(`⚡ Zumbido enviado a @${target}`);}catch(error:any){setNotice(error?.response?.data?.message||'No se pudo enviar el zumbido.');}finally{setSending(false);}};

  return <><style jsx global>{`@keyframes lifonkBuzzStrong{0%,100%{transform:translate3d(0,0,0)}10%{transform:translate3d(-10px,0,0)}20%{transform:translate3d(10px,0,0)}30%{transform:translate3d(-8px,0,0)}40%{transform:translate3d(8px,0,0)}55%{transform:translate3d(-5px,0,0)}70%{transform:translate3d(5px,0,0)}}html.lifonk-buzzing-strong body{animation:lifonkBuzzStrong .8s ease-in-out}`}</style>{mount&&target&&createPortal(<button type="button" onClick={()=>void send()} disabled={sending} title="Enviar zumbido" aria-label="Enviar zumbido" className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-amber-700 disabled:opacity-40 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300"><Zap className="h-4 w-4 fill-current"/></button>,mount)}{notice&&typeof document!=='undefined'&&createPortal(<div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[2147483001] -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-xl">{notice}</div>,document.body)}{flash&&typeof document!=='undefined'&&createPortal(<div className="pointer-events-none fixed inset-0 z-[2147482999] border-[6px] border-amber-400/80 bg-amber-300/10"/>,document.body)}</>;
}
