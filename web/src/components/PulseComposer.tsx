'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Film, Music2, Scissors, Upload, X } from 'lucide-react';
import { api } from '@/context/AuthContext';

interface PulseComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: (post: any) => void;
}

const MAX_SECONDS = 60;

function formatSeconds(value: number) {
  const safe = Math.max(0, value || 0);
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export default function PulseComposer({ isOpen, onClose, onPublished }: PulseComposerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [coverTime, setCoverTime] = useState(0);
  const [caption, setCaption] = useState('');
  const [musicTitle, setMusicTitle] = useState('');
  const [location, setLocation] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const selectedDuration = useMemo(() => Math.max(0, trimEnd - trimStart), [trimStart, trimEnd]);

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setDuration(0); setTrimStart(0); setTrimEnd(0); setCoverTime(0);
    setCaption(''); setMusicTitle(''); setLocation(''); setPublishing(false); setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const close = () => { clear(); onClose(); };

  const chooseFile = (next?: File) => {
    if (!next) return;
    if (!next.type.startsWith('video/')) return setError('Selecciona un archivo de video.');
    if (next.size > 250 * 1024 * 1024) return setError('El video supera el límite de 250 MB.');
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setDuration(0); setTrimStart(0); setTrimEnd(0); setCoverTime(0); setError('');
  };

  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const d = video.duration;
    setDuration(d);
    const end = Math.min(d, MAX_SECONDS);
    setTrimStart(0); setTrimEnd(end); setCoverTime(Math.min(2, end / 2));
  };

  const changeStart = (value: number) => {
    const next = Math.min(Math.max(0, value), Math.max(0, trimEnd - 1));
    setTrimStart(next);
    if (trimEnd - next > MAX_SECONDS) setTrimEnd(Math.min(duration, next + MAX_SECONDS));
    setCoverTime(previous => Math.min(Math.max(0, previous), Math.max(0, trimEnd - next - .1)));
  };

  const changeEnd = (value: number) => {
    const maxEnd = Math.min(duration, trimStart + MAX_SECONDS);
    const next = Math.max(trimStart + 1, Math.min(value, maxEnd));
    setTrimEnd(next);
    setCoverTime(previous => Math.min(previous, Math.max(0, next - trimStart - .1)));
  };

  const previewTrim = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = trimStart;
    void video.play();
  };

  const publish = async () => {
    if (!file || publishing || selectedDuration <= 0) return;
    setPublishing(true); setError('');
    try {
      const form = new FormData();
      form.append('files', file);
      form.append('caption', caption.trim());
      form.append('musicTitle', musicTitle.trim());
      form.append('location', location.trim());
      form.append('isShortVideo', 'true');
      form.append('trimStart', String(trimStart));
      form.append('trimEnd', String(trimEnd));
      form.append('coverTime', String(coverTime));
      const response = await api.post('/posts', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onPublished?.(response.data);
      window.dispatchEvent(new CustomEvent('socialtush:pulse-published', { detail: response.data }));
      close();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || requestError.response?.data?.detail || 'No pudimos preparar este Pulso.');
    } finally { setPublishing(false); }
  };

  if (!isOpen) return null;

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 backdrop-blur-sm md:items-center md:p-4">
    <div className="absolute inset-0" onClick={() => !publishing && close()} />
    <section className="relative z-10 max-h-[94dvh] w-full overflow-y-auto rounded-t-[30px] border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#0d1524] dark:text-white md:max-w-lg md:rounded-[30px] md:p-5">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-600">Pulso</p><h2 className="text-lg font-black">Crear video corto</h2></div><button disabled={publishing} onClick={close} className="rounded-full bg-slate-100 p-2 dark:bg-slate-800"><X className="h-5 w-5"/></button></div>

      {!preview ? <button onClick={() => inputRef.current?.click()} className="mt-5 flex min-h-56 w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-teal-300 bg-teal-50/70 text-center dark:border-teal-800 dark:bg-teal-950/20"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white"><Upload className="h-6 w-6"/></span><strong className="mt-4">Selecciona un video</strong><span className="mt-1 text-xs text-slate-500">Pulso guardará solo el fragmento elegido · máximo 60 s</span></button> : <>
        <div className="mt-4 overflow-hidden rounded-3xl bg-black"><video ref={videoRef} src={preview} controls playsInline preload="metadata" onLoadedMetadata={onLoadedMetadata} onTimeUpdate={() => { const video = videoRef.current; if (video && trimEnd > trimStart && video.currentTime >= trimEnd) video.pause(); }} className="max-h-[48dvh] w-full object-contain"/></div>

        {duration > 0 && <div className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-black"><Scissors className="h-4 w-4 text-teal-500"/>Recorte</span><span className="text-xs font-bold text-teal-600">{formatSeconds(trimStart)} — {formatSeconds(trimEnd)} · {selectedDuration.toFixed(1)} s</span></div><label className="mt-3 block text-[11px] font-bold text-slate-500">Inicio</label><input type="range" min={0} max={Math.max(1, duration - 1)} step="0.1" value={trimStart} onChange={event => changeStart(Number(event.target.value))} className="w-full accent-teal-600"/><label className="mt-2 block text-[11px] font-bold text-slate-500">Final</label><input type="range" min={Math.min(duration, trimStart + 1)} max={duration} step="0.1" value={trimEnd} onChange={event => changeEnd(Number(event.target.value))} className="w-full accent-teal-600"/><button type="button" onClick={previewTrim} className="mt-3 w-full rounded-xl border border-teal-500 py-2 text-xs font-black text-teal-600">Previsualizar recorte</button></div>}

        {selectedDuration > 0 && <div className="mt-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex items-center justify-between"><span className="text-sm font-black">Portada</span><span className="text-xs text-slate-500">{coverTime.toFixed(1)} s del clip</span></div><input type="range" min={0} max={Math.max(.1, selectedDuration - .1)} step="0.1" value={coverTime} onChange={event => { const value = Number(event.target.value); setCoverTime(value); if (videoRef.current) videoRef.current.currentTime = trimStart + value; }} className="mt-3 w-full accent-teal-600"/></div>}
      </>}

      <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/*" className="hidden" onChange={event => chooseFile(event.target.files?.[0])}/>

      {file && <div className="mt-4 space-y-3"><textarea value={caption} onChange={event => setCaption(event.target.value)} maxLength={800} rows={3} placeholder="¿Qué quieres que la gente sienta o vea?" className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-[#09111d]"/><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 dark:border-slate-700"><Music2 className="h-4 w-4 text-teal-500"/><input value={musicTitle} onChange={event => setMusicTitle(event.target.value)} maxLength={120} placeholder="Música o audio" className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none"/></label><label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 dark:border-slate-700"><Film className="h-4 w-4 text-teal-500"/><input value={location} onChange={event => setLocation(event.target.value)} maxLength={120} placeholder="Lugar opcional" className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none"/></label></div></div>}

      {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}

      {file && <button disabled={publishing || selectedDuration <= 0 || selectedDuration > MAX_SECONDS + .25} onClick={() => void publish()} className="mt-4 w-full rounded-2xl bg-[linear-gradient(135deg,#149a90,#0f766e)] py-3.5 text-sm font-black text-white shadow-lg disabled:opacity-45">{publishing ? 'Preparando tu Pulso…' : 'Publicar en Pulso'}</button>}
      {publishing && <p className="mt-2 text-center text-[10px] text-slate-500">Estamos recortando, optimizando y creando la portada. Solo guardaremos el clip final.</p>}
    </section>
  </div>;
}
