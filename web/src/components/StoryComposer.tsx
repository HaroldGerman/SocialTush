'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/context/AuthContext';
import { X, Camera, Image as ImageIcon, Type, Sparkles, Smile, Music, RefreshCw, Scissors, Trash2 } from 'lucide-react';

interface StoryComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: (story: unknown) => void;
}

interface OverlayItem {
  id: string;
  type: 'TEXT' | 'EMOJI' | 'GIF';
  value: string;
  x: number;
  y: number;
  scale: number;
  color?: string;
  bg?: boolean;
  fontFamily?: string;
  fontWeight?: number;
}

const PRESET_BACKGROUNDS = [
  'linear-gradient(135deg, #0f766e 0%, #042f2e 100%)',
  'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)',
  'linear-gradient(135deg, #881337 0%, #4c0519 100%)',
  'linear-gradient(135deg, #7c2d12 0%, #431407 100%)',
  '#090d16', '#1e293b'
];
const FONT_OPTIONS = [
  { label: 'Lifonk', value: 'Manrope, ui-sans-serif, system-ui, sans-serif' },
  { label: 'Clásica', value: 'Georgia, Times New Roman, serif' },
  { label: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  { label: 'Suave', value: 'Trebuchet MS, ui-sans-serif, sans-serif' }
];
const MAX_STORY_VIDEO_SECONDS = 30;

const formatSeconds = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

export default function StoryComposer({ isOpen, onClose, onPublished }: StoryComposerProps) {
  const [composerMode, setComposerMode] = useState<'SELECT' | 'CAMERA' | 'TEXT' | 'EDITOR'>('SELECT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO' | 'TEXT'>('TEXT');
  const [textContent, setTextContent] = useState('');
  const [bgColor, setBgColor] = useState(PRESET_BACKGROUNDS[0]);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'NONE' | 'TEXT' | 'EMOJI' | 'MUSIC'>('NONE');
  const [newText, setNewText] = useState('');
  const [newTextColor, setNewTextColor] = useState('#ffffff');
  const [newTextBg, setNewTextBg] = useState(false);
  const [newTextScale, setNewTextScale] = useState(1.2);
  const [newTextFont, setNewTextFont] = useState(FONT_OPTIONS[0].value);
  const [newTextWeight, setNewTextWeight] = useState(700);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const editorVideoRef = useRef<HTMLVideoElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isBestFriends, setIsBestFriends] = useState(false);

  const selectedOverlay = overlays.find(item => item.id === selectedOverlayId) || null;

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraReady(false);
    setIsStartingCamera(false);
  }, []);

  const startCamera = useCallback(async (facing: 'user' | 'environment' = 'user') => {
    stopCamera();
    const requestId = cameraRequestRef.current;
    setCameraError(null);
    setIsStartingCamera(true);
    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing } }, audio: false });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
      }
      if (requestId !== cameraRequestRef.current) return mediaStream.getTracks().forEach(track => track.stop());
      streamRef.current = mediaStream;
      setCameraFacing(facing);
      setComposerMode('CAMERA');
    } catch (error) {
      console.error(error);
      setCameraError('No pudimos acceder a la cámara. Revisa los permisos del navegador.');
      setComposerMode('SELECT');
    } finally {
      if (requestId === cameraRequestRef.current) setIsStartingCamera(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (composerMode !== 'CAMERA' || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => setCameraError('No pudimos mostrar la cámara.'));
  }, [composerMode, cameraFacing]);
  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => { if (!isOpen) stopCamera(); }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !isCameraReady || !video.videoWidth || !video.videoHeight) return;
    setIsCapturing(true);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return setIsCapturing(false);
    if (cameraFacing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedFile(file); setMediaUrl(URL.createObjectURL(file)); setMediaType('IMAGE'); setComposerMode('EDITOR'); stopCamera();
      }
      setIsCapturing(false);
    }, 'image/jpeg', .95);
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    stopCamera();
    const file = e.target.files?.[0];
    if (!file) return;
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    const url = URL.createObjectURL(file);
    setSelectedFile(file); setMediaUrl(url);
    const isVideo = file.type.startsWith('video');
    setMediaType(isVideo ? 'VIDEO' : 'IMAGE');
    setVideoDuration(0); setTrimStart(0); setTrimEnd(0);
    setComposerMode('EDITOR');
  };

  const onVideoMetadata = (video: HTMLVideoElement) => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    setVideoDuration(duration);
    const end = Math.min(duration, MAX_STORY_VIDEO_SECONDS);
    setTrimStart(0); setTrimEnd(end);
    video.currentTime = 0;
  };

  const updateTrimStart = (value: number) => {
    const next = Math.max(0, Math.min(value, Math.max(0, videoDuration - 1)));
    setTrimStart(next);
    setTrimEnd(current => Math.min(videoDuration, Math.max(next + 1, Math.min(current, next + MAX_STORY_VIDEO_SECONDS))));
    if (editorVideoRef.current) editorVideoRef.current.currentTime = next;
  };
  const updateTrimEnd = (value: number) => {
    const next = Math.min(videoDuration, Math.max(trimStart + 1, value));
    setTrimEnd(Math.min(next, trimStart + MAX_STORY_VIDEO_SECONDS));
  };
  const handlePreviewTime = (video: HTMLVideoElement) => {
    if (trimEnd > trimStart && video.currentTime >= trimEnd - .05) {
      video.currentTime = trimStart;
      video.play().catch(() => {});
    }
  };

  const updateOverlay = (id: string, changes: Partial<OverlayItem>) => {
    setOverlays(previous => previous.map(item => item.id === id ? { ...item, ...changes } : item));
  };

  const handleOverlayDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setSelectedOverlayId(id);
    setActivePanel('NONE');
    const container = canvasContainerRef.current; if (!container) return;
    const rect = container.getBoundingClientRect();
    const update = (x: number, y: number) => setOverlays(prev => prev.map(o => o.id === id ? { ...o, x: Math.min(Math.max((x-rect.left)/rect.width,0),1), y: Math.min(Math.max((y-rect.top)/rect.height,0),1) } : o));
    const mm = (ev: MouseEvent) => update(ev.clientX, ev.clientY);
    const mu = () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
    const tm = (ev: TouchEvent) => ev.touches[0] && update(ev.touches[0].clientX, ev.touches[0].clientY);
    const tu = () => { window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', tu); };
    if ('touches' in e) { window.addEventListener('touchmove', tm, { passive: true }); window.addEventListener('touchend', tu); }
    else { window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu); }
  };

  const addTextOverlay = () => {
    if (!newText.trim()) return;
    const id = 'text_' + Date.now();
    setOverlays(prev => [...prev, { id, type:'TEXT', value:newText.trim(), x:.5, y:.4, scale:newTextScale, color:newTextColor, bg:newTextBg, fontFamily:newTextFont, fontWeight:newTextWeight }]);
    setSelectedOverlayId(id);
    setNewText(''); setActivePanel('NONE');
  };
  const addEmojiOverlay = (emoji:string) => {
    const id = 'emoji_' + Date.now();
    setOverlays(prev => [...prev,{id,type:'EMOJI',value:emoji,x:.5,y:.5,scale:1.8}]);
    setSelectedOverlayId(id);
    setActivePanel('NONE');
  };

  const handlePublishStory = async () => {
    setIsPublishing(true); setCameraError(null);
    try {
      const formData = new FormData();
      formData.append('mediaType', mediaType);
      formData.append('isBestFriends', String(isBestFriends));
      if (mediaType === 'TEXT') {
        formData.append('textContent', textContent);
        formData.append('backgroundColor', bgColor);
      } else if (selectedFile) {
        formData.append('file', selectedFile);
      }
      if (mediaType === 'VIDEO' && videoDuration > 0) {
        formData.append('trimStart', String(trimStart));
        formData.append('trimEnd', String(trimEnd || Math.min(videoDuration, MAX_STORY_VIDEO_SECONDS)));
      }
      if (overlays.length) formData.append('overlayData', JSON.stringify(overlays));
      const response = await api.post('/stories', formData, { headers:{'Content-Type':'multipart/form-data'} });
      onCloseClean(); onPublished?.(response.data);
    } catch (err:any) {
      console.error(err);
      setCameraError(err.response?.data?.message || 'Error al preparar el momento');
    } finally {
      setIsPublishing(false);
    }
  };

  const onCloseClean = () => {
    if (isPublishing) return;
    stopCamera(); setSelectedFile(null); if (mediaUrl) URL.revokeObjectURL(mediaUrl); setMediaUrl(null);
    setOverlays([]); setSelectedOverlayId(null); setTextContent(''); setCameraError(null); setComposerMode('SELECT'); setVideoDuration(0); setTrimStart(0); setTrimEnd(0); onClose();
  };

  return <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:p-4">
    <div className="w-full h-full md:max-w-md bg-[#090d16] md:rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
      {isPublishing && <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#071016]/95 px-8 text-center backdrop-blur-md"><div className="h-14 w-14 animate-pulse rounded-2xl bg-gradient-to-br from-teal-500 to-teal-800 flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-teal-950/40">L</div><div><p className="text-base font-extrabold text-white">{mediaType === 'VIDEO' ? 'Preparando tu momento…' : 'Publicando tu momento…'}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{mediaType === 'VIDEO' ? 'Estamos recortando y optimizando el video. Solo se guardará el fragmento que elegiste.' : 'Un momento, ya casi está listo.'}</p></div><div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded-full bg-teal-500"/></div></div>}

      {composerMode === 'SELECT' && <div className="flex-1 flex flex-col justify-center p-6 space-y-6 text-center">
        <div className="absolute top-4 left-4 right-4 flex justify-between"><span className="text-sm font-extrabold text-teal-400">Crear momento</span><button onClick={onCloseClean} className="p-2 rounded-full bg-slate-800 text-white"><X className="w-5 h-5"/></button></div>
        <div><Sparkles className="w-12 h-12 text-teal-500 mx-auto"/><h2 className="text-lg font-black text-white mt-2">¿Cómo quieres contar tu momento?</h2><p className="text-xs text-slate-400 mt-1">Foto, video o texto.</p></div>
        <div className="grid gap-3">
          <button onClick={()=>startCamera('user')} disabled={isStartingCamera} className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl text-left"><Camera className="w-5 h-5 text-teal-400"/><div><b className="text-sm text-white">{isStartingCamera?'Abriendo cámara…':'Usar cámara'}</b><p className="text-[11px] text-slate-500">Toma una foto ahora</p></div></button>
          <label className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl text-left cursor-pointer"><ImageIcon className="w-5 h-5 text-emerald-400"/><div className="flex-1"><b className="text-sm text-white">Galería / archivos</b><p className="text-[11px] text-slate-500">Sube una foto o video y recórtalo antes de publicar</p></div><input type="file" onChange={handleGallerySelect} accept="image/*,video/*" className="hidden"/></label>
          <button onClick={()=>{setMediaType('TEXT');setComposerMode('TEXT')}} className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl text-left"><Type className="w-5 h-5 text-amber-400"/><div><b className="text-sm text-white">Momento de texto</b><p className="text-[11px] text-slate-500">Comparte una idea rápida</p></div></button>
        </div>{cameraError&&<p className="text-xs text-rose-300">{cameraError}</p>}
        <input ref={nativeCameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleGallerySelect} className="hidden"/>
      </div>}

      {composerMode === 'CAMERA' && <div className="flex-1 relative bg-black"><video ref={videoRef} autoPlay playsInline muted onLoadedMetadata={e=>setIsCameraReady(e.currentTarget.videoWidth>0)} className={`w-full h-full object-cover ${cameraFacing==='user'?'scale-x-[-1]':''}`}/><div className="absolute top-4 left-4 right-4 flex justify-between"><button onClick={()=>{stopCamera();setComposerMode('SELECT')}} className="p-2.5 rounded-full bg-black/60 text-white"><X className="w-5 h-5"/></button><button onClick={()=>startCamera(cameraFacing==='user'?'environment':'user')} className="p-2.5 rounded-full bg-black/60 text-white"><RefreshCw className="w-5 h-5"/></button></div><div className="absolute bottom-8 inset-x-0 flex justify-center"><button onClick={capturePhoto} disabled={isCapturing||!isCameraReady} className="w-20 h-20 rounded-full border-4 border-white p-1"><div className="w-full h-full rounded-full bg-white"/></button></div></div>}

      {composerMode === 'TEXT' && <div className="flex-1 flex flex-col p-6" style={{background:bgColor}}><div className="flex justify-between"><button onClick={()=>setComposerMode('SELECT')} className="p-2 rounded-full bg-black/40 text-white"><X className="w-5 h-5"/></button><button disabled={!textContent.trim()} onClick={()=>setComposerMode('EDITOR')} className="px-4 py-2 bg-white text-slate-900 rounded-xl text-xs font-black disabled:opacity-50">Siguiente</button></div><div className="flex-1 flex items-center"><textarea value={textContent} onChange={e=>setTextContent(e.target.value)} maxLength={250} placeholder="Escribe algo increíble…" className="w-full bg-transparent text-center text-white font-extrabold text-2xl outline-none resize-none"/></div><div className="flex justify-center gap-3">{PRESET_BACKGROUNDS.map((bg,i)=><button key={i} onClick={()=>setBgColor(bg)} className="w-8 h-8 rounded-full border-2 border-white/60" style={{background:bg}}/>)}</div></div>}

      {composerMode === 'EDITOR' && <div className="flex-1 min-h-0 flex flex-col relative bg-slate-950">
        <div className="absolute top-4 left-4 right-4 flex justify-between z-30"><button onClick={onCloseClean} className="p-2.5 rounded-full bg-black/60 text-white"><X className="w-5 h-5"/></button><div className="flex gap-2"><button onClick={()=>{setSelectedOverlayId(null);setActivePanel(activePanel==='TEXT'?'NONE':'TEXT')}} className="p-2.5 rounded-full bg-black/60 text-white"><Type className="w-5 h-5"/></button><button onClick={()=>{setSelectedOverlayId(null);setActivePanel(activePanel==='EMOJI'?'NONE':'EMOJI')}} className="p-2.5 rounded-full bg-black/60 text-white"><Smile className="w-5 h-5"/></button><button onClick={()=>{setSelectedOverlayId(null);setActivePanel(activePanel==='MUSIC'?'NONE':'MUSIC')}} className="p-2.5 rounded-full bg-black/60 text-white"><Music className="w-5 h-5"/></button></div></div>
        <div ref={canvasContainerRef} className="flex-1 min-h-0 relative overflow-hidden flex items-center justify-center" style={{background:mediaType==='TEXT'?bgColor:'#000'}} onClick={event=>{if(event.target===event.currentTarget)setSelectedOverlayId(null)}}>
          {mediaType==='IMAGE'&&mediaUrl&&<img src={mediaUrl} alt="Momento" className="w-full h-full object-cover pointer-events-none"/>}
          {mediaType==='VIDEO'&&mediaUrl&&<video ref={editorVideoRef} src={mediaUrl} controls playsInline preload="metadata" onLoadedMetadata={e=>onVideoMetadata(e.currentTarget)} onTimeUpdate={e=>handlePreviewTime(e.currentTarget)} className="w-full h-full object-contain"/>}
          {mediaType==='TEXT'&&<p className="text-white font-extrabold text-2xl text-center px-6 whitespace-pre-wrap">{textContent}</p>}
          {overlays.map(o=><div key={o.id} onMouseDown={e=>handleOverlayDrag(o.id,e)} onTouchStart={e=>handleOverlayDrag(o.id,e)} className={`absolute cursor-move z-20 rounded-xl ${selectedOverlayId===o.id?'ring-2 ring-teal-400 ring-offset-2 ring-offset-black/30':''}`} style={{left:`${o.x*100}%`,top:`${o.y*100}%`,transform:`translate(-50%,-50%) scale(${o.scale})`,color:o.color||'#fff',fontFamily:o.fontFamily||undefined,fontWeight:o.fontWeight||700}}><div className={`px-3 py-1.5 rounded-xl ${o.bg?'bg-black/75':''}`}>{o.value}</div></div>)}
        </div>

        {mediaType==='VIDEO'&&videoDuration>0&&<div className="border-t border-slate-800 bg-[#0b111b] px-4 py-3 space-y-2 z-30"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-bold text-white"><Scissors className="h-4 w-4 text-teal-400"/>Recortar video</div><span className="text-[11px] text-teal-300">{formatSeconds(trimStart)} — {formatSeconds(trimEnd)} · {Math.max(0,trimEnd-trimStart).toFixed(1)} s</span></div><p className="text-[10px] text-slate-400">Elige el fragmento final. Lifonk guardará solo este clip, máximo {MAX_STORY_VIDEO_SECONDS} segundos.</p><label className="block text-[10px] text-slate-400">Inicio<input type="range" min={0} max={Math.max(0,videoDuration-1)} step="0.1" value={trimStart} onChange={e=>updateTrimStart(Number(e.target.value))} className="w-full accent-teal-500"/></label><label className="block text-[10px] text-slate-400">Final<input type="range" min={Math.min(videoDuration,trimStart+1)} max={Math.min(videoDuration,trimStart+MAX_STORY_VIDEO_SECONDS)} step="0.1" value={trimEnd} onChange={e=>updateTrimEnd(Number(e.target.value))} className="w-full accent-teal-500"/></label><button type="button" onClick={()=>{if(editorVideoRef.current){editorVideoRef.current.currentTime=trimStart;editorVideoRef.current.play().catch(()=>{})}}} className="w-full rounded-xl border border-teal-800 bg-teal-950/40 py-2 text-xs font-bold text-teal-200">Previsualizar recorte</button></div>}

        {activePanel==='TEXT'&&<div className="absolute bottom-20 left-4 right-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 z-40 shadow-2xl"><div className="flex gap-2"><input value={newText} onChange={e=>setNewText(e.target.value)} placeholder="Escribe texto…" className="flex-1 rounded-xl bg-slate-800 px-3 py-2 text-xs text-white"/><button onClick={addTextOverlay} className="rounded-xl bg-teal-700 px-4 text-xs font-bold text-white">Añadir</button></div><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[10px] font-bold text-slate-400">Fuente<select value={newTextFont} onChange={e=>setNewTextFont(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-xs text-white">{FONT_OPTIONS.map(font=><option key={font.label} value={font.value}>{font.label}</option>)}</select></label><label className="text-[10px] font-bold text-slate-400">Peso<select value={newTextWeight} onChange={e=>setNewTextWeight(Number(e.target.value))} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-xs text-white"><option value={500}>Medio</option><option value={700}>Negrita</option><option value={900}>Extra fuerte</option></select></label></div><label className="mt-3 block text-[10px] font-bold text-slate-400">Tamaño · {Math.round(newTextScale*100)}%<input type="range" min="0.7" max="2.8" step="0.05" value={newTextScale} onChange={e=>setNewTextScale(Number(e.target.value))} className="mt-1 w-full accent-teal-500"/></label><div className="mt-2 flex items-center justify-between"><div className="flex items-center gap-2"><input type="color" value={newTextColor} onChange={e=>setNewTextColor(e.target.value)}/><span className="text-[10px] text-slate-400">Color</span></div><label className="text-xs text-slate-300"><input type="checkbox" checked={newTextBg} onChange={e=>setNewTextBg(e.target.checked)} className="mr-2"/>Fondo</label></div></div>}
        {activePanel==='EMOJI'&&<div className="absolute bottom-20 left-4 right-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 z-40 shadow-2xl"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Elige un emoji · luego toca el emoji para cambiar su tamaño</p><div className="grid grid-cols-6 gap-2">{['🔥','🚀','😂','❤️','😍','😎','👍','✨','🎉','🤔','👀','💯'].map(x=><button key={x} onClick={()=>addEmojiOverlay(x)} className="text-2xl p-2 rounded-xl hover:bg-slate-800">{x}</button>)}</div></div>}
        {activePanel==='MUSIC'&&<div className="absolute bottom-20 left-4 right-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 z-40 text-xs text-slate-400">Música conectada al audio original del video. Biblioteca externa: próximamente.</div>}

        {activePanel==='NONE'&&selectedOverlay&&<div className="absolute bottom-20 left-4 right-4 z-40 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur"><div className="flex items-center justify-between"><div><p className="text-xs font-black text-white">{selectedOverlay.type==='EMOJI'?'Editar emoji':'Editar texto'}</p><p className="text-[10px] text-slate-400">Arrástralo sobre la imagen para moverlo.</p></div><button onClick={()=>{setOverlays(previous=>previous.filter(item=>item.id!==selectedOverlay.id));setSelectedOverlayId(null)}} className="rounded-xl bg-rose-950/70 p-2 text-rose-300"><Trash2 className="h-4 w-4"/></button></div><label className="mt-3 block text-[10px] font-bold text-slate-400">Tamaño · {Math.round(selectedOverlay.scale*100)}%<input type="range" min={selectedOverlay.type==='EMOJI'?0.8:0.65} max={selectedOverlay.type==='EMOJI'?4:2.8} step="0.05" value={selectedOverlay.scale} onChange={e=>updateOverlay(selectedOverlay.id,{scale:Number(e.target.value)})} className="mt-1 w-full accent-teal-500"/></label>{selectedOverlay.type==='TEXT'&&<><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[10px] font-bold text-slate-400">Fuente<select value={selectedOverlay.fontFamily||FONT_OPTIONS[0].value} onChange={e=>updateOverlay(selectedOverlay.id,{fontFamily:e.target.value})} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-xs text-white">{FONT_OPTIONS.map(font=><option key={font.label} value={font.value}>{font.label}</option>)}</select></label><label className="text-[10px] font-bold text-slate-400">Peso<select value={selectedOverlay.fontWeight||700} onChange={e=>updateOverlay(selectedOverlay.id,{fontWeight:Number(e.target.value)})} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-xs text-white"><option value={500}>Medio</option><option value={700}>Negrita</option><option value={900}>Extra fuerte</option></select></label></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2"><input type="color" value={selectedOverlay.color||'#ffffff'} onChange={e=>updateOverlay(selectedOverlay.id,{color:e.target.value})}/><span className="text-[10px] text-slate-400">Color</span></div><label className="text-xs text-slate-300"><input type="checkbox" checked={Boolean(selectedOverlay.bg)} onChange={e=>updateOverlay(selectedOverlay.id,{bg:e.target.checked})} className="mr-2"/>Fondo</label></div></>}</div>}

        {cameraError&&<div className="mx-4 mb-2 rounded-xl bg-rose-950 p-3 text-xs text-rose-200">{cameraError}</div>}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between z-30"><label className="text-xs text-slate-300"><input type="checkbox" checked={isBestFriends} onChange={e=>setIsBestFriends(e.target.checked)} className="mr-2"/>Mejores conexiones</label><button onClick={handlePublishStory} disabled={isPublishing||mediaType==='VIDEO'&&(trimEnd-trimStart<1)} className="px-6 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs rounded-xl disabled:opacity-50">{isPublishing?'Preparando…':'Publicar momento'}</button></div>
      </div>}
    </div>
  </div>;
}
